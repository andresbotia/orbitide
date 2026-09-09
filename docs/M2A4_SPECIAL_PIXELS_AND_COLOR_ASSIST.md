# M2A.4 — Special pixel materials + full Color Assist

Branch: `milestone/1-core-prototype`. Local commit only; no push, no merge.
Builds on M1 `93bca4b`, M2A `9c1956a`, M2A.2 `83d12dc`, M2A.3 `a78f355`.

**Presentation infrastructure only.** No mechanic logic, no engine semantics
changed. No level uses a modifier or a colour beyond the existing 9 yet — this
pass makes the renderer and the model ready.

## A. Special pixel material system

### Modifier architecture

One shared model, not eight bespoke components:

```
BasePixel (RN, unchanged)
  + resolveModifier(instance, density)  →  ModifierRender   (pure model)
  + SpecialPixelLayer                    →  one shared Skia canvas draws every
                                            shell / hardware / damage
  + Pixel.modifierDim                    →  base cube desaturation / concealment
```

`ModifierInstance` (added to `engine/types.ts`, engine never reads it):
`{ kind, state?, progress?, level?, seed?, linkId?, linkedPixelIds?, linkProgress? }`.
`Pixel.modifier?: ModifierInstance` is the schema hook a future `createGame`
would populate; `OrbitBoard` also accepts `modifiers?: Record<pixelId, …>` so
nothing in the renderer needs redesigning when engine state arrives.

`resolveModifier` (`src/game/rendering/specialPixels.ts`, pure, tested) returns a
normalised `ModifierRender`: `shell` kind, `detail` bucket, `overflow`,
`progression` (0..1), `shellFailing` / `baseCompromised`, `desaturate` /
`concealment`, `counts` (plates / cracks / chips / bolts / facets / bubbles /
scanlines / sockets), `features` (12 boolean flags), `motion`, deterministic
`detailPoints`, and the `link` wiring block.

### Implementation technology per modifier

| modifier | shell | technique | why |
| --- | --- | --- | --- |
| Frozen | `ice` | Skia — translucent `RoundedRect` + `Blur` frost + crack `Path`s + bubble `Circle`s | needs translucency, refraction offset, soft frost |
| Shielded | `membrane` | Skia — offset outline `RoundedRect` (air gap) + highlight `Path` | separate membrane, not painted on |
| Armored | `plates` | Skia — corner `RoundedRect`s (count = durability) + bolt `Circle`s + centre colour disc | countable plates, brushed strokes |
| Locked | `clamp` | Skia — top/bottom clamp bars + blurred pin `Circle` | cast mechanism, glowing pin |
| Bomb | `cavity` | Skia — `RadialGradient` recess (dark centre) + machined rim stroke + top lip highlight + LED ring | occlusion/shading sells "hole not dome" |
| Wild | `crystal` | Skia — facet `Path` fan + traveling highlight line | faceted, colour-neutral |
| Linked | `socket` | Skia — edge socket `RoundedRect`s + conduit `Path` + pulse `Circle` | sockets + conduit hooks |
| Hidden | `pane` | Skia — translucent `RoundedRect` + colour-bleed fill + scanline `Path`s | holographic concealment |
| Color Assist mark | — | **RN views** (`ColorAssistMark`) | must render identically on a moving RN charge — no Skia there |

The base cube stays RN. Modifiers are one shared Skia overlay canvas — the RN
board is untouched and there is no per-pixel Skia surface.

### Exact density simplification rules (`materialDetail`)

`density ≤ 9 → full`, `10-13 → medium`, `≥ 14 → minimal`.

