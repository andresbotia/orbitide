# M3B — Solver Analytics & Difficulty Tooling

Branch `milestone/1-core-prototype`. Builds on M3A. **Not merged, not pushed.**

M3B turns the one real solver into a practical, deterministic level-design
analysis system inside Level Studio. It does not change gameplay rules, touch
backend/monetization, or start M4 campaign authoring.

Commits: `93a0819` (M3B.1 solver + trace) · `5193282` (M3B.2 analysis model) ·
`8ef98f4` (M3B.3 Studio analytics UI + batch tooling).

> **Update — FIRST LAUNCHED, FIRST SERVED canonicalization (2026-09-18).**
> With `LAUNCH_SPACING` = one lap, a launch that joins Pals already on the rail
> resolves exactly like the same launch made after the rail settles (proven over
> every reachable join in `join-settle-equivalence.test.ts`). Joining is therefore
> **not a puzzle choice**, and the analytics no longer treat it as one:
>
> - The solver searches **logical choices only** (settle-first launches) and
>   memoizes on the **logical state** (board progress + queues + Holding; the
>   epoch is bookkeeping). `SolveOptions.mode` is gone.
> - `analyzeLevel` runs **one** solve. `sequentialResult` / `concurrentResult` /
>   `comparison` (§5) are replaced by a single `solveResult`.
> - `nodes`, `avgBranching`, `lossProbability`, choice metrics and viable
>   choices are defined over logical choices, so join twins are no longer
>   double-counted (L4: 19 913 explored states → 999).
> - A move that loops back onto the current line — a Core V2 Holding relaunch
>   that clears nothing and returns to the same logical state — is neither
>   progress nor a loss: it is excluded from `lossProbability` (uniform random
>   play just picks again) and can never appear in a fail path. It used to count
>   as a certain loss, which inflated Core V2 loss rates (L2 → 0.000, L3 → 0.125,
>   L4 → 0.000, L5 → 0.083 now) and produced "fail paths" that replayed to
>   `playing`, not `lost`. A state where every move loops is a soft-lock and
>   counts as lost. Legacy V1 has no such loops (a held relaunch needs a target).
> - `concurrencyGap` is **retired** (it had become 0 for every level); the other
>   weights keep their values, so no score moved from the retirement — they now
>   sum to 0.95.
> - `CONCURRENCY_TRIVIALIZES_LEVEL` / `CONCURRENCY_INCREASES_RISK` are retired.
> - Every solver- or policy-derived "max active" / Active-utilization field is
>   retired. **Active-slot pressure and Pals sharing the rail are presentation /
>   game feel** — the live session still launches concurrently — not solver
>   branches or puzzle resources.
>
> The sections below are updated accordingly; §10 is kept as a historical
> snapshot of the M3B-era numbers.

---

## 1. `LevelAnalysis` model

`src/game/studio/analysis/` — pure, no React/RN. `analyzeLevel(def, opts)` →
`Promise<LevelAnalysis>`. Every number comes from `engine/solver.ts` and
`engine/trace.ts`; this layer only *composes* them.

| field | meaning |
|---|---|
| `levelId`, `title` | identity |
| `complete` | `false` if the solve hit the node cap |
| `limitations[]` | human notes about what is approximate / unknown |
| `solvable` | `true` \| `false` \| `'unknown'` (node-cap truncation ⇒ unknown, never `false`) |
| `difficulty` | `DifficultyAssessment` (authored, suggested, score, factors, contributions, mismatch, mismatchTiers) |
| `authoredDifficulty` / `suggestedDifficulty` / `difficultyScore` | flat accessors |
| `winningWitness` / `failWitness` | `GameAction[] \| null` — the shortest winning / failing lines |
| `winningTrace` / `failingTrace` | `Trace \| null` — full frame-by-frame replay (the visualisers) |
| `shortestWinningLength` | moves on the winning witness |
| `peakHoldingOnWinningLine` / `heldRelaunches` | witness observations |
| `maxHoldingObserved` / `exploredNodes` / `avgBranching` | whole-graph observations (logical states / choices) |
| `solveDurationMs` | wall-clock (excluded from determinism comparisons) |
| `lossProbability` | loss rate when every logical choice is taken uniformly at random |
| `totalFirstMoves` / `viableFirstMoves` | counts |
| `firstMoveAnalysis[]` | `FirstMoveAnalysis` per legal first move (below) |
| `solveResult` | `SolveSummary` of the one canonical solve |
| `holdingPressure` | `HoldingPressure` (below) |
| `warnings[]` | `AnalysisWarning` (below) |

