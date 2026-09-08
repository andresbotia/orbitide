# M1 interaction-model revamp

Branch: `milestone/1-core-prototype`. Local commit only; no push or merge.
This implements the subsequent interaction-revamp request and supersedes the
snapshot targeting and automatic Holding described in `M1_POLISH_REPORT.md`.
No M2 mechanics, simultaneous gameplay, backend, monetization, sound assets,
runtime randomness, or dependencies were added. Pre-existing package manifest
and lockfile changes are excluded from this commit.

## Architecture and physical encounter rule

Previously the engine selected a snapshot and the presentation scheduled its
clears independently of physical contact. Tunnel-dependent insertion and automatic
Holding made the relationship between player choice, orbit, and clear harder to read.

`startPass -> advancePass -> ... -> finished` is now a pure, immutable per-charge
state machine. Each step resolves exactly one encounter against fresh exposure.
`resolveAction` validates admission, removes the selected source, evaluates the
pass, parks any remainder, and derives win/deadlock. In sequential M1, evaluating
these discrete steps immediately is safe: no other charge changes the board.
The returned encounter trace is authoritative; animation cannot select targets or
change outcomes. A future concurrent scheduler can advance independent passes
against a shared board, but shared-board arbitration is deliberately not implemented.

Exact targeting algorithm:

1. Flood-fill empty space from the grid's one-cell exterior moat. A pixel is
   exposed when at least one orthogonal neighbour connects to that space.
   Filter to uncleared pixels matching this charge. This legality rule is unchanged.
2. Centre is `((width-1)/2, (height-1)/2)`. Let
   `f = wrap01((atan2(y-cy, x-cx) + pi/2) / (2*pi))`.
   Top is fraction zero. All charges enter at fraction `0.5`.
3. Contact progress is `wrap01(f - 0.5)`. This is the pixel's nearest angular
   projection onto the circular path. A pixel exactly at the centre is equidistant
   from the entire orbit, so it is encountered at the current pass progress.
4. Discard contacts behind current progress, with `1e-9` tolerance. Sort ascending
   progress; within that tolerance, sort descending radius squared, then lexical
   pixel ID. Resolve the first candidate and decrement capacity by one.
5. Recompute exposure. Newly exposed targets ahead can clear on this pass;
   targets already passed wait for a later manual pass. Same-angle exposed targets
   may clear sequentially while the charge remains at contact. Progress never reverses.
6. Stop when capacity reaches zero, or finish one lap if no further legal contact exists.

## Insertion, motion, and timing

Every tunnel and held charge lifts from its measured button centre and travels to
one bottom-centre point on the outer circular orbit. The path proceeds
**bottom -> left -> top -> right -> bottom**, clockwise in downward-positive screen
coordinates. At the bottom its horizontal velocity is leftward, matching the
requested right-to-left insertion movement. Engine angles and rendered movement
use the same convention.

The two orbital guides are circles. Artwork is centred and uses up to 58% of the
square board dimension. The outer radius is capped at 45% of board size and also
at half the size minus token radius and a two-point inset. Source controls are
measured again when board size changes; fallback geometry exists before measurement.

| Stage | Duration / boundary |
| --- | --- |
| Source button to shared insertion | 240ms |
| Moving portion of one full lap | 1800ms |
| Hold at encounter: anticipation | 20ms |
| Small projectile travel | 80ms |
| Impact before clear | 10ms |
| Total pause per shot / minimum clear spacing | 110ms |
| Pixel collapse | 100ms, starting at clear |
| Remaining charge to Holding | 300ms |
| Consumed charge disappearance | 180ms |
| Win / fail after landing or disappearance | 200ms / 160ms |
| Session completion after last stage | 20ms |

The charge pauses at each contact throughout anticipation, travel, and impact.
For zero-based shot index `i`, anticipation time is
`240 + encounterProgress * 1800 + i * 110`; clear occurs 110ms later.
A full lap therefore takes 1800ms **plus shot pauses**, excluding lift and landing.
An exhausted charge ends at its last clear rather than completing an empty lap.

Orb, capacity label, projectile, anticipation/flash and pixel collapse share a
pass-specific Reanimated UI-thread clock. Shot origin uses the same position
function as the rendered orb at firing time. The streak is at most 14 points long
and three points thick; projectile and flash need only two native views per pass.
JS receives event-boundary callbacks, not per-frame polling. Semantic feedback
hooks remain available for future sound handlers.

Input uses `onPressIn`; press haptics are issued before synchronous engine work.
The active-pass ref prevents duplicate launches before React updates. Backgrounding
settles the already committed truth and retires the presentation; stale pass callbacks
cannot replay effects. Animation, listeners and pending win-haptic timer are cleaned
up on background/unmount; restart also retires the old pass. Win reporting is once-only.

