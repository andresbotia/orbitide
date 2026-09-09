# M2B — Five simultaneous active orbits + shared board arbitration

Branch `milestone/1-core-prototype`. Commits:
`4d9435f` (M2B.1 engine) · `b057f17` (M2B.2 solver) · M2B.3 presentation (this
commit). Builds on M2A.4 `b8efb67`. **Not merged, not pushed.**

This is the first M2 pass allowed to change active-charge runtime behaviour. The
visual system, special-pixel mechanics, backend / monetization / economy are all
untouched.

---

## 1. What the player can now do

Launch another tunnel or Holding charge while charges are already orbiting, up to
`MAX_ACTIVE_CHARGES = 5`. All charges share one board centre, one LAUNCH_HUB
waypoint, one bottom ORBIT_INSERTION, one canonical direction
(bottom → left → top → right → bottom) and one rail. They never collide.

A launch fired while charges are still on the rail **joins the running epoch** and
arbitrates against them. A launch fired after the board has settled starts a
**fresh epoch** and resolves exactly like M1. That "now vs after it settles" is
the only way launch timing affects the outcome — there is no reflex timing.

---

## 2. Engine concurrency model (`src/game/engine/`)

### Logical time
One shared logical clock, unit = **orbit laps**. `1 lap == FEEL.ORBIT_DURATION`
(1800 ms) is presentation only — the engine never reads wall-clock time. A charge
inserted at `insertionTime` is at lap-progress `t - insertionTime` at logical
time `t`, and still does **at most one lap per launch** (leftover capacity parks
in Holding; targets exposed *behind* a charge wait for a manual relaunch — the M1
rule, preserved).

### Launch-timing semantics — deterministic action sequencing (spec §7 B)
Each accepted launch gets:
- `launchSequence` — global monotonic order (`= movesApplied` at acceptance);
- `insertionTime = index * LAUNCH_SPACING` within its epoch (`LAUNCH_SPACING =
  0.18` lap). Five rapid launches insert at `0, 0.18, 0.36, 0.54, 0.72` —
  evenly spread around the ring. **Real tap timing is never read**; only launch
  order, count, and the coarse join/settle choice matter, so the solver
  reproduces every outcome.

### Epoch = arbitration container (`epoch.ts`)
`GameState` gains `activeCharges: ActiveCharge[]` and `epoch: EpochState | null`.
`EpochState = { baseline: GameState, launches: EpochLaunch[], clock }` — replaying
`launches` against `baseline` reproduces the current state exactly.

`resolveAction(state, action)`:
1. admit (`actionRejection`) — the engine always accepts a launch; a sixth just
   opens a fresh epoch. Holding-full look-ahead projects the whole epoch.
2. `planLaunch` — join the open epoch iff `action.join === true` **and**
   `canJoinEpoch` (epoch exists, < 5 launches, this charge not already in it);
   otherwise fresh, `baseline = committedBaseline(state)`, `insertionTime = 0`.
3. `simulateEpoch(baseline, launches)` — deterministic discrete-event resolution.
4. `flushEpoch` — apply the board, consume the launched tunnel fronts / held
   charges, park leftovers in Holding, keep the epoch attached, recompute status.