`BatchRow` is a light slice of the above (no traces) for the batch table.

### Solver extensions (M3B.1, `engine/solver.ts`)

`SolveResult` gained, backward-compatibly:
- `firstMoves: FirstMoveStat[]` — one per legal first action: `solvable`,
  `winLength` (shortest remaining), `minPeakHolding`, `lossAfter`,
  `peakHoldingOnLine` / `heldRelaunchesOnLine` (replaying the
  shortest continuation). Computed from the child subtrees the search already
  memoizes — negligible cost.
- `totalFirstMoves`, `avgBranching` (mean logical choices per explored state).
- `nodeCapHit` + `complete`; `opts.partialOnCap` salvages counters instead of
  throwing `NodeCapExceeded`.

### Witness trace (M3B.1, `engine/trace.ts`)

`traceActions(level, GameAction[]) → Trace` replays through `createGame` +
`resolveAction` only. Per step: action + label + source, `joined`, launched
charge (start/remaining capacity, `landed`), `activeCount`, Holding before/after,
`clearedPixelIds`, `newlyExposedPixelIds`, `remainingPixels`, `status`,
`accepted`/`rejection`. Trace-level: `frames[]`, `outcome`
(`won`\|`lost`\|`incomplete`\|`rejected`), `unusedChargeIds`, `unusedCapacity`.
Frame-for-frame equal to a direct engine replay (tested).

---

## 2. Difficulty formula (`analysis/difficulty.ts`)

Advisory only — the authored difficulty is **never** overwritten.

```
factor_i        ∈ [0, 1]
contribution_i  = DIFFICULTY_WEIGHTS[i] × factor_i × 100
score           = round( Σ contribution_i )                 ∈ [0, 95]
suggestedTier   = highest TIER_THRESHOLDS entry with score ≥ min
```

### `DIFFICULTY_WEIGHTS` (sum = 0.95 — `concurrencyGap` retired)

> **TODO (difficulty recalibration):** the 0.95 total is intentional. Retiring
> `concurrencyGap` moved no score; renormalising the rest to 1.0 would raise
> every score by ~5% without any level changing. It stays at 0.95 until a
> dedicated difficulty-model recalibration revisits the weights, saturation
> points and tier thresholds together.

| factor | weight | normalised value |
|---|---|---|
| `holdingPressure` | 0.22 | `minWinningPeak / holdingCapacity` |
| `lossProbability` | 0.20 | `lossProbability` (already 0–1) |
| `narrowFirstMoves` | 0.16 | `1 − viableFirstMoves / totalFirstMoves` |
| `heldRelaunches` | 0.12 | `heldRelaunches / 3` |
| `winningLength` | 0.11 | `shortestWinningLength / 14` |
| `exposureDepth` | 0.10 | `clearsBeforeDeepestColourOpens / 14` |
| `solverNodes` | 0.04 | `log10(nodes) / log10(60000)` |

All normalised values are clamped to `[0, 1]`. `DIFFICULTY_SATURATION` holds the
denominators (`winningLength 14`, `heldRelaunches 3`, `exposureDepth 14`,
`solverNodes 60000`).

### `TIER_THRESHOLDS` (ascending score → tier)

