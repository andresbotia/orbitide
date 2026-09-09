# M2A — Production gameplay-screen foundation

Branch: `milestone/1-core-prototype`. Local commit only; no push, no merge.
Builds on the approved M1 interaction revamp (`93bca4b`). Presentation only —
no engine, solver, level, monetization, backend, or dependency changes. The
pre-existing `package.json` / `package-lock.json` drift (expo patch bumps,
`@expo/ngrok`) is left uncommitted, as in the M1 revamp.

There is no separate "M2 Implementation Spec" / "gameplay-screen design" file in
the repo; the M2A task brief was used as the source of truth and is summarised
here.

## Scope

Replaces the prototype gameplay presentation with the Cosmic Arcade production
shell while preserving every M1 engine behaviour. Explicitly **not** in this
pass: Home, Win/Discovery, difficulty intro, Frozen/Shielded/Armored materials,
Bomb/Wild/Linked/Hidden/Locked, five-charge gameplay, monetization/store/economy,
backend/accounts, the full 15-mark Color Assist system.

## M1 rules preserved (unchanged code)

`src/game/engine/**`, `src/game/levels/**`, the solver and all their tests are
untouched. Deterministic authored queues, post-clear exposure recompute, the
canonical orbit direction, shared `ORBIT_INSERTION` at the bottom of the ring,
projectile-from-rendered-charge, manual Holding (no auto-launch, 3/3 is not an
auto-fail), Levels 1–4 no-fail / 5–10 fail paths, engine-owns-truth — all intact.
`buildScript` still consumes the exact engine encounter trace; animation never
selects targets.

## Architecture

### Gameplay shell (`src/screens/GameScreen.tsx`)

Screen hierarchy, top to bottom:

```
TOP HUD            Hud.tsx        — settings / level+progress / restart
ORBIT BOARD        OrbitBoard.tsx — flex:1, the visual hero
HOLDING            HoldingTray.tsx
LAUNCH TUNNELS     TunnelBar.tsx
SECONDARY TOOLS    ToolBar.tsx    — Undo / Scan / Slot, presentation-only
```

Environment: navy/indigo ground (`arcade.envBottom`) with a soft top ambient
disc and a per-board radial vignette. No dashboard cards, no giant glow.
Session wiring (`useGameSession`, `launch` / `launchHeld` with measured source
and holding-target points) is byte-for-byte the same as M1; only the child
components and their order changed.

### Board geometry module (`src/game/rendering/boardGeometry.ts`)

Pure, unit-tested, no React/RN/Skia. `computeBoardGeometry(size, cols, rows)`
returns:

| field | formula |
| --- | --- |
| `center` / `orbitCenter` | `(size/2, size/2)` |
| `density` | `max(cols, rows)` |
| `cell` | `max(6, floor(size * 0.56 / density))` |
| `artwork` / `gridOrigin` / `gridWidth/Height` | `cell * cols|rows`, centred |
| `orbitRadius` (outer) | `min(size*0.45, size/2 - chargeRadius - 2)` |
| `innerGuideRadius` | `max(hypot(gridW,gridH)/2 + cell*0.9, outer*0.7)` |
| `chargeRadius` | `min(size*0.045, max(7, cell*0.55))` |
| `launchHub` | `center` (central launch seat — presentation only) |
| `orbitInsertion` / `insertion` | `center + (0, +orbitRadius)` — engine truth |
| `adaptive` | `pixelAdaptive(density)` |

`layout.ts` is now a thin back-compat re-export (`computeBoardLayout`,
`BoardLayout`, `cellCenter`, `orbitPoint`).

**LAUNCH_HUB ≠ ORBIT_INSERTION.** The hub is the board centre; the insertion
point is the bottom of the rail. Engine orbit behaviour still begins at
`ORBIT_INSERTION`; the hub is only a visual waypoint.

### Responsive / adaptive pixel formulas (`pixelAdaptive(density)`)

Linear interpolation between the 7×7 look and the 17×17 look, clamped to
`[7, 17]`. All depth cues only ever *decrease* with density (asserted in tests):

| param | 7×7 | 17×17 |
| --- | --- | --- |
| `bevel` (px) | 2.2 | 0.7 |
| `cornerRadius` (× cell) | 0.26 | 0.09 |
| `gutter` (px) | 2.2 | 0.7 |
| `glow` (0–1) | 0.5 | 0.14 |
| `highlight` (0–1) | 0.4 | 0.16 |
| `shadow` (0–1) | 0.36 | 0.14 |
| `popOvershoot` | 0.35 | 0.08 |

Artwork footprint is held at ~0.52–0.56 × board size across all densities
(target 0.56); only cell size changes. Densities 7/9/11/13/15 are tuned,
17 is prepared.