`LaunchOutcome` keeps the M1-shaped `pass` (the launched charge's own resolution)
for the single-flight presentation path and adds `epochCharges` + `joinedEpoch`.

### Arbitration algorithm — `simulateEpoch`
Pure discrete-event simulation over the epoch's charges:
- One cursor per charge (`cursorTime`, `progress`, `remaining`).
- `simTime` = logical time reached. Every still-orbiting charge keeps flying, so a
  charge that has not hit anything is nonetheless at lap-progress
  `simTime - insertionTime` — a target exposed late is met there, not back where
  the charge was when it launched.
- Each step: for every not-finished charge compute its next **EncounterCandidate**
  against the *current* board — reused verbatim from M1 (`pickEncounter`:
  reachable matching pixels, nearest angular gap ahead, outer radius then id).
  `candidateTime = insertionTime + gap`.
- **Select the next global encounter:** smallest `candidateTime`
  (± `ENCOUNTER_EPSILON = 1e-6` lap), then smaller `launchSequence`, then smaller
  target pixel id.
- Resolve one clear: mutate the board, decrement **only that charge**, record the
  encounter, `remaining == 0` → finished.
- **Exposure recompute is implicit** — the next step's candidates read the
  mutated board, so a clear by Blue that exposes a Red pixel is picked up by Red
  later in the same lap.
- Terminates: each step clears one pixel or finishes ≥1 cursor.

`pickEncounter` was factored out of M1's `advancePass`; a lone fresh launch's
`simulateEpoch` result is byte-identical to `resolvePass` (asserted).

### Target claiming / invalidation
No explicit reservation state: `simulateEpoch` resolves one encounter fully
before computing the next, so two charges can never clear the same pixel, and a
candidate whose target was just cleared by another charge is simply not offered
next step (the charge re-evaluates, no capacity spent).

### Re-simulation on join
A join re-runs `simulateEpoch` for the whole epoch from `baseline`. This is fully
deterministic (same inputs → same output) and can, in rare cases, revise a
not-yet-presented encounter of an earlier charge (a later charge reaching a
shared target sooner in logical time). `LAUNCH_SPACING` keeps an epoch short
(≤ ~1.9 laps ≈ 3.4 s), so any such revision lands before the player has seen it;
the presentation's per-flight `settle()` reconciles `view` to `truth` regardless.

### Win / fail / deadlock
- **Win** the instant `simulateEpoch` clears the last pixel, even mid-epoch;
  further launches are refused; presentation lets the other flights settle and
  the existing Discovery Reveal fires off `status === 'won'` unchanged.
- **Deadlock** unchanged — a resolved epoch already parks its leftovers, so the
  flushed state reads like M1 and `isLost` / `legalActions` apply directly. The
  five-charge cap is a presentation gate only, never a loss condition.

### Caches
`reachablePixels` (exterior flood fill) and `simulateEpoch` (epoch physics) are
memoized by board shape / `(baseline, launches)` — the concurrent engine and the
solver hit the same shapes thousands of times. Bounded, cleared wholesale when
full; the sim cache stores colour/capacity-only physics and re-labels charge
identity per call.

---

## 3. Active-charge state model

```
ActiveCharge {
  id  source  originId  color
  capacity  remainingCapacity
  insertionTime  launchSequence  passCount
  phase           // 'orbiting' | 'finished' (always 'finished' post-sim)
  encounters[]    // { pixelId, time, progress, remaining }
  finishTime      // last encounter, or insertionTime + 1 for a full lap
  landed          // 'consumed' | 'holding'
}
```

No global "current target", "current pass timer" or "projectile" — each charge is
fully self-describing.

### Active-slot lifecycle (spec §20)
A slot is occupied from **launch acceptance** (not insertion — closes the
"launch six before insertion" exploit) until the presentation flight's `complete`
fires. `epoch.launches.length` is the engine's slot count; a fresh epoch resets
it to 1. Presentation additionally denies a launch while five flights are still
visibly airborne.

### Holding with active charges
Holding stays fully manual. A held charge may be relaunched into a running epoch
(`join: true`) as long as it is not already in that epoch; otherwise the relaunch
starts fresh. A full tray plus a still-useful launch is never a loss.

---

## 4. Presentation (`src/hooks`, `src/game/rendering`, `src/game/presentation`)

### Per-charge flight, one clock each (spec §28 decision)
Kept the M2A per-pass UI-thread clock and multiplied it: `useGameSession` holds a
`Map<passId, ActiveFlight>` and publishes `flights: FlightPass[]`;
`OrbitBoard` renders one `<FlightActor>` per flight, each owning its own linear
`withTiming(0 → totalMs)` clock and its own animated-reaction bridge to
`presentThrough`. A shared epoch clock was evaluated and rejected: a joined
charge's lift choreography begins at the tap, not at its normalized logical
insertion, so independent clocks are the *more* correct choice and avoid
re-timing running flights on every join.

`buildLaunchScript` is unchanged and reused for both fresh and joined launches —
each flight scripts only the launched charge's own encounters, in its own
0-based timeline.

- `OrbitBoard` → static `<BoardActors>` (pixels / special shells / Color Assist,
  no clock) + `flights.map(<FlightActor>)`. Pixels an active flight will pop are
  rendered by that flight, not the static layer, so the pop keeps its clock.
- **Lane offset (spec §12):** `laneOffset(i)` nudges each charge's *rendered*
  radius by `… −2, 0, +2, −2 …` px (`LANE_OFFSET_PX = 2`), threaded through
  `flightPosition(pass, layout, time, radialOffset)`. Engine angle is untouched.
- **Calm mode (spec §14):** at `flights.length >= 3` the halo and both trail
  layers drop to 55 % opacity so five charges do not become neon soup; capacity
  numbers keep full contrast.
- **Projectile concurrency (spec §15):** one `<EnergyShot>` per flight, each with
  its owning `passId`, target pixel, source and destination — no singleton, no
  engine event dropped.

### Session flow
`perform`: deny if `activeCount >= 5` (message + `denied` haptic, no mutation);
otherwise resolve with `join = activeCount > 0`, build the flight, add to the
map. `presentThrough(passId, count)` walks that flight's events, mutates `view`,
routes routine pixel haptics through the arbiter and per-shot sound hooks; on the
flight's `complete` it retires; when the last flight retires it settles `view` to
`truth` and reports the result once. `restart` / background / unmount retire every
flight and cancel pending haptics + buffered pulses.

`GameSession` now exposes `flights`, `flightPass` (last, back-compat),
`canLaunch`, `activeCount`. `GameScreen` keeps the controls **open** while
charges orbit — `controlsLocked = !session.canLaunch`.

---

## 5. Haptic arbitration (`src/game/hapticArbiter.ts`, spec §16)

Routine pixel impacts from concurrent charges are coalesced:

| cluster within `COALESCE_WINDOW_MS = 45` | pulse |
|---|---|
| 1 hit | `pixelPop` (Rigid) |
| 2 hits | `pixelCombo` (Medium) |
| 3+ hits | `pixelBurst` (Heavy, capped) |
| any final clear in the cluster | `finalClear` (Heavy) — always wins |

45 ms is the only latency added to a routine hit and is below "same beat"
perception. High-priority cues (Holding land, warning, full, win, fail, held
relaunch, denied) are **not** routed through the arbiter — they fire directly and
are never swallowed. `cancelHits` drops a buffered pulse on teardown.

---

## 6. Sound concurrency hooks (spec §17) — production guidance, no assets

`feedback.emit(event, { haptic, voice })`. `voice: 'shot'` tags per-shot
transients; `voice: 'orbit'` is reserved for the ambient layer. The mixer, when
it exists, must:

- keep **one shared orbit-hum loop regardless of active-charge count** — never
  one loop per charge;
- allow **at most 3 simultaneous identical shot voices**; additional shots within
  a short window duck / merge into the existing transient bed;
- let distinct per-shot transients overlap otherwise.

This resolves the M2 spec's open "5-charge audio ceiling" question.

---

## 7. Dev overlay (spec §31)

`DebugOverlay` (`__DEV__` only) gains `active N/5`, `epoch clock`, and per-charge
lines: `#seq colour remaining/capacity @insertionTime → finishTime landed`.

---

## 8. Solver (`src/game/engine/__tests__/solver.ts`)

- `stateKey` gains an epoch-residue segment (`epochResidueKey`) so equivalent
  boards with different epochs never memoize together; reduces to the M1 key when
  the rail is idle.
- `solve(level, { mode })`:
  - `metrics` (default) — from every epoch-open state, explore both a settle-first
    launch and a `join: true` variant; report `maxActiveOnWitness`, `maxActive`,
    plus all M1 metrics.
  - `sequential-compat` — drop the join variants; reproduces M1 exactly.
  - `solvability` — bare win proof.
- Pruning: branching is unchanged (≤ 6 launches/step — timing is forced, not
  branched). Node counts rise (L9 ≈ 39 k) but stay well under the 300 k cap.
  Memoization + the two engine caches keep the campaign audit ≈ 60 s.

### Level 1–10 audit (unchanged art; no capacity/order retune was needed)

`seq` == M1. `con` = concurrent engine.

| L | pixels | seq len / minPeak / loss / held | con len / minPeak / loss / held | maxActiveOnWitness | maxActive |
|---|---|---|---|---|---|
| 1 | 20 | 3 / 0 / 0 / 0 | 3 / 0 / 0 / 0 | 1 | 3 |
| 2 | 21 | 4 / 0 / 0 / 0 | 4 / 0 / 0 / 0 | 1 | 4 |
| 3 | 25 | 5 / 0 / 0 / 0 | 5 / 0 / 0 / 0 | 2 | 5 |
| 4 | 25 | 5 / 1 / 0 / 1 | 5 / 1 / 0 / 1 | 1 | 4 |
| 5 | 33 | 8 / 1 / .134 / 1 | 7 / 1 / .136 / 0 | 2 | 5 |
| 6 | 37 | 10 / 2 / .481 / 2 | 10 / 2 / .481 / 2 | 1 | 5 |
| 7 | 37 | 9 / 2 / .676 / 2 | 9 / 2 / .676 / 2 | 3 | 5 |
| 8 | 37 | 11 / 2 / .741 / 3 | 10 / 2 / .741 / 2 | 3 | 5 |
| 9 | 33 | 11 / 2 / .5 / 2 | 10 / 2 / .5 / 1 | 4 | 5 |
| 10 | 32 | 10 / 2 / .704 / 2 | 10 / 2 / .704 / 2 | 3 | 5 |

- Sequential numbers are identical to the approved M1 audit — losses, fail paths
  (present from L5), `viableFirstMoves == 3`, Holding entering at L4.
- Concurrency never breaks a level: every level stays winnable and, from L5,
  loseable. It opens a few shorter / hold-lighter lines on L5, L8, L9 (an
  alternative, not a replacement — the sequential line always survives).
- No early level *requires* multiple active charges — the calmest winning witness
  uses at most 2 (L3, L5) and the campaign's shortest witnesses stay ≤ 4.
- The engine can drive a full five-charge rail on L3 and L5–L10.

---

## 9. Verification

- `npx jest` — **175 passed / 17 suites** (was 145 / 15). New: `concurrency.test`
  (18), `hapticArbiter.test` (7). No existing assertion weakened; `session.test`
  and `metrics.test` re-baselined for concurrency (both still assert M1 parity
  via `sequential-compat`).
- `npx tsc --noEmit` (strict) — clean.
- `npx eslint .` — clean.
- `npx expo-doctor` — 21/21.
- `npx expo export -p ios` / `-p android` — both succeed (`dist/m2b/`).
- Not run on device (no simulator here).

---

## 10. Performance

- No per-frame JS loop, no per-frame React `setState`: each flight commits engine
  events only on `eventCountAt` boundary changes (animated reaction), exactly as
  M2A did — now × N flights.
- Projectiles / trails / pop pixels are all reanimated shared-value driven on the
  UI thread; each flight cleans up (`cancelAnimation`) on unmount, which happens
  deterministically when its `complete` event retires it.
- Static board (`BoardActors`) is `memo`'d and no longer remounts per pass.
- 5 flights = 5 clocks + 5 reactions + ≤ 5 `<OrbitingCharge>` + one
  `<EnergyShot>` each + their pop pixels. Conceptually within budget for a
  40–100-pixel board with Color Assist on; **unverified on device** (standing
  M2A caveat).

---

## 11. TUNABLE values

| value | where | default |
|---|---|---|
| `MAX_ACTIVE_CHARGES` | `engine/concurrency.ts` | 5 |
| `LAUNCH_SPACING` | `engine/concurrency.ts` | 0.18 lap |
| `ENCOUNTER_EPSILON` | `engine/concurrency.ts` | 1e-6 lap |
| `COALESCE_WINDOW_MS` | `game/hapticArbiter.ts` | 45 ms |
| audio identical-voice cap | doc guidance | 3 |
| `LANE_OFFSET_PX` | `rendering/OrbitBoard.tsx` | 2 px |
| `CALM_TRAILS_AT` | `rendering/OrbitBoard.tsx` | 3 charges |
| solver `nodeCap` | `__tests__/solver.ts` | 300 000 |
| cache limits | `engine/epoch.ts`, `engine/pixels.ts` | 250 000 |

---

## 12. Known risks

- **Join re-simulation** can retroactively revise a not-yet-presented encounter;
  bounded to sub-second by `LAUNCH_SPACING`, self-healed by `settle()`. A true
  frozen-past prefix was deferred as unnecessary for correctness.
- **Multi-charge presentation perf** unverified on device (5 clocks + reactions).
- **Solver time** — the concurrent audit is ~60 s; a much larger campaign would
  want the join branch pruned harder or `sequential-compat` as the gating audit.
- Lane offset / calm-mode thresholds are eyeballed, not device-tuned.
- `react-test-renderer` deprecation warning in `session.test` (pre-existing).

**Do not merge. Do not push.**
