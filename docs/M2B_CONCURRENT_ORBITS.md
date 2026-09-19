# M2B — Five simultaneous active orbits

Branch `milestone/1-core-prototype`. Original commits:
`4d9435f` (M2B.1 engine) · `b057f17` (M2B.2 solver) · `9f780b7` (M2B.3
presentation). Builds on M2A.4 `b8efb67`.

> **Engine model superseded — this doc reflects the current engine.** The
> original M2B engine resolved concurrent launches with multi-Pal logical
> arbitration (overlapping laps, re-simulation on join). That was replaced by
> **FIRST LAUNCHED, FIRST SERVED** in `ef8b240` (engine) and `7ca8c75` (solver /
> Studio canonicalisation). §2, §3, §8, §11 and §12 describe the current engine;
> the presentation, haptic and audio sections (§4–§6) are unchanged from M2B.

The visual system, special-pixel mechanics, backend / monetization / economy are
all untouched by M2B.

---

## 1. What the player can do

Launch another tunnel or Holding charge while charges are already orbiting, up to
`MAX_ACTIVE_CHARGES = 5` (per level: `GameState.activeCapacity`). All charges
share one board centre, one LAUNCH_HUB waypoint, one bottom ORBIT_INSERTION, one
canonical direction (bottom → left → top → right → bottom) and one rail. They
never collide.

Several Pals can be **on the rail at once** — that is presentation and game feel
(visual pacing, convoy presentation, Active-slot pressure, Holding arrival
timing). It is **not** a separate logical rule: a launch made while Pals are
still flying resolves exactly like the same launch made after the rail settles.
Launch timing never affects the outcome — only launch **order** matters. There is
no reflex timing.

---

## 2. Engine model — FIRST LAUNCHED, FIRST SERVED (`src/game/engine/`)

### The rule
- Each Pal is logically resolved **exactly once, when it launches**.
- A later Pal resolves against the **committed board** left by earlier launches.
- A later launch may **never rewrite** an earlier Pal's logical history.

Consequences, all deliberate:
- an earlier Pal can expose targets for a later one (forward help);
- a later Pal never helps an earlier one (that would be a rewrite);
- a contested pixel always goes to the earlier launch.

### Logical time
One shared logical clock, unit = **orbit laps**. `1 lap == FEEL.ORBIT_DURATION`
is presentation only — the engine never reads wall-clock time. A charge inserted
at `insertionTime` is at lap-progress `t - insertionTime` at logical time `t`,
and does **at most one lap per launch** (leftover capacity parks in Holding;
targets exposed *behind* a charge wait for a manual relaunch — the M1 rule).

### Launch spacing — non-overlapping windows (`concurrency.ts`)
`LAUNCH_SPACING = 1` lap. Within an epoch, launch `i` gets
`insertionTime = i * LAUNCH_SPACING`, so it owns the logical window `[i, i+1]`
and has flown its whole lap before launch `i+1` acts. Every event of launch `i`
strictly precedes every event of launch `i+1`; earlier launches are fully
resolved before later launches logically act. `simulateEpoch` throws on
overlapping windows.

Do not lower `LAUNCH_SPACING` to "restore concurrency" — the old `0.18` value
interleaved laps and let a join insert a clear *behind* a Pal the player was
already watching (`session.retroactive-join.test.ts` pins the regression).

### Epoch = bookkeeping, not physics (`epoch.ts`)
`GameState` carries `activeCharges: ActiveCharge[]` and
`epoch: { launches: EpochLaunch[], clock } | null`. The epoch is the run of
launches currently sharing the rail: which launches occupy Active slots, the
clock that times the next insertion, and each charge's resolution for the
presentation. Whether a launch joins the open epoch or starts a fresh one never
changes its logical outcome — only those bookkeeping fields.

`resolveAction(state, action)` (`resolveLaunch.ts`):
1. admit (`actionRejection`);
2. `planLaunch` — join the open epoch iff `action.join === true` **and**
   `canJoinEpoch` (epoch exists, below `activeCapacity`, this charge not already
   in it); otherwise a fresh epoch at `insertionTime = 0`;
3. `resolveEpochLaunch(state, newLaunch)` — simulate **only the newly appended
   launch**, against the committed board. Joined launches reuse the
   already-resolved `state.activeCharges`; nothing earlier is re-simulated;
4. `commitLaunch` — apply the board, consume the tunnel front / held charge, park
   leftover capacity in Holding (a parked charge with no Holding room is a loss),
   record the launch in the epoch, recompute status.

`simulateEpoch(baseline, launches)` still exists as a sequential fold (each
launch against the board the previous ones left) for tests and tools; it is not
the live resolution path.

`LaunchOutcome` keeps the M1-shaped `pass` (the launched charge's own resolution)
and adds `epochCharges` (every charge on the rail, new one last) + `joinedEpoch`.

### Per-launch simulation
`resolveEpochLaunch` walks one charge's lap: `pickEncounter` (reachable matching
pixels, nearest angular gap ahead, outer radius then id) → resolve one hit →
mutate the board → re-query exposure, so a clear can expose a target the same
charge reaches later in its lap. Terminates when capacity is spent or the lap is
flown. There is no cross-Pal encounter selection or tie-breaking — a single
launch is simulated at a time.

