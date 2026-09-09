# M4A.1 — Campaign Hardening + Solver/Runtime Consistency Hotfix

Branch `milestone/1-core-prototype`. Builds on M4A `3a65498`. **Not merged, not
pushed.**

Not a feature milestone: one tooling-correctness fix (the solver and the runtime
now share a single view of legal player actions) plus a minimal, solver-advised
smoothing of the World-1 and World-3 difficulty curves. No new mechanics, no new
worlds, no branding/backend/economy changes.

Commits: `d8d1b72` (M4A.1.1 admission consistency) · `2d1ca24` (M4A.1.2 curve
retune) · this docs commit.

---

## 1. The mismatch — root cause

`enumerateActions` (the concurrent solver's action set) was built as:

```
legalActions(state)                       // plain launches only, filtered by actionRejection
  + { ...a, join: true } for each a        // added when canJoinEpoch(a) — NOT filtered
```

`legalActions` never contained `join: true` variants, and the join variants the
solver bolted on were gated **only** by `canJoinEpoch`, never re-checked against
`actionRejection`. So the two sides could disagree whenever an epoch was open and
the Holding tray was full:

- **accepted-but-not-enumerated** — a plain tunnel launch is rejected
  (`holdingFull`: a fresh pass cannot reach a buried pixel and would overflow the
  tray), so the base loop never processes that tunnel, so its `join: true`
  variant is never emitted — even though `resolveAction` *accepts* the join
  (re-simulating the epoch with the joined charge re-floats the stranded charges,
  and the projected tray stays ≤ 3). The solver silently drops a legal winning
  line.
- **enumerated-but-rejected** — the mirror case: a plain launch is accepted (a
  fresh pass fully consumes the charge), so its `join: true` variant is emitted,
  but the joined re-simulation strands an extra charge and `resolveAction`
  rejects it with `holdingFull`. `solve()`'s `visit` loop then throws
  `Solver/runtime admission mismatch` — the exact symptom M4A reported on an
  over-tight Level-19 draft.

Both are the same defect: **join-variant admissibility computed ad-hoc, in two
places, neither matching `actionRejection`.**

## 2. Minimal repro

`src/game/engine/__tests__/admission-consistency.test.ts` → `REPRO_LEVEL`: the
Level-5 comet head in its Level-5 board position (a white frame around a buried
cyan ring around a buried centre-white pixel) plus one far-corner red so the
tray-full state does not deadlock.

```
tunnel-1 (cyan 2)   → strands (cyan buried) → tray [c]
tunnel-1 (cyan 2)   → strands              → tray [c, c]
tunnel-2 (cyan 2)   → strands              → tray [c, c, c]  (full, epoch open)
```

From that state:

| | `resolveAction` | old `enumerateActions` | new `enumerateActions` |
|---|---|---|---|
| `{ tunnel-0 }` (plain white 16) | **reject** `holdingFull` | absent | absent |
| `{ tunnel-0, join: true }` | **accept** | **absent** ← bug | **present** ← fix |

Old enumeration returns `["tunnel:tunnel-2:-", "tunnel:tunnel-2:J"]` — it never
mentions `tunnel-0` at all. Verified: the repro test fails against the pre-fix
`enumerateActions` and passes after.

## 3. The fix — one shared admission predicate

`src/game/engine/actions.ts`:

```ts
// the ONE candidate generator — one launch per tunnel-with-a-queue / held charge,
// plus a join variant only when canJoinEpoch actually allows it
export function candidateActions(state, includeJoin = false): GameAction[]

// the ONE admission check — candidateActions filtered through actionRejection
export function legalActions(state, opts: { includeJoin?: boolean } = {}): GameAction[]
```

`src/game/engine/solver.ts`:

```ts
export function enumerateActions(state, mode): GameAction[] {
  return legalActions(state, { includeJoin: mode !== 'sequential-compat' });
}
```

`enumerateActions` has **no private logic left** — it is `legalActions` with a
flag. Everything now agrees by construction:

| consumer | call |
|---|---|
| runtime deadlock check (`winState.isLost`) | `legalActions(state)` — plain only, unchanged (M1 semantics) |
| concurrent solver | `legalActions(state, { includeJoin: true })` |
| sequential-compat solver | `legalActions(state)` |
| `resolveAction` admission | `actionRejection(state, action)` — the predicate the above filter through |

`isLost` is deliberately left plain-only: a state it calls `lost` rejects every
action (`gameOver`) on both the solver and the runtime side, so it never
contradicts the enumeration; making it join-aware would change M1 deadlock
semantics for no correctness gain. The five-charge presentation cap is untouched
— it is an input gate in `useGameSession`, never a `Rejection`, and
`candidateActions` does not model it.

### `canJoinEpoch=false` + `join: true`

The runtime treats such a request as a plain settle-first launch (it downgrades
inside `planLaunch`). `candidateActions` never emits that variant (it would be a
duplicate of the plain action), so the consistency invariant is stated **modulo
that equivalence** — the tests canonicalise an un-honourable `join` to its plain
key.

## 4. Consistency tests (39, `admission-consistency.test.ts`)

- **M4A repro, both directions** — the fixture above; asserts plain rejected,
  join accepted, join enumerated, and the full invariant on a 400-state sweep
  from the tray-full state.
- **parameterized fixtures** — fresh board / one charge orbiting / two stranded /
  full tray / Frozen mid-solve / Frozen settled: `enumerateActions ==
  legalActions(includeJoin)` exactly, and `== legalActions()` for
  sequential-compat.
- **whole-campaign sweep** — for all 30 levels, up to 3 500 reachable states
  each: every enumerated action is accepted, every accepted candidate is
  enumerated (modulo the join↔plain equivalence), and the plain sets match.
- **candidateActions** — one plain launch per queue/held charge; a join variant
  only where `canJoinEpoch`; none when no epoch is open.

`frozen.test.ts` gains a `stateKey` test (iced ≠ thawed; thawed ≡ plain).

## 5. Performance

`enumerateActions` now also runs `actionRejection` per candidate (via the
`legalActions` filter). For the overwhelmingly common not-full-tray states
`actionRejection` returns in O(1); only a full-tray + open-epoch join pays a
`projectLaunch` (a memoized `simulateEpoch`), and `solve()` was already about to
call `resolveAction` — hence the same sim — for every action it explores.

Full 30-level `analyzeLevel` audit: **~35 s → ~39 s** (nodeCap 300 000). Only
Level 5 shifts under `metrics`: `18 407 → 24 001` explored states (the retune
below adds a charge; the fix adds a handful of join lines) and loss
`0.14 → 0.07`. **Every `sequential-compat` number is byte-identical** — M1
compatibility preserved.

## 6. Campaign curve retune (M4A.1.2)

Solver-advised, minimal — no art redesign, no mechanic change. Three levels:

| L | change | before | after |
|---|---|---|---|
| **5 The Long Comet** | split the head white charge (`{white,16}` → `{white,15}` + a trailing `{white,1}`) so the buried centre pixel stops stranding the frame charge | easy · score 30 · win 7 · **peak 1** · loss .14 · fail Y | easy · score 21 · win 8 · **peak 0** · loss .07 · fail Y |
| **25 Winter Hare** | `easy → medium`; the two indigo eyes stacked ahead of the body white (`{indigo,2}+{white,27}` → `{indigo,4}+{white,17}` split 3-way) so they strand and force one held relaunch | **easy** · score 15 · peak 0 · held 0 | **medium** · score 27 · peak 1 · held 1 |
| **26 The Frozen Lantern** | `hard → medium`; 5 → 3 Frozen pixels, gold split across two tunnels | **hard** · score 46 · held 4 | **medium** · score 33 · held 2 |

Everything else in the 30-level campaign is byte-unchanged.

### Fail-path classification (Part 9)

Documentation, not runtime schema:

| levels | class | met? |
|---|---|---|
| L1–4, L11–13, L21–22, L25 | SAFE — no fail path expected | ✔ |
| L5–9, L14–19, L23–28 | PRESSURE — fail path desirable, not mandatory | L5 ✔; the rest are pressure by held-relaunch + narrow strong line, no losing line under the forgiving 3-slot tray |
| L10, L20, L29, L30 | PUNISHING | **L10 ✔** (74 % random-play loss). L20 / L29 / L30 are punishing *by sequencing* (peak 2–3, held 2–4, 8–9-move solves, dense boards) but not *by deadlock* — with exact per-colour budgets and "every Frozen hit advances the pixel", a charge can never be truly wasted, so no losing line exists. Adding deliberate deadlock windows needs over-budget/disconnected-region redesign → **deferred to M4B** with playtest data. |

## 7. Final difficulty curve

| world | curve | notes |
|---|---|---|
| **1 FIRST LIGHT** | E E E E **E** E E E **M** **H** | L1–8 Easy, L9 Medium, L10 Hard. L5 authored Easy / suggests Medium (score 21) — an onboarding call (Part 6): peak 0, loss 7 %, it behaves easy; the score is solve-length + burial depth, not danger. |
| **2 WILD GARDEN** | E E E **M M M M M M** **H** | L11–13 Easy, L14–19 Medium (each with one forced held relaunch + a narrow strong line), L20 Hard finale (peak 3, held 2). |
| **3 DEEP FROST** | E E **M M M M M M** **H H** | monotonic non-decreasing, no backward jumps (M4A had L25 Easy between Mediums and L26 Hard mid-sequence). L21 Frozen tutorial. L29–30 the Hard closers (score 46–47, held 3–4, 8–9-move solves). L28 is a Medium lead-in, not a third Hard — the concurrent engine caps the achievable ceiling of the tight Ice-Crystal shape without an art change. |

Every authored tier now matches the solver suggestion **except Level 5**
(documented).

## 8. Accepted remaining warnings

| code | levels | why accepted |
|---|---|---|
| `NO_FAIL_PATH` (warn) | 9, 14–19, 23–28 | the 3-slot tray is forgiving; Part 9 explicitly does not require every Medium to have a losing line. These levels apply pressure by held relaunches + narrow openings. |
| `TRIVIAL_FIRST_MOVES` (info on Easy) | 1–3, 12–13, 21–22, 28 | onboarding / teaching levels; all three openings *should* be safe. |
| `DIFFICULTY_MISMATCH` (info, 1 tier) | 5 | L5 authored Easy, suggests Medium — Part 6 onboarding call (see §7). |
| `CONCURRENCY_TRIVIALIZES_LEVEL` (info) | 19 | Red Fox: the concurrent line is 2 moves shorter than sequential. A queue/nesting change that removed it traded it for `TRIVIAL_FIRST_MOVES` (a *warn* on a Medium) and flattened the openings — a worse outcome. Concurrency helping on a Medium is a valid design signal, not a defect (M3B §5). Left as authored; recognizable fox art preserved. |
| `SOLVER_NODE_EXPLOSION` | (none now — L5 at 24 k is below the 60 k threshold) | — |
| `meta/*-tuned` (warn) | 3, 5, 6, 9, 10, 13, 14, 23 | boards on 5/6/8-cell edges — legal, outside the renderer-tuned 7/9/11/13/15 set. Pre-existing, benign. |

## 9. Frozen regression status

`frozen.test.ts` (14) confirms the hotfix did not disturb Frozen:

- first matching hit cracks ice; capacity is spent on the crack
- the pixel stays solid; exposure never treats a Frozen cell as empty
- a later matching hit clears the thawed pixel and wins
- `boardFingerprint` / `stateKey` distinguish iced from thawed; thawed ≡ plain
- the solver models the extra required hit; under-capacity is proven unsolvable
- two charges in one epoch cannot double-spend a Frozen layer (one crack, one
  clear, never a double claim)
- the trace separates `FROZEN` breaks from `PIXEL` clears
- the tutorial cue is on Level 21 only (`levelDefinitions.test.ts`)

The Frozen fixtures in `admission-consistency.test.ts` further confirm
`enumerateActions ⟺ resolveAction` on Frozen boards.

## 10. Verification

- `npx jest` — **46 suites / 622 tests, all pass** (was 582 at M4A: +39
  admission-consistency, +1 frozen `stateKey`). No mechanic assertion weakened.
- `npx tsc --noEmit` (strict) — clean.
- `npx eslint .` — clean.
- `npx expo-doctor` — **21 / 21**.
- `npx expo export -p web / ios / android` — all succeed (`dist/m4a1-*`).
  Native bundles: 0 Studio symbols; `candidateActions` is present (pure engine
  code, as intended).
- `batchValidate` (all 30 + manifest): **ok, 0 errors, 9 advisory warnings**
  (all `meta/*-tuned`). `validateManifest`: **ok, 0 errors**.
- Full `analyzeLevel` audit L1–30: all `solvable === true`, all `complete`.
- No device testing (standing project caveat).

## 11. Known risks / deferred to M4B

1. **World 2 / World 3 mid-levels top out at Medium.** The M2B 5-charge concurrent
   epoch resolves nested single-colour cascades in one lap, so a punishing Hard
   needs either the concentric-multi-ring shape (L10) or the Frozen
   crack-then-clear-across-epochs structure (L26/29/30). L28's tight crystal
   cannot reach Hard without an art change.
2. **No deadlock-based fail paths on L20 / L29 / L30.** Exact per-colour budgets +
   "every Frozen hit advances the pixel" make a wasted charge impossible.
   Deliberate deadlock windows (over-budget colours, disconnected regions) are an
   M4B redesign item.
3. **L5 authored Easy / suggests Medium.** A retune to a hard sub-20 score needs
   an art change to reduce burial depth; kept Easy per Part 6 since it *behaves*
   easy.
4. `isLost` remains plain-only. A state that is only escapable by joining a
   still-open epoch is reported as a deadlock. This matches shipped M2B behaviour
   and M1 compatibility; revisit only with a deliberate design decision.

**Do not merge. Do not push.**
