# M2A.2 — Production Home screen

Branch: `milestone/1-core-prototype`. Local commit only; no push, no merge.
Builds on M1 revamp `93bca4b` and the M2A gameplay shell `9c1956a`.
Implements the already-approved Home direction — no redesign, no new concept, no
mascot. Presentation only: no engine/level/solver changes, no monetization,
backend, store, accounts, daily-reward logic, or sound assets. Reuses the M2A
`src/theme/arcade.ts` tokens and charge/rail/material language — one design
system, not two.

## Screen: "living orbital arcade machine"

`HomeScreen` composes three depth layers over a measured hero band:

```
BACKGROUND   StarfieldBackdrop   full-screen Skia: nebula haze + 2 parallax star
                                 groups, very slow drift
MIDGROUND    HomeCenterpiece     the orbital machine — housing, rail, energy
                                 sweep, real level preview, 1-3 ambient charges
FOREGROUND   FloatingFragments   3 suspended glass/metal shards, tiny float
```

Flow chrome, top to bottom: `TopUtility` (settings + coins, quiet) → hero band
(wordmark + centerpiece) → `LevelBadge` (LEVEL N + difficulty) → `PlayButton`
(physical) → a restrained "PICTURES RESTORED n/10" status line.

## Component architecture

| File | Role |
| --- | --- |
| `src/screens/HomeScreen.tsx` | Composition, band measurement, transition |
| `src/game/rendering/homeGeometry.ts` | **Pure** geometry + preview + ambient-spec helpers |
| `src/game/levels/difficulty.ts` | **Pure** shared difficulty representation (Gate hook) |
| `src/components/home/StarfieldBackdrop.tsx` | Skia background depth layer |
| `src/components/home/HomeCenterpiece.tsx` | Skia machine + preview + sweep + charges |
| `src/components/home/AmbientCharge.tsx` | One decorative orbiting charge |
| `src/components/home/FloatingFragments.tsx` | Foreground fragment layer |
| `src/components/home/LevelBadge.tsx` | LEVEL N + difficulty pips |
| `src/components/home/TopUtility.tsx` | Settings + coin balance |
| `src/components/PlayButton.tsx` | Rewritten as a physical machine control |
| `src/hooks/useAmbientActive.ts` | focus + foreground gate for all ambient motion |

## Centerpiece implementation

One absolutely-positioned `View` (pointer-events none) at `layout.center`, sized
`2 * machineRadius`, containing:

- **Skia `<Canvas>`** in a canvas-local frame where the machine centre is
  `(R, R)`:
  - recessed housing — `Circle` + `RadialGradient` (`metalRaised → metalLo`) +
    a seam stroke;
  - orbit rail — the same four-stroke treatment as the gameplay `OrbitRail`
    (groove shadow, painted band, centre groove, inner bevel), band width
    `max(3, R*0.055)`;
  - energy sweep — a ~57° accent `Path` arc rotated by a `useDerivedValue`
    (`sweep.value * 2π`), opacity `0.25 + activation*0.5`;
  - hub seat + an activation ring whose opacity tracks `activation`;
  - the level preview `Group` (below).
- **RN `AmbientCharge` overlay** — `specs.length` instances on top of the canvas.

## How real level data feeds the preview