| kind | full | medium | minimal |
| --- | --- | --- | --- |
| Frozen | shell + refraction + frost cloud + 5 bubbles + chips + all cracks + rim | shell + refraction + frost + 0 bubbles + 2 chips + cracks + rim | strong shell + 1 chip + 1 readable crack + cold rim; **no** bubbles/refraction/frost |
| Shielded | air gap + membrane + highlight + micro-arc | air gap + membrane + highlight | air gap + membrane outline + one highlight; **no** arcs/facets |
| Armored | plates + 4 bolts + brushed | plates + 2 bolts + brushed | plate silhouette + count; **no** bolts/scratches |
| Wild | 6 facets + traveling highlight | 3 facets + highlight | faceted silhouette + 1 highlight; **no** internal facets |
| Hidden | pane + 3 scanlines + distortion + bleed | pane + 1 scanline + distortion + bleed | pane silhouette + 1 scanline + bleed |
| Bomb | cavity + rim + LED ring | cavity + rim + LED ring | cavity + rim; **no** LED ring |
| Locked | clamp + pin + 2 bolts | clamp + pin + 2 bolts | clamp + pin; **no** bolts |
| Linked | sockets + conduit + brushed | sockets + conduit + brushed | sockets + conduit |

### Visual state mappings

| modifier | states → key output |
| --- | --- |
| Frozen | `intact/cracked1/cracked2/fracturing/breaking` → cracks `0/1/2/3/3`, progression `0/.25/.55/.8/1`, `baseCompromised` only at `breaking`; also accepts `progress` 0..1 |
| Shielded | `intact/stressed/collapsing/gone` → progression `0/.5/.85/1`; **`baseCompromised` always false** (shell fails first); `airGap` until `gone` |
| Armored | `level` → `plates = clamp(level, 1, 4)` |
| Locked | `locked/unlocking/released` → `desaturate .35 → .35 → 0`, `pinGlow` until released |
| Bomb | `dormant/warning/critical` → `motion null → bombPulse → bombPulse`, progression `0/.5/1`, LED ring toggles by detail. **No countdown logic.** |
| Wild | `idle/active/resolving` → `motion facetShimmer/facetShimmer/wildResolve` |
| Linked | `linkProgress` → `progression`; `linkedPixelIds.length > 0` → conduit + 2 sockets + `linkPulse` |
| Hidden | `concealed/partial/revealed` → concealment `1/.5/0` |

### Overflow / z-order

`MAX_OVERFLOW = 0.18` (fraction of cell). Effective =
`min(MAX_OVERFLOW, kindCeiling, detailCap)` where kind ceilings are Frozen .18 /
Shielded .16 / Locked .16 / Armored .12 / Linked .10 / Wild .06 / Hidden .05 /
Bomb .03, and detail caps are full .18 / medium .10 / minimal .04. Guaranteed:
`2 × overflow ≤ 0.5` — two maxed adjacent modifiers never reach each other's
centre (asserted for all kinds × 6 densities).

Z-order (`MATERIAL_LAYERS`, fixed & tested):
`shadow → baseExtrusion → coloredBody → modifierInner → modifierShell →
highlightRim → damageState → transientHit → colorAssist`. In the render tree:
RN pixel layer → `SpecialPixelLayer` (Skia) → `ColorAssistLayer` (RN) → charge.

### Motion hooks (`src/game/rendering/modifierMotion.ts`)

Reusable, **not attached to any mechanic**. One-shots (`trigger()`-able from
future engine events): `useCrackMotion`, `useShatterMotion`, `useShieldRipple`,
`useShieldCollapse`, `usePlateHit`, `useClampRelease`, `useWildResolve`. Idle
repeats (gated by an `enabled` flag): `useIdleMotion('bombPulse' | 'facetShimmer'
| 'linkPulse' | 'scanReveal')`. All UI-thread. `MODIFIER_MOTION` table is the
tunable duration/period map.

Idle budget: `IDLE_ANIMATION_BUDGET = 6`. `pickIdleAnimated(specials)`
deterministically selects ≤ 6 pixels for idle animation, priority `critical bomb
> resolving wild > other bomb > rest`, stable by id. One-shot-only boards animate
nothing at idle.

### Performance