| tier | score ≥ |
|---|---|
| easy | 0 |
| medium | 20 |
| hard | 42 |
| super-hard | 63 |
| extreme | 82 |

Features are read from the one canonical solve over logical choices.

---

## 3. First-move classification (`analysis/firstMoves.ts`)

Deterministic — three rules against `FIRST_MOVE_THRESHOLDS`.

- **DEAD-END** — no solution exists after this move.
- **DANGEROUS** — solvable, but materially worse than the best solvable sibling
  on ≥ 1 of: `winLength` (≥ **3** longer), `peakHolding` (≥ **1** higher),
  `lossAfter` (≥ **0.15** higher).
- **VIABLE** — solvable and not materially worse (this always includes the best
  move; a lone solvable move is VIABLE).

"Best" = the solvable first move minimising `(winLength, peakHolding, lossAfter)`
lexicographically.

---

## 4. Warning rules (`analysis/warnings.ts`)

All advisory (`info` \| `warn`), never blocking. Thresholds in
`WARNING_THRESHOLDS`.

| code | fires when |
|---|---|
| `TRIVIAL_FIRST_MOVES` | ≥ 2 first moves and ≥ 90 % are VIABLE with ≤ 1 peak Holding and ≤ 0.1 loss. `info` if authored easy, else `warn`. |
| `NO_HOLDING_PRESSURE` | authored medium+ and `solve.minWinningPeak = 0` and `solve.heldLaunches = 0`. |
| `NARROW_EASY_LEVEL` | authored easy and ≤ 1 viable first move. |
| `LOW_BRANCHING_HARD_LEVEL` | authored hard+ and `avgBranching < 1.7`. |
| `EXCESSIVE_UNUSED_CAPACITY` | ≥ 40 % of authored tunnel capacity is unused on the winning line. |
| `UNUSED_QUEUE_ENTRIES` | an authored charge never launches on the winning line. (`info`) |
| `SOLVER_NODE_EXPLOSION` | ≥ 60 000 explored states. (`info`) |
| `DIFFICULTY_MISMATCH` | \|suggested − authored\| ≥ 2 tiers (`warn`); exactly 1 tier (`info`). |
| `NO_FAIL_PATH` | authored medium+, complete, solvable, no failing line exists. |
| `EARLY_DEADLOCK` | shortest failing line ≤ 2 moves. |

---

## 5. Sequential vs concurrent comparison — RETIRED

Retired with the FIRST LAUNCHED, FIRST SERVED canonicalization (see the update
at the top): a join reaches the same logical state as a settle-first launch, so
the two solves were one search and every delta below was identically zero.
Historical description:

Ran `solve` in both `sequential-compat` and `metrics` mode. Reported
`winLengthDelta` (seq − con), `peakHoldingDelta`, `viableFirstMoveDelta`,
`maxActiveDelta`, `nodeDelta`, `lossDelta` (seq − con), and a `verdict`:

- `concurrency-required` — sequential play cannot solve it, concurrent can.
- `concurrency-helps` — shorter / lower Holding / safer, and not also worse.
- `concurrency-hurts` — higher loss or higher max Holding, and not also better.
- `concurrency-mixed` — both.
- `equivalent` — neither.

Concurrency difference is a **design signal**, not automatically bad.

---

## 6. Holding-pressure metrics (`analysis/holdingPressure.ts`)

Measured over the winning trace in **action steps** (never wall-clock):
`timeline[]` (occupancy after each step), `maxHolding`, `stepsAtOrAbove2`,
`fractionAtOrAbove2`, `manualRelaunches`, `chargesEnteringHolding`,
`longestHeldDurationSteps` (longest a charge sat in Holding before relaunch/end).

---

## 7. Batch campaign analysis (`analysis/batch.ts`)

`analyzeBatch(defs, { nodeCap, signal, onProgress, now })` → `BatchResult`
(`rows: BatchRow[]`, `complete`, `cancelled`). Yields between levels; a flipped
`signal.cancelled` (checked before each level and caught from a mid-level
`SolverCancelled`) stops it and returns partial rows.