`homeLevelPreview(level)` runs the engine's own `parsePixelArt` on the selected
level's authored `pixelArt` + legend and returns `{ cols, rows, density, cells:
{x,y,color}[], colors, simplify }`. No solver state, no queues, no Holding — the
silhouette and colour relationships only. `HomeScreen` derives the level from
`highestUnlockedLevel` (`getLevel(id) ?? level 1`), so selecting Level 7 shows
Level 7's picture. `previewGrid(preview, box)` lays the cells out inside the
preview box (`box.size * 0.86 / max(cols,rows)`, centred). Each cell is a Skia
`RoundedRect` (flat base colour + a thin top-highlight rect); `simplify` (density
≥ 13) drops the highlight and flattens the corner radius. The whole preview
`Group` gets one "breathing" scale transform — no per-cell animation, no
re-render unless the level changes.

`ambientChargeSpecs(level, count)` seeds a mulberry32 PRNG from the level id and
picks colours from that level's own tunnel charges, so Home visually matches the
level you're about to play. Deterministic per level, clamped to 0..3.

## Ambient motion system

Every system has its own period so nothing reads as one synced loop:

| System | Driver | Period | Reduced motion |
| --- | --- | --- | --- |
| star parallax drift | `withRepeat` sin, 2 amplitudes | 96 s | off (static) |
| rail energy sweep | `withRepeat` linear | 7.2 s | off |
| preview breathing | `withRepeat` sin | 4.7 s (9 s reduced) | **kept** (essential life) |
| ambient charges ×(1–3) | per-charge `withRepeat` linear | 8.5–18 s, jittered, all distinct | 1 charge, ×1.9 slower, no trail |
| floating fragments ×3 | per-piece `withRepeat` sin | 6.1 / 7.7 / 9.3 s | off (static) |
| PLAY activation | `withTiming` on press | 160 ms | kept |

All amplitudes are restrained (star drift ≤ 26 px, fragment bob ≤ 12 px, preview
breath ≤ 2.4 %). No particle system. `useAmbientActive()` (focus + `AppState`)
gates every animation: on blur / background each effect calls `cancelAnimation`
and settles to a resting value; on return it restarts from the resting phase
(angles wrap mod 1 so ambient charges resume seamlessly).

## Responsive behaviour

`computeHomeLayout({ width, height, reducedMotion })` measures the **hero band**
(not the whole screen) and sheds decoration as height drops:

| | ≥ 720 | 620–720 (compact) | < 620 (tight) |
| --- | --- | --- | --- |
| centerpiece Ø | `min(0.60·h, 0.94·w, 360)` | `0.54·h` | `0.54·h` |
| ambient charges | 3 | 3 | 2 |
| far stars | 42 | 30 | 20 |
| near stars | 16 | 10 | 6 |
| nebula | yes | yes | no |
| foreground fragments | yes | no | no |
| machine extensions | yes | yes | no |

Preserved at every size: PLAY tap target (236×66 + hitSlop), centerpiece Ø ≥ 190,
the preview, the level label, settings/coins. The centerpiece is never uniformly
scaled with the rest — it has its own floor.

## Reduced motion

`useReducedMotion()` (Reanimated). When enabled: star drift, energy sweep and
floating fragments freeze; ambient charges drop to one, ~1.9× slower, no trail;
foreground layer and near-parallax stars are removed by the layout. The preview
keeps a slow breath and PLAY keeps its press feedback — Home stays alive, not
dead.

## Transition into gameplay

`PlayButton` `onPressIn` fires immediately (`feedback.emit('select')` → medium
haptic) and the Pressable depresses synchronously (translateY 6, shadow/glow
reduce). `onPress` → `HomeScreen.handlePlay`: guard against double-fire, ramp
`activation` 0→1 over 160 ms (centerpiece preview pulses + rings brighten), then
`setTimeout(onPlay, 300)`. `onPlay` is the route's `router.push('/game')`; the
Expo Router stack's `animation: 'fade'` carries the visual cross. Total ≈ 300 ms
+ fade, inside the 250–450 ms budget. `navigating` and `activation` reset on
`useFocusEffect` so returning Home is clean.

## Return from gameplay

The route already calls `reload()` on focus; `HomeScreen` re-derives `level`
from the `highestUnlockedLevel` prop every render, and `preview` / `specs` are
`useMemo`'d on the level identity, so a progress change swaps the preview and
ambient palette with no stale state.

## Performance decisions

- All ambient motion is Reanimated UI-thread (`withRepeat` / `useDerivedValue`);
  no JS per-frame loop, no `setInterval`.
- Background + centerpiece are each one Skia `<Canvas>`; the preview is static
  Skia with a single group transform — it does not re-render per frame or per
  ambient tick.
- Animated view count is capped: ≤ 3 ambient charges (+1 trail each), ≤ 3
  fragments, 1 backdrop canvas, 1 centerpiece canvas.
- Everything pauses on blur / background via `useAmbientActive`.
- Star counts and layers scale down by screen size and reduced motion.

## Validation

- `npm test` — **97 passed, 11 suites** (was 88 / 9). New: `homeGeometry.test.ts`
  (+6) and `difficulty.test.ts` (+3). No existing test weakened.
- `npm run typecheck` — pass. `npm run lint` — pass.
- `npx expo-doctor` — 21/21.
- `npx expo export --platform all` — iOS 4.2 MB + Android 4.4 MB → `dist/m2a2/export`.
- No device / simulator run available in this environment — no screenshots.

## Known visual risks (need a device pass)

1. Centerpiece vs PLAY vertical balance on the shortest supported phones — the
   hero band is measured, but eyeball SE-class devices.
2. Skia `Blur` on the nebula (blur 26) — cost and look vary by GPU; drop the
   blur or the nebula on low-end Android if it stutters.
3. Ambient-charge resume after backgrounding: the phase math wraps mod 1 so it
   should be seamless; confirm no visible jump.
4. Preview legibility for dense future levels (13²+) at ~150 px — `simplify`
   flattens material but the silhouette must still read.
5. `PlayButton` depth via nested border colours renders slightly differently on
   Android; check the "seated on a plate" read.
6. Activation pulse (160 ms) may be too subtle to notice before the fade — tune
   `activation` amplitude in `HomeCenterpiece` if so.
7. Reanimated `useReducedMotion()` is read once at startup; a mid-session OS
   toggle won't re-layout until Home remounts. Acceptable for M2A.2.

## TUNABLE

- Centerpiece size multipliers + `center.y` fraction, layer thresholds
  (`COMPACT_HEIGHT` 720 / `TIGHT_HEIGHT` 620), star/charge counts —
  `homeGeometry.ts`.
- All ambient periods + amplitudes (`StarfieldBackdrop`, `HomeCenterpiece`,
  `AmbientCharge`, `FloatingFragments`).
- `TRANSITION_MS` (300) and the activation ramp (160 ms) — `HomeScreen`.
- `ambientChargeSpecs` period band (8.5–18 s) and trail range.
- Nebula colours / blur, `starFar` / `starNear` tints — `arcade.ts`.
- `PlayButton` dimensions, travel (6 px), glow opacity.
- Difficulty pip colours / tiers — `difficulty.ts`.
- Coin balance is a hardcoded `0` placeholder (`TopUtility`) — wired to real
  state in the economy pass.

## Deferred (unchanged from the brief)

Store, purchases, ads, backend, accounts, daily-reward / streak logic,
collections, special pixel materials, the full animated Difficulty Gate intro
(pips are the hook), Win/Discovery reveal, five-charge gameplay, sound assets.