### Win / fail / deadlock
- **Win** the instant the last pixel clears; further launches are refused;
  presentation lets other flights settle and the Discovery Reveal fires off
  `status === 'won'`.
- **Deadlock** — the committed state reads like M1, so `isLost` /
  `legalActions` apply directly. The five-charge cap is a presentation / slot
  gate, never a loss condition by itself.

### Caches
- **`SIM_CACHE`** (`epoch.ts`) — memoizes single-launch resolutions.
  - **Board-scoped:** it holds one authored board at a time; when
    `boardIdentity` changes (level switch, another Studio draft) it is cleared,
    so unrelated boards never share simulation physics.
  - **Bounded LRU:** `SIM_CACHE_LIMIT = 20_000` entries, least-recently-used
    evicted. It is not an unbounded module-global accumulation across campaign
    play.
  - **Physics-only key:** ruleset + `boardFingerprint` (per-cell progress) +
    launch colour / capacity / `insertionTime`. Source, origin, sequence and
    Active capacity do not affect a launch's own lap, so identical Pals share an
    entry; the cached result is re-labelled with the caller's charge identity.
- **Exterior flood-fill cache** (`pixels.ts`) — keyed by grid size + solid-cell
  occupancy, bounded at 20 000 entries with batch eviction.

---

## 3. Active-charge state model

```
ActiveCharge {
  id  source  originId  color
  capacity  remainingCapacity
  insertionTime  launchSequence  passCount
  phase           // always 'finished' — resolved at launch
  encounters[]    // { pixelId, time, progress, remaining, …modifier flags }
  finishTime      // last encounter, or insertionTime + 1 for a full lap
  landed          // 'consumed' | 'holding'
}
```

No global "current target", "current pass timer" or "projectile" — each charge is
fully self-describing, and its record never changes after it launches.

### Active-slot lifecycle (spec §20)
A slot is occupied from **launch acceptance** (not insertion — closes the
"launch six before insertion" exploit) until the presentation flight's `complete`
fires. `epoch.launches.length` is the engine's slot count; a fresh epoch resets
it to 1. Presentation additionally denies a launch while `activeCapacity`
flights are still visibly airborne. `activeCharges` / epoch data exist to drive
this slot behaviour and the presentation — not logical arbitration.

### Holding with active charges
Holding stays fully manual. A held charge may be relaunched into a running epoch
(`join: true`) as long as it is not already in that epoch; either way it resolves
against the committed board. When its leftover parks back in Holding is a
presentation matter (arrival timing); the logical Holding contents are committed
at launch.

---

## 4. Presentation (`src/hooks`, `src/game/rendering`, `src/game/presentation`)

Presentation may overlap Pals on the rail even though logical resolution is
ordered. Visual concurrency is not logical arbitration.

### Per-charge flight, one clock each (spec §28 decision)
Kept the M2A per-pass UI-thread clock and multiplied it: `useGameSession` holds a
`Map<passId, ActiveFlight>` and publishes `flights: FlightPass[]`;
`OrbitBoard` renders one `<FlightActor>` per flight, each owning its own linear
`withTiming(0 → totalMs)` clock and its own animated-reaction bridge to
`presentThrough`. A shared epoch clock was evaluated and rejected: a joined
charge's lift choreography begins at the tap, not at its logical insertion, so
independent clocks are the *more* correct choice and avoid re-timing running
flights on every join.

`buildLaunchScript` is reused for both fresh and joined launches — each flight
scripts only the launched charge's own encounters, in its own 0-based timeline.

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
`perform`: deny if the Active slots are full (message + `denied` haptic, no
mutation); otherwise resolve with `join = activeCount > 0`, build the flight, add
to the map. `presentThrough(passId, count)` walks that flight's events, mutates
`view`, routes routine pixel haptics through the arbiter and per-shot sound
hooks; on the flight's `complete` it retires; when the last flight retires it
settles `view` to `truth` and reports the result once. `restart` / background /
unmount retire every flight and cancel pending haptics + buffered pulses.

`GameSession` exposes `flights`, `flightPass` (last, back-compat), `canLaunch`,
`activeCount`. `GameScreen` keeps the controls **open** while charges orbit —
`controlsLocked = !session.canLaunch`.

---

## 5. Haptic arbitration (`src/game/hapticArbiter.ts`, spec §16)

Routine pixel impacts from concurrently *presented* charges are coalesced:

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

---

## 7. Dev overlay (spec §31)

`DebugOverlay` (`__DEV__` only) shows `active N/5`, `epoch clock`, and per-charge
lines: `#seq colour remaining/capacity @insertionTime → finishTime landed`.

---

## 8. Solver (`src/game/engine/solver.ts`)