---

## 8. Performance

- One `analyzeLevel` = **one canonical solve** + 2 trace replays + a first-move
  replay pass. (The M3B-era figures below were measured with two solves; the
  canonical search is ~10–50× smaller on the same levels.) On the campaign: L1–L4 well under 1 s each;
  L5–L10 ~1–4 s; L6 / L9 ~4–6 s (they explore ~78–79 k states).
- The whole campaign audit (`analyzeBatch(LEVEL_DEFINITIONS)`) is roughly
  **45–60 s** — the sum of the per-level solves, unchanged from M2B's audit
  because the solver graph is the same; M3B adds only the cheap first-move /
  trace passes on top.
- `analyzeLevel` yields (`await`) between its six phases, so cancellation lands
  within a phase and the batch stays responsive between levels. **Within one
  `solve` traversal the call is still synchronous** — bounded by `nodeCap`. A
  Web Worker was considered and deferred (§11).

### Node-cap semantics

- Default cap `200 000` (Studio) / `300 000` (solver default).
- Cap hit ⇒ `partialOnCap` salvages counters; `complete = false`,
  `solvable = 'unknown'`, a `limitations[]` note. **A level is never reported
  unsolvable just because the cap was hit.**
- First-move analysis is unavailable on a truncated run (documented in
  `limitations`).

---

## 9. Cancellation

`opts.signal = { cancelled: boolean }` threaded into every `solve` call (checked
every node) and checked between analysis phases and batch levels. Flipping it
aborts with `SolverCancelled`, which `analyzeBatch` catches to return partial
results and the Studio surfaces as "cancelled".

---

## 10. Levels 1–10 analysis (current campaign)

**Historical snapshot (M3B era, pre-FLFS).** Produced by the then-concurrent
`analyzeLevel` (injected zero clock); the "max active" column is no longer computed.
**Advisory — the campaign is NOT auto-edited from this.**

| L | title | authored | suggested | score | solvable | shortest win | peak Holding | viable 1st | max active | nodes | warnings |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Moon | easy | easy | 3 | yes | 3 | 0 | 3/3 | 3 | 16 | TRIVIAL_FIRST_MOVES(i) |
| 2 | Star | easy | easy | 10 | yes | 4 | 0 | 3/3 | 4 | 49 | TRIVIAL_FIRST_MOVES(i) |
| 3 | Small Planet | easy | easy | 16 | yes | 5 | 0 | 3/3 | 5 | 166 | — |
| 4 | Rocket | easy | medium | 27 | yes | 5 | 1 | 3/3 | 4 | 257 | TRIVIAL_FIRST_MOVES(i), DIFFICULTY_MISMATCH(i) |
| 5 | Comet | easy | medium | 30 | yes | 7 | 1 | 3/3 | 5 | 18 407 | DIFFICULTY_MISMATCH(i) |
| 6 | Ringed Planet | easy | **hard** | 54 | yes | 10 | 2 | 3/3 | 5 | 79 165 | SOLVER_NODE_EXPLOSION(i), **DIFFICULTY_MISMATCH(w)** |
| 7 | Satellite | easy | **hard** | 57 | yes | 9 | 2 | 3/3 | 5 | 17 296 | **DIFFICULTY_MISMATCH(w)** |
| 8 | Nebula | easy | **hard** | 60 | yes | 10 | 2 | 3/3 | 5 | 16 796 | **DIFFICULTY_MISMATCH(w)** |
| 9 | Constellation | medium | hard | 52 | yes | 10 | 2 | 3/3 | 5 | 78 118 | SOLVER_NODE_EXPLOSION(i), DIFFICULTY_MISMATCH(i) |
| 10 | Eclipse | hard | hard | 58 | yes | 10 | 2 | 3/3 | 5 | 11 136 | — |

