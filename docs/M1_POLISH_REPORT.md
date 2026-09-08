# M1 iPhone playtest polish

Branch: `milestone/1-core-prototype`. Local commit only; no merge or push.
All ten pixel-art silhouettes, exposure rules, Holding rules, three-slot capacity,
color budgets, and difficulty labels are preserved. Level 2 queues are unchanged;
Levels 1 and 3-10 have explicit authored queue/capacity retunes. No M2 mechanics,
runtime puzzle randomness, boosters, sound assets, or dependencies were added.
The pre-existing `package.json` and `package-lock.json` edits are excluded from this commit.

## Target ordering

The old engine selected from 12 o'clock, then presentation independently re-sorted
that subset from tunnel entry. Capacity-limited clears could therefore skip an
apparently earlier target. Selection and presentation now agree:

1. At the start of each pass, retain the existing exterior flood-fill exposure
   snapshot and filter for uncleared pixels matching the charge color.
2. Use the shared clockwise circular path, centred at `((width-1)/2, (height-1)/2)`.
   The three tunnel entry fractions are `23/36`, `1/2`, and `13/36` (top = zero).
   Held charges enter at `1/2`. Tunnel identity is resolved by its state-array index
   in both the engine and presentation, rather than parsing an ID in presentation.
3. For each target, compute `f = wrap(atan2(y-cy, x-cx) + pi/2) / (2*pi)`.
   Its encounter offset is `wrap01(f - entry)`. This is the nearest point to that
   pixel on the circular path. A pixel exactly at the centre is equally near
   everywhere, so its encounter is at entry.
4. Sort by encounter offset ascending; offsets within `1e-9` tie. Break ties by
   radius squared descending (nearest/outermost first), then pixel ID ascending.
   Select the first `capacity` targets from this legal snapshot.
5. Return those ordered IDs as game truth. Presentation consumes them verbatim;
   it does not re-sort, select targets, or change reachability. Holding keeps its
   original ordered auto-resolution loop and takes a fresh legal snapshot per pass.

## Motion and fit

Each target receives a pass-scoped `energyShot`, then `pixelClear` exactly 100ms
later: 75ms short streak travel, 25ms white anticipation flash, then the existing
pixel collapse/burst, counter decrement and semantic `pixelPop` feedback/haptic.
The feedback service and sound hook are preserved. Streaks are only 3px thick and
at most 14px long. The shot collection and events carry pass IDs and target IDs;
M1 remains sequential, but the effect is not a singleton tied to one global target.

Minimum clear spacing remains 110ms. One orbit lap remains 1800ms. Each shot starts
at the charge's scheduled orbital position, including when cadence delays a dense
cluster past its nearest encounter. The old three-lap truncation was removed so
an unusually dense pass cannot outlive its flight; coast lasts at least 252ms after
the last clear. No shipped pass needs a three-lap cap. Pixel collapse is 100ms;
anticipation moved from after removal to before removal.

Both guide radii now have `rx == ry` instead of `ry == 0.9 * rx`. The outer radius
reserves space for the complete charge token, and tunnel lift origins are clamped
inside the board. Existing board-area sizing still reserves HUD and control space.
Geometry tests cover all ten artworks at 180, 240, 288, 320, 358, 398 and 430px board
sizes. Artwork clears the traveling token; tunnel anchors and tokens fit the board.

Background/restart settles or resets the presented state, empties shots and clears
session timers. Unmount clears timers. Shot, charge, burst and board-pulse shared
animations cancel on cleanup; the board suppresses transient effects while inactive.
Fake-timer session tests confirm that shots cannot consume displayed capacity early
and interruption cannot fire delayed clear haptics.

## Solver metrics

All searches are exhaustive with no cap exhaustion and all ten levels have a
zero-booster win from each of the three first moves. State keys preserve Holding
order and full color names (pink and purple must not share the same key).

`Loss %` is an exact diagnostic assuming uniform selection among nonempty tunnels
at each decision, computed without sampling or runtime randomness. It is not a
predicted human failure rate. `Win peak` is displayed Holding occupancy on the
reported solver line, including brief landings before auto-resolution. `All peak`
is maximum displayed occupancy across every reachable line, including failures.
`Min settled` is the minimum peak occupancy after engine resolution over all wins.
`Nodes` counts unique nonterminal audit states. Winning lines are witnesses, not
claims of shortest solutions. T1/T2/T3 below correspond to tunnel-0/1/2.