### Launch-hub choreography (`flightGeometry.ts`, `presentation/constants.ts`)

`flightPosition` (the single worklet shared by the charge and every projectile)
now splits the lift:

```
source ──APPROACH(200ms, ease-out)──▶ LAUNCH_HUB
       ──SEAT(60ms, held)──▶ LAUNCH_HUB
       ──TO_INSERTION(140ms, ease-in-out, radial)──▶ ORBIT_INSERTION ──▶ orbit
```

`FEEL.LAUNCH_DURATION` is the sum (400ms) so the rest of the timeline, which is
written relative to `LAUNCH_DURATION`, is unaffected. Held-charge relaunch uses
the identical path (Holding → hub → same insertion → orbit). `liftPhase()` is a
0→3 ramp exposed for trail/flash intensity. Input feedback (haptic + tunnel
depress) still fires synchronously on `onPressIn`, before any engine work.

### Board rendering (`OrbitBoard.tsx`)

- **Skia, static** (one `<Canvas>`, repaints only on size/level change):
  environment vignette, `Starfield`, `OrbitRail` (recessed machined ring —
  groove shadow, painted-metal band, centre groove, inner bevel, restrained
  top-left highlight arc, faint inner guide), `LaunchHubMarker` (central seat +
  radial guide + insertion port).
- **Reanimated actor layer** (`BoardActors`, remounts per pass, one shared
  UI-thread `clock`): production pixels, `OrbitingCharge`, `EnergyShot`.
- `useAnimatedReaction` still drives `presentThrough` at event-count boundaries;
  no per-frame JS.

### Production pixels (`Pixel.tsx`)

RN `Animated.View` (kept — lightest path, no per-pixel Skia node or extra dep):
base body + beveled per-side borders (top/left = highlight, bottom/right =
shadow) for consistent top-left lighting, a top highlight strip, a lower shadow
pool, and a restrained inner emissive rim when the pixel is reachable. Depth
cues scale via `adaptive`. Pop = clock-driven scale overshoot + fade over
`PIXEL_POP_DURATION` (100ms). A `Text` overlay layer is reserved for a future
Color Assist mark (`assist` prop, `colorAssistSymbol` map, off by default).

### Active charge (`OrbitingCharge.tsx`)

One independent renderer **per FlightPass** — no singleton, no global projectile,
no one-charge timeline assumption. N simultaneous charges (M2B) = N mounted
`<OrbitingCharge>` off the shared clock. Each shows: gameplay colour,
energy-glass body (fill + glow border + top-left gloss), live capacity number
(animated `TextInput`, readable while moving), a 2-dot restrained trail, a soft
halo, and its actual `flightPosition`. Burst/dive-to-Holding endings preserved.

### Projectile / hit (`EnergyShot.tsx`)

Still exactly two native views per pass. Streak starts at the charge's actual
rendered position (`flightPosition(pass, layout, shot.fireAt)`) and ends at the
exact engine-selected target cell centre; impact flash is a bright white ring +
glow at the target cell, scaled up and faded over 120ms. Baseline timing
unchanged: anticipation 20ms / projectile 80ms / impact 10ms. `ENCOUNTER_SCALE`
added to `constants.ts` as a single tunable multiplier (kept at 1 for M1 parity).
Capacity decrement stays synchronised via `capacityAt`; animation completion
never gates engine state.

### Holding (`HoldingTray.tsx`)

Three permanent recessed sockets in a painted-metal deck. Empty = machined
socket with a dark well; occupied = dimensional orb (glass gloss + capacity).
2/3 tints the deck/label warm (restrained pressure), 3/3 / overflow tints
danger **without** implying automatic failure. Useful held charges get an accent
rim and remain the only tappable ones; manual relaunch intact. A `boosterSlot`
prop draws an inert dashed `[+]` fourth affordance — **not** wired, the third
slot is never a booster.

### Tunnels (`TunnelBar.tsx`)

Three dark matte arcade housings, each: recessed magazine (depth plates that
imply a loaded queue, never the authored future charges), a socket port holding
a bright front charge with its capacity number, a `T1/2/3` plate. Large tap
target + `hitSlop`, physical press (translateY + scale + darken). Queue
semantics and hidden-charge secrecy unchanged. Source measurement / `onLaunch`
wiring identical to M1.

### HUD (`Hud.tsx`)

Settings gear (placeholder) / `LEVEL n · TITLE` + thin progress track + pixel
count / restart. Painted-metal chips. Coin balance from the M2 HUD pattern is
deliberately deferred to the economy pass.

### Tools (`ToolBar.tsx`)

Undo / Scan / Slot — one dim secondary row, disabled and presentation-only, no
handlers passed. No booster logic.