## Manual Holding and deadlock

Holding has three 54-point pressable slots showing colour and remaining capacity.
A remainder stays held indefinitely. Tapping a useful held charge removes it from
Holding and launches it through the same insertion. Nothing relaunches automatically.

A held charge with no exposed matching pixel is rejected with
`No exposed matching pixels yet.` This avoids a predictably empty lap and makes
it clear that another charge must expose its colour. Useful held charges are highlighted.
The reserved help line reads `Tap a held charge to launch it again.`

With a free slot, any available tunnel head may launch, even with no immediate hit:
advancing that authored queue is useful. With full Holding, a tunnel head is admitted
only if its deterministic pass consumes its entire capacity, so no fourth slot is
needed. Otherwise feedback asks the player to free a slot. A useful held charge is
still admitted at full occupancy because its departure frees its own slot.

Win means every pixel is cleared. Otherwise, lose only if there are no admitted
tunnel or held actions. Full occupancy alone is not loss; queue exhaustion can also
produce deadlock below full occupancy. Solver and runtime call the same admission
and action resolver functions. Every admitted action decreases remaining tunnel
charges or uncleared pixels, so exploration is acyclic.

## Haptic map

| Event | Feedback |
| --- | --- |
| Tunnel press | Medium impact |
| Holding press | Rigid impact |
| Orbit entry | Light impact |
| Pixel clear | Rigid impact, one crisp pulse |
| Charge consumed | Medium impact |
| Holding landing | Rigid impact |
| Holding newly reaches 2/3 | Warning notification |
| Holding newly reaches 3/3, or fail | Error notification |
| Win | Success notification, then Medium after 120ms |

Presses share an 80ms throttle; pixel impacts use 90ms, warnings 600ms, and
full/fail errors share 180ms. Coincident final-clear/consumed cues use one Medium
impact; coincident landing/pressure cues use one notification. Semantic sound
hooks still fire individually. Returning a held charge to unchanged occupancy
does not repeat pressure warnings. Native errors do not interrupt gameplay.
Rigid replaces the previously soft clear cue without stacking impacts; device
playtesting should confirm its weight during dense runs.

## Levels and exhaustive zero-booster solver metrics

All ten art grids and authored queues were retuned for this model. Celestial
subjects remain handcrafted. Capacities exactly match each board's colour budget.
Levels 1-2 have no Holding pressure, Level 3 allows optional Holding from a poor
order, and Level 4 requires at least one manual relaunch on every winning route.
Level 5 first permits failure. Levels 6-8 increase sequencing pressure. Levels 9
and 10 retain Medium and Hard labels.

The solver exhaustively memoizes reachable states using pixel bits, full queue
contents, capacities, IDs, and Holding order. Its 300,000-node limit throws rather
than reporting a partial audit as complete. All ten audits completed; each has
three winning first tunnel choices.

| Level / art | Pixels | Shortest win moves | Held launches on witness | Min winning peak Holding | Max Holding any path | Fail exists | States expanded | Uniform-action loss |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 Moon | 20 | 3 | 0 | 0 | 0 | No | 7 | 0% |
| 2 Star | 21 | 4 | 0 | 0 | 0 | No | 11 | 0% |
| 3 Small Planet | 25 | 5 | 0 | 0 | 1 | No | 22 | 0% |
| 4 Rocket | 25 | 5 | 1 | 1 | 2 | No | 23 | 0% |
| 5 Comet | 33 | 8 | 1 | 1 | 3 | Yes | 215 | 13.43% |
| 6 Ringed Planet | 37 | 10 | 2 | 2 | 3 | Yes | 499 | 48.15% |
| 7 Satellite | 37 | 9 | 2 | 2 | 3 | Yes | 173 | 67.59% |
| 8 Nebula | 37 | 11 | 3 | 2 | 3 | Yes | 286 | 74.07% |
| 9 Constellation | 33 | 11 | 2 | 2 | 3 | Yes | 269 | 50.00% |
| 10 Eclipse | 32 | 10 | 2 | 2 | 3 | Yes | 311 | 70.37% |

Every listed shortest witness has the same peak as the minimum winning peak.
Uniform-action loss is the exact diagnostic probability of losing when choosing
uniformly among admitted actions at every state; there is no random runtime play.
It is not a predicted human failure rate or a strictly monotonic difficulty score.
In particular Level 9 is lower than Level 8 on this diagnostic despite its broader
colour/queue puzzle. Difficulty labels still require human playtesting.

### Reproducible witnesses

`T1`, `T2`, `T3` mean tap the corresponding tunnel head, repeatedly if listed again.
`H(id)` means manually tap that held charge. IDs retain zero-based tunnel/queue
coordinates from level authoring and do not change as a queue advances.