| Level | Retune / lesson | Moves | Fail path? | Win peak | All peak | Min settled | Loss % | Nodes |
|---|---|---:|---|---:|---:|---:|---:|---:|
| 1 Easy | Three equal white-7 charges; every order wins | 3 | No | 1 | 1 | 0 | 0 | 10 |
| 2 Easy | Unchanged white arms / yellow core | 4 | No | 1 | 1 | 0 | 0 | 11 |
| 3 Easy | White precedes cyan in T1; peel first or safely park | 4 | No | 2 | 2 | 0 | 0 | 11 |
| 4 Easy | Blue unlocks white hull queue; Holding required | 5 | No | 1 | 2 | 1 | 0 | 17 |
| 5 Easy | Cyan commitments; purple gives a forgiving first tap | 8 | Yes | 1 | 3 | 1 | 14.81 | 48 |
| 6 Easy | Blue and oversized cyan before purple | 9 | Yes | 1 | 3 | 1 | 22.22 | 111 |
| 7 Easy | Pink then white in T1 before blue | 7 | Yes | 2 | 3 | 1 | 44.44 | 40 |
| 8 Easy | Two buried colors in T3 before cyan | 9 | Yes | 1 | 3 | 1 | 59.26 | 74 |
| 9 Medium | White/core/stars interleave ahead of blue | 11 | Yes | 2 | 3 | 1 | 65.02 | 111 |
| 10 Hard | Pink/white commitments precede corona clears | 10 | Yes | 2 | 3 | 1 | 66.67 | 126 |

Level 1 never retains a charge after resolution; a harmless transient landing can
still be shown before an automatic pass. Maximum *settled* occupancy over all
lines is 0 for L1, 1 for L2-4, and 3 for L5-10.

| Level | Winning witness | Failure witness |
|---|---|---|
| 1 | 1,2,3 | None |
| 2 | 1,1,2,3 | None |
| 3 | 1,1,2,3 | None |
| 4 | 1,1,1,2,3 | None |
| 5 | 1,1,1,2,2,3,3,3 | 1,2,3,3 |
| 6 | 1,1,1,2,2,2,3,3,3 | 1,2,3 |
| 7 | 1,1,1,2,2,3,3 | 1,1,2 |
| 8 | 1,1,1,2,2,2,3,3,3 | 1,2,2,3 |
| 9 | 1,1,1,1,2,2,2,3,3,3,3 | 1,1,1,2 |
| 10 | 1,1,1,2,2,2,3,3,3,3 | 1,1,2 |

Reproduce metrics in PowerShell:

```powershell
$env:REPORT_METRICS = '1'
npm test -- --runInBand metrics.test
Remove-Item Env:REPORT_METRICS
```

## Validation and limits

- `npm test -- --runInBand`: 70 tests pass across 7 suites.
- `npm run typecheck`: passes.
- `npm run lint`: passes, no warnings.
- `npx expo-doctor`: all 21 checks pass.
- `npx expo export --platform all --output-dir dist/m1-polish`: iOS and Android
  Hermes exports pass; output remains ignored under `dist/`.
- Test renderer emits its upstream deprecation notice. Expo emits the environment's
  existing NO_COLOR/FORCE_COLOR warning. Neither prevents validation.

Physical iPhone/Android visual and haptic acceptance was not performed in this
Windows session. Exports and geometry tests do not establish device frame pacing,
thermal performance or subjective difficulty. The existing JS timer/UI animation
split can introduce small presentation drift under load; engine truth stays
instant and deterministic. Cadence-delayed shots originate beyond the geometrically
nearest point rather than pausing or accelerating the orbit. L8-10 pressure should
be judged in follow-up playtests; the analytic loss metric is only a tuning aid.

## Files changed

- `src/game/engine/__tests__/engine.test.ts`
- `src/game/engine/__tests__/solver.ts`
- `src/game/engine/__tests__/sweep.test.ts`
- `src/game/engine/orbit.ts`
- `src/game/engine/pixels.ts`
- `src/game/engine/resolveHolding.ts`
- `src/game/engine/resolveLaunch.ts`
- `src/game/engine/types.ts`
- `src/game/levels/__tests__/metrics.test.ts`
- `src/game/levels/levelDefinitions.ts`
- `src/game/presentation/__tests__/buildScript.test.ts`
- `src/game/presentation/__tests__/session.test.ts`
- `src/game/presentation/buildScript.ts`
- `src/game/presentation/constants.ts`
- `src/game/presentation/events.ts`
- `src/game/rendering/EnergyShot.tsx`
- `src/game/rendering/OrbitBoard.tsx`
- `src/game/rendering/OrbitingCharge.tsx`
- `src/game/rendering/Pixel.tsx`
- `src/game/rendering/PixelBurst.tsx`
- `src/game/rendering/__tests__/layout.test.ts`
- `src/game/rendering/layout.ts`
- `src/hooks/useGameSession.ts`
- `src/screens/GameScreen.tsx`
- `docs/M1_POLISH_REPORT.md` (this report)