Base board unchanged. `SpecialPixelLayer` renders `null` until `specials` is
non-empty. One shared Skia canvas for all shells. Deterministic seeded detail
(`hashSeed(pixelId)` → mulberry32) — no allocation per frame, cached geometry.
Idle animation capped at 6; blur used only on frost / pin / facet groups, not
per-pixel. Color Assist marks render only when the preference is on; at minimal
detail the halo pass is dropped (halves the view count per mark).

## B. Full 15-colour Color Assist

### Palette

`OrbColor` extended to the **15** approved colours in hue-wheel order (white,
yellow, gold, orange, red, coral, pink, magenta, purple, indigo, blue, cyan,
teal, green, lime). `orbColors` / `orbGlow` / `orbLabel` all cover 15 with no
extras (tested). No duplicate colour system — `theme/colorAssist.ts` reads
`orbColors`. The old ad-hoc `colorAssistSymbol` map is removed.

### 15-mark mapping (`COLOR_MARKS`)

Machine-language family built from six RN-renderable primitives — `dot`, `ring`,
`bar(angle)`, `tri(dir, fill)`, `sq(angle, fill)`, `arc(dir)`:

| colour | mark | parts |
| --- | --- | --- |
| white | dot | dot |
| yellow | ring | ring |
| gold | target | ring + centre dot |
| orange | bar-h | bar 0° |
| red | bar-v | bar 90° |
| coral | plus | bar 0° + bar 90° |
| pink | cross | bar 45° + bar −45° |
| magenta | double-slash | two parallel bars 45° |
| purple | triangle-up | filled up-triangle |
| indigo | triangle-down | **outline** down-triangle |
| blue | diamond | outline square 45° |
| cyan | chevron | two short bars ∧ |
| teal | arc | half-ring opening up |
| green | split-ring | ring + vertical divider |
| lime | stack | two stacked bars-h |

Every mark is topologically unique (tested); the ring family (yellow/gold/green)
and triangle family (purple/indigo) stay visually related but distinct (added
part; fill vs outline + direction). Only **one** pure single-bar rotation pair
in the whole set (orange↔red).

### Consistent placement

Same mark = same COLOUR everywhere, from one model (`colorMark(color)`):
- **board pixel** — `ColorAssistLayer` (RN), one inset mark per uncleared pixel,
  above the special-pixel shell layer;
- **orbiting charge** — bottom-inset etched mark, never behind the capacity
  number (capacity has priority);
- **tunnel front charge** — bottom-inset etched mark;
- **Holding charge** — bottom-inset etched mark.

### Contrast strategy (`markContrast`, luminance-driven)

`luminance(orbColors[color])`: `≥ 0.5` → **darkOnLight** (dark fill, no halo);
`≤ 0.24` → **lightOnDark** (light fill, no halo); between → **lightHaloed**
(light fill + dark halo pass). Tested against every palette colour.

### Density fallback (`markDetail` / `simplifiedMark`)

`≤ 9 full`, `10-13 compact`, `≥ 14 minimal`. Minimal drops composed marks to
their dominant part and raises the minimum relative stroke to `0.18`; the
identity anchor (first part) always survives. Halo pass dropped at minimal.

### Settings hook

`src/storage/settings.ts` (AsyncStorage) + `src/hooks/useColorAssist()`
(module-cache pub/sub, no context provider). **Defaults OFF.** `off | on` only.
`recommendColorAssist(distinctColorCount)` returns `true` at `≥ 6` colours —
a hint flag, never auto-forced. Dev toggle added to `DebugOverlay`
("assist: on/off"). `GameScreen` threads `enabled` to board + tunnels + Holding.

### Accessibility

- `ColorAssistMark` is `pointerEvents="none"` and unlabelled (decorative overlay
  — not over-announced).