`engine/__tests__/solver.ts` re-exports this module. There is **one** solver and
**one** canonical solve per level.

- **Canonical logical choices.** `enumerateActions` = `legalActions(state)`: one
  settle-first launch per tunnel front and per held charge the runtime would
  admit. A `join: true` twin reaches the same next logical state, so joins are
  **not** separate puzzle branches (`join-settle-equivalence.test.ts`).
- **Memo identity = committed logical state.** `stateKey` is board progress
  (`boardFingerprint`, including modifier layers) + tunnel queues (id / colour /
  capacity) + Holding. Terminal status (`won` / `lost`) short-circuits before
  keying. Open-epoch presentation residue — which Pals are still on the rail,
  the epoch clock, insertion times — is **not** part of solver identity.
- **No-op loops are not losses.** A move that returns to a logical state already
  on the current search line (e.g. a Core V2 Holding relaunch that clears
  nothing) is excluded from win, fail and loss-probability accounting — uniform
  random play simply picks again.
- **All-loop states are deadlocks.** If every available choice is such a no-op
  loop, the player can never progress again: the state counts as a loss.
- **`failPath`** is the shortest real losing continuation — it ends in a `lost`
  state or an all-loop soft-lock — never a move that merely returns to the same
  playing state.
- `solve(level, { nodeCap = 300 000, partialOnCap, signal })` returns win
  witness, `minWinningPeak`, loss probability, first-move stats and per-decision
  stats from the memo. `findFirstWinningWitness` is the fast "is there any win"
  DFS over the same choices.

Studio analytics use this single canonical solve. The former sequential-vs-
concurrent comparison, `maxActive` / `maxActiveOnWitness` metrics and the
`CONCURRENCY_TRIVIALIZES_LEVEL` / `CONCURRENCY_INCREASES_RISK` warnings are
retired.

### Difficulty weights
`concurrencyGap` is retired as a difficulty input (a join can no longer shorten a
solution). The remaining weights are intentionally **not renormalised** — they
total **0.95** and the practical score ceiling is 95. Recalibrating weights,
saturation and tier thresholds together is deferred to a dedicated
difficulty-model pass (`studio/analysis/difficulty.ts`).

### Level audits
The original M2B Level 1–10 sequential-vs-concurrent audit table was measured on
the retired arbitration engine and no longer applies; it has been removed rather
than left as stale data. Current per-level metrics come from the canonical solve
(see the campaign docs and the Studio).

---

## 9. Verification (at M2B ship time)

- `npx jest` — 175 passed / 17 suites at the time. New then: `concurrency.test`,
  `hapticArbiter.test`.
- `npx tsc --noEmit` (strict), `npx eslint .`, `npx expo-doctor` (21/21),
  `npx expo export -p ios` / `-p android` — all clean then.
- Not run on device (no simulator here).

Test counts have moved on since; see the latest milestone doc for current totals.

---

## 10. Performance

- No per-frame JS loop, no per-frame React `setState`: each flight commits engine
  events only on `eventCountAt` boundary changes (animated reaction), exactly as
  M2A did — now × N flights.
- Projectiles / trails / pop pixels are all reanimated shared-value driven on the
  UI thread; each flight cleans up (`cancelAnimation`) on unmount, which happens
  deterministically when its `complete` event retires it.
- Static board (`BoardActors`) is `memo`'d and does not remount per pass.
- Engine cost per launch is one single-launch simulation (cached), independent of
  how many Pals are on the rail.
- 5 flights = 5 clocks + 5 reactions + ≤ 5 `<OrbitingCharge>` + one
  `<EnergyShot>` each + their pop pixels. Conceptually within budget for a
  40–100-pixel board with Color Assist on; **unverified on device**.

---

## 11. TUNABLE values

| value | where | default |
|---|---|---|
| `MAX_ACTIVE_CHARGES` / `DEFAULT_ACTIVE_CAPACITY` | `engine/concurrency.ts` | 5 |
| `LAUNCH_SPACING` | `engine/concurrency.ts` | 1 lap (load-bearing — do not lower) |
| `COALESCE_WINDOW_MS` | `game/hapticArbiter.ts` | 45 ms |
| audio identical-voice cap | doc guidance | 3 |
| `LANE_OFFSET_PX` | `rendering/OrbitBoard.tsx` | 2 px |
| `CALM_TRAILS_AT` | `rendering/OrbitBoard.tsx` | 3 charges |
| solver `nodeCap` | `engine/solver.ts` | 300 000 |
| `SIM_CACHE_LIMIT` | `engine/epoch.ts` | 20 000 (LRU, board-scoped) |
| `EXTERIOR_CACHE_LIMIT` | `engine/pixels.ts` | 20 000 |

---

## 12. Known risks

- **Multi-charge presentation perf** unverified on device (5 clocks + reactions).
- Lane offset / calm-mode thresholds are eyeballed, not device-tuned.
- Difficulty weights total 0.95 pending a dedicated recalibration (§8).
- `react-test-renderer` deprecation warning in `session.test` (pre-existing).