| Level | Winning sequence | Failing sequence |
| --- | --- | --- |
| 1 | T1 T2 T3 | None |
| 2 | T1 T1 T2 T3 | None |
| 3 | T1 T2 T1 T1 T3 | None |
| 4 | T1 T2 T3 T1 H(L4-t0-c0) | None |
| 5 | T1 T1 T2 T2 T3 T2 T3 H(L5-t0-c0) | T2 T2 T3 T2 T3 |
| 6 | T1 T1 T1 T2 T2 T2 T3 T3 H(L6-t0-c0) H(L6-t0-c1) | T1 T2 T3 |
| 7 | T1 T1 T1 T2 T2 T1 T3 H(L7-t0-c0) H(L7-t0-c1) | T1 T2 T2 |
| 8 | T1 T1 T1 H(L8-t0-c0) T2 T2 T3 T3 T3 H(L8-t0-c1) H(L8-t1-c0) | T1 T2 T2 |
| 9 | T1 T1 T1 T1 T2 T2 T2 T3 T3 H(L9-t0-c0) H(L9-t0-c1) | T1 T2 T2 T2 T3 T3 |
| 10 | T3 T3 T3 H(L10-t2-c1) T1 T1 T1 T2 T2 H(L10-t2-c0) | T1 T1 T2 |

To reproduce metrics in PowerShell:

```powershell
$env:REPORT_METRICS='1'
npm test -- --runInBand src/game/levels/__tests__/metrics.test.ts
```

## Validation and remaining risks

- `npm test -- --runInBand`: **83 tests, 8 suites passed**, including engine,
  exhaustive solver, presentation timing, session lifecycle, geometry and haptic tests.
- Separate metric audit: 11 tests passed (already included in the 83, not additional).
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npx expo-doctor`: **21/21 checks passed**.
- `npx expo export --platform all --output-dir dist/interaction-revamp/export`:
  iOS and Android Hermes bundles exported successfully (4.2MB / 4.4MB).
- Geometry fixtures cover all ten levels at board sizes 180, 240, 288, 320, 358,
  398 and 430. Authored artwork was reviewed in a generated contact sheet at
  `dist/interaction-revamp/artwork-review.png`; this is not a running-app screenshot.

The test renderer emits its upstream deprecation notice. Export emits harmless
NO_COLOR/FORCE_COLOR environment notices. No physical-device run was performed:
frame rate, measured touch-to-animation latency, haptic strength, live source
measurement and complete HUD/control fit still need iPhone/Android validation.
Haptic callbacks cross to JS at boundaries, so a blocked JS thread can delay them;
orb, shot, capacity and collapse motion stay on the UI clock. Concurrent board
arbitration for five charges is future work, although pass state and animation
clocks are independently representable. No native binary or TestFlight deployment
was produced by the export command.

## Files changed

- `README.md`
- `docs/GAME_DESIGN.md`
- `docs/M1_INTERACTION_REVAMP.md`
- `docs/MILESTONE_1.md`
- `src/components/HoldingTray.tsx`
- `src/components/TunnelBar.tsx`
- `src/game/__tests__/haptics.test.ts`
- `src/game/engine/__tests__/engine.test.ts`
- `src/game/engine/__tests__/solver.ts`
- `src/game/engine/__tests__/sweep.test.ts`
- `src/game/engine/actions.ts`
- `src/game/engine/index.ts`
- `src/game/engine/orbit.ts`
- `src/game/engine/pass.ts`
- `src/game/engine/pixels.ts`
- `src/game/engine/resolveHolding.ts`
- `src/game/engine/resolveLaunch.ts`
- `src/game/engine/selectors.ts`
- `src/game/engine/types.ts`
- `src/game/engine/winState.ts`
- `src/game/feedback.ts`
- `src/game/haptics.ts`
- `src/game/levels/__tests__/levelDefinitions.test.ts`
- `src/game/levels/__tests__/metrics.test.ts`
- `src/game/levels/levelDefinitions.ts`
- `src/game/presentation/__tests__/buildScript.test.ts`
- `src/game/presentation/__tests__/session.test.ts`
- `src/game/presentation/buildScript.ts`
- `src/game/presentation/constants.ts`
- `src/game/presentation/events.ts`
- `src/game/presentation/motion.ts`
- `src/game/rendering/EnergyShot.tsx`
- `src/game/rendering/OrbitBoard.tsx`
- `src/game/rendering/OrbitingCharge.tsx`
- `src/game/rendering/Pixel.tsx`
- `src/game/rendering/__tests__/layout.test.ts`
- `src/game/rendering/flightGeometry.ts`
- `src/game/rendering/layout.ts`
- `src/hooks/useGameSession.ts`
- `src/screens/GameScreen.tsx`