**Reading:** L1–3 and L10 match their labels. L4–L5 are one tier above their
`easy` label (Holding enters at L4). **L6–L8 are two tiers above `easy`** — they
carry 48–74 % random-play loss and 2 peak Holding — the model flags them as
mislabeled (a known campaign-tuning item for M4). L9 is one tier above `medium`.
Concurrency shortens L5/L8/L9 by one move but never trivialises a level and
never makes the campaign unsolvable sequentially.

---

## 10a. Studio UI (M3B.3)

The Studio screen gains a tab bar (`StudioTabs`): **EDITOR · ANALYSIS · WIN PATH
· FAIL PATH · BATCH**. The M3A "Solver" rail section is removed — its data now
lives in ANALYSIS. Play / Export stay on the bottom action bar.

- `useLevelAnalysis(level, exportable)` — one controller shared by ANALYSIS /
  WIN / FAIL / BATCH. `run()` / `cancel()` for the single-level analysis (tagged
  to the level, so an edit marks it `stale`); `runBatch(defs)` / `cancelBatch()`
  with `batchProgress`. Never runs on an edit. `runId` increments per completed
  run and is the remount key for the visualisers.
- `AnalysisPanel` — Run/Cancel + live phase; then verdict (solvable, authored,
  suggested, score), difficulty-factor bars (points of 100), first-move table
  (VIABLE/DANGEROUS/DEAD-END + reasons), the solver summary, a Holding
  timeline strip + metrics, and the warnings list (`■` warn / `▲` info).
  Incomplete runs show their `limitations` banner.
- `WitnessVisualizer` + `TraceBoard` — Prev / Next / Restart / Play Through over
  the real `Trace`. Each board is `trace.frames[i]` (a real `GameState`);
  cleared pixels are ringed amber, newly-exposed green. Per-step detail: action,
  source, charge (start→remaining capacity, landed), active count, Holding
  before→after, cleared / newly-exposed ids, pixels left, status. End-of-line:
  outcome, unused charges/capacity, and for a fail line, why no progress
  remains.
- `BatchPanel` — "Analyze Levels 1–10" with progress + cancel; a sortable
  table (press a header) and filters (all / mismatch / unsolvable / warnings,
  plus a difficulty filter). Mismatched rows and non-zero warning counts are
  highlighted.

Tests (+1 suite): `useLevelAnalysis` run→done→stale, cancel, batch completion
(react-test-renderer, no RN import). Studio component render paths remain
outside the jest harness (consistent with M2A/M2B/M3A); the pure analysis layer
that carries the logic is fully covered.

## 11. Known limitations

- **UI blocks during one solve traversal.** The analysis is chunked at
  phase/level granularity, not node granularity. A Web Worker for the Studio web
  build was deferred — Metro worker bundling adds meaningful scope for a
  dev-only tool, and cancellation already lands within milliseconds because
  `solve` checks the signal every node.
- The difficulty formula is calibrated against the 6 analysis fixtures **and**
  Levels 1–10; it is advisory and will be re-tuned in M4 against real playtest
  fail/retry data.
- `exposureDepth` saturates for almost every real (buried-centre) level — it
  functions as a near-constant baseline rather than a discriminator on the
  current campaign.
- Holding-first-move colour/capacity in `firstMoveAnalysis` is reported as
  `white`/`0` — the campaign never has a Holding charge available at move 1, so
  there is no live state to read; a real mid-game "what if" explorer is M3C.
- `lossProbability` assumes uniform random action choice; it is a relative
  signal, not a real player model.

---

## 12. Deferred to M3C

Special-pixel editing/analysis (Frozen/Shielded/…); `revealNodes`/`revealLines`/
`accentNodes`; world/set grouping; level duplication/variation; thumbnails;
mass campaign authoring; a mid-game "explore from this state" tool; a Web-Worker
solver; per-node progress reporting.

**Do not merge. Do not push.**