- Charge views carry `accessibilityLabel` "`<Colour>` charge, capacity `<n>`";
  tunnel / Holding labels unchanged ("Launch tunnel 1, blue charge 5", "Relaunch
  green charge, capacity 2").
- Colour is never the only channel when Color Assist is on (unique mark per
  colour); modifier type stays independently identifiable (geometry, not hue);
  capacity number keeps priority over the mark.

## Files

New: `src/theme/colorAssist.ts`, `src/game/rendering/specialPixels.ts`,
`src/game/rendering/modifierMotion.ts`, `src/game/rendering/SpecialPixelLayer.tsx`,
`src/game/rendering/ColorAssistLayer.tsx`, `src/components/ColorAssistMark.tsx`,
`src/hooks/useColorAssist.ts`, `src/storage/settings.ts`, three test files.

Changed: `src/game/engine/types.ts` (15 colours + `ModifierKind`/`ModifierInstance`
+ `Pixel.modifier?`), `src/theme/colors.ts` (15-colour maps), `src/theme/arcade.ts`
(drop `colorAssistSymbol`), `src/game/rendering/{OrbitBoard,OrbitingCharge,Pixel}.tsx`,
`src/components/{TunnelBar,HoldingTray,DebugOverlay}.tsx`, `src/screens/GameScreen.tsx`.

## Validation

- `npm test` — **145 passed, 15 suites** (was 117 / 12). New: `specialPixels.test.ts`
  (+16), `colorAssist.test.ts` (+7), `specialComposition.test.ts` (+5). No
  existing test weakened.
- `npm run typecheck` — pass. `npm run lint` — pass.
- `npx expo-doctor` — 21/21.
- `npx expo export --platform all` — iOS 4.3 MB + Android 4.5 MB → `dist/m2a4/export`.
- No device / simulator run — no screenshots.

Tests cover the brief's list: modifier rendering model, density thresholds,
overflow limits, state→visual mapping, deterministic detail, z-order,
Color-Assist mapping uniqueness, 15/15 coverage, mark uniqueness, contrast
strategy mapping, special-pixel + Color-Assist composition order, dense-board
matrix (8 kinds × 15 colours × 6 densities).

## Known visual risks (need a device pass)

1. `SpecialPixelLayer` has never rendered a real special pixel — the shell art
   is unproven on device; the model is the tested deliverable.
2. Bomb `cavity` hole-vs-dome read depends on the `RadialGradient` + rim; verify
   it never looks like an orbital charge on top.
3. Color Assist at 15×15 with the preference on adds ~1-2 RN views per pixel —
   validate frame rate on a low-end Android with a synthetic dense board.
4. Outline triangle (indigo) is 3 rotated bars — may look ragged at ~8px; the
   heavier minimal stroke should hold it.
5. Etched charge marks on the lightest bodies (white, lime, cyan) rely on the
   dark fill — confirm legibility while the charge is moving over bright art.
6. Slight hue shift on red/orange/yellow from the palette re-spread — check the
   existing 10 levels still read.
7. `markContrast` `lightHaloed` renders the mark twice (halo + fill) — fine for
   a handful, watch it if a future level is colour-dense AND high-density.

## TUNABLE

- `MAX_OVERFLOW` (0.18), `OVERFLOW_BY_DETAIL`, `OVERFLOW_BY_KIND`,
  `materialDetail` thresholds, per-kind detail counts (`specialPixels.ts`).
- `MODIFIER_MOTION` durations/periods, `IDLE_ANIMATION_BUDGET` (6)
  (`modifierMotion.ts`).
- 15 mark part definitions, `markContrast` luminance thresholds (0.5 / 0.24),
  `markDetail` thresholds, `simplifiedMark` min-stroke ramp, `recommendColorAssist`
  threshold (6) (`colorAssist.ts`).
- The 15 palette hexes + glows (`colors.ts`).
- Charge/tunnel/Holding mark size + inset (`OrbitingCharge`, `TunnelBar`,
  `HoldingTray`); board mark size fraction `cell * 0.52` (`ColorAssistLayer`).

## Deferred (unchanged from the brief)

Every actual mechanic (Frozen / Shielded / Armored / Locked / Bomb / Wild /
Linked / Hidden gameplay rules), five-orbit gameplay, backend, accounts, ads,
purchases, economy, store, daily rewards, a real collections system (only the
`collectionId` / `linkId` metadata hooks), sound assets, a full Settings screen.