## Performance decisions

- Board machinery is static Skia; it does not repaint during a pass.
- One Reanimated UI-thread clock per pass drives pixels, charge, projectile,
  trail and flash. No per-frame JS position updates; JS only receives
  event-count boundaries.
- Pixels stay RN `Animated.View` (2–4 static child views each) rather than a
  Skia node graph or a new gradient dependency — lightest approach for the
  current ≤64-cell boards. Denser future boards (13²–17²) are the point where a
  Skia pixel layer earns its cost; flagged, not built.
- Trail = 2 fixed dots; halo = 1 view; projectile = 2 views. No particle system.
- `pixelMaterial` results are memoised; `pixelAdaptive` is cheap arithmetic.

## Validation

- `npm test` — **88 passed, 9 suites** (was 83/8). New `boardGeometry.test.ts`
  (+5): hub/insertion distinctness, footprint stability across densities,
  adaptive monotonicity, per-level rail fit down to 180px, and the
  source→hub→insertion lift routing. No M1 test weakened or deleted.
- `npm run typecheck` — pass (tsc strict).
- `npm run lint` — pass.
- `npx expo-doctor` — 21/21.
- `npx expo export --platform all` — iOS (4.2MB) + Android (4.4MB) Hermes
  bundles exported to `dist/m2a/export`.

## Known visual risks (need a device / simulator pass)

1. **Launch feel.** Lift is 400ms (200/60/140) vs M1's 240ms. Spec starting
   point was 220/70/150 = 440ms; pulled in slightly. If the hub detour reads as
   sluggish, cut `LAUNCH_HUB.APPROACH`/`TO_INSERTION` first — it is the #1
   tunable.
2. Pixel bevel via per-side border colours is a real bevel on iOS; Android
   renders per-side borders slightly differently at small sizes — check 7×7
   boards on Android.
3. Skia `RadialGradient` board vignette vs the RN screen background — confirm no
   visible seam at the board edge on both platforms.
4. Small-phone (≤360pt) rail fit for the 8×8 boards (Comet) has ~6px margin at
   180px board size; fine in tests, eyeball it on a real small device.
5. Trail dots and halo opacity on OLED — may need to drop further.
6. Capacity number legibility on the lighter charge colours (white, cyan,
   yellow) while moving over the bright artwork.
7. `overflow: 'hidden'` on the safe area — verify the orbiting charge never
   needs to render outside the board box (it should not; `flightPosition` stays
   within `size` plus token radius).

## TUNABLE

- `LAUNCH_HUB.APPROACH / SEAT / TO_INSERTION` (`presentation/constants.ts`).
- `ENCOUNTER_SCALE` (single per-encounter multiplier, currently 1).
- All of `FEEL` (unchanged values, one file).
- `FOOTPRINT` (0.56) and `MIN_CELL` (6) in `boardGeometry.ts`.
- Every `pixelAdaptive` endpoint (7×7 and 17×17 stops).
- `arcade` palette + `pixelMaterial` mix amounts (`theme/arcade.ts`).
- Rail band width, highlight arc span, hub seat radius (`OrbitRail.tsx`).
- Trail lag/depth, halo size, gloss placement (`OrbitingCharge.tsx`).
- Socket / housing / HUD sizes and metal border tints.

## Five-charge & accessibility readiness

- No singleton charge, projectile, or timeline that assumes exactly one active
  pass. `BoardActors` renders a list-of-one today; M2B maps `passes`.
  Outstanding for M2B: per-pass clocks (or one shared timeline) and shared-board
  arbitration — the same item already flagged in the M1 revamp notes.
- Pixels and charges each expose a clean overlay layer; `colorAssistSymbol`
  gives a stable per-colour glyph. `OrbitBoard` threads a `colorAssist` prop,
  not yet wired to settings. The full 15-mark system is a later pass.

## Files

New: `src/theme/arcade.ts`, `src/game/rendering/boardGeometry.ts`,
`src/game/rendering/OrbitRail.tsx`, `src/components/ToolBar.tsx`,
`src/game/rendering/__tests__/boardGeometry.test.ts`.

Changed: `src/game/rendering/layout.ts` (→ re-export),
`src/game/rendering/flightGeometry.ts`, `src/game/rendering/Pixel.tsx`,
`src/game/rendering/OrbitingCharge.tsx`, `src/game/rendering/EnergyShot.tsx`,
`src/game/rendering/OrbitBoard.tsx`, `src/game/presentation/constants.ts`,
`src/components/TunnelBar.tsx`, `src/components/HoldingTray.tsx`,
`src/components/Hud.tsx`, `src/screens/GameScreen.tsx`.
