# M2A.3 — Win / Discovery reveal + Difficulty Gate

Branch: `milestone/1-core-prototype`. Local commit only; no push, no merge.
Builds on M1 `93bca4b`, M2A `9c1956a`, M2A.2 `83d12dc`. Implementation pass on the
approved visual direction — no redesign, no mascot, no new mechanics, no engine
rule changes, no backend/monetization/store/economy. Reuses `theme/arcade.ts`
and the M2A material/charge language.

## Deliverable 1 — Win / Discovery reveal

### Trigger (engine truth, never the animation)

`buildScript` marks the pixel-clear that completes the picture with `final: true`
and records `pass.finalClearPixelId` — only when `outcome.state.status === 'won'`
(engine truth). `useGameSession.presentThrough` still walks the authored event
list; on the `final` clear it emits the stronger `finalClear` cue and suppresses
the coincident `chargeConsumed` impact (not the other way round). `state.status`
flips to `'won'` at the engine `win` event; `GameScreen` mounts the reveal off
that boolean. The animation cannot make the game won.

### Final pixel event

- `EnergyShot` reads `pass.finalClearPixelId`: the last flash is larger, holds
  ~180ms and adds a soft local bloom at the **actual final cleared cell** — no
  full-screen white.
- Haptic: `finalClear` = Heavy impact (vs the normal Rigid `pixelPop`).
- The old `win`-event success buzz is moved off — see hook map — so buzzes never
  stack.

### Reveal architecture

| Piece | File | Role |
| --- | --- | --- |
| Pure model | `src/game/rendering/revealGeometry.ts` | `resolveReveal(level)` + `revealTimeline(reducedMotion)` |
| Authored data | `LevelReveal` in `engine/types.ts`, on levels 1/2/10 | optional `reveal` on `LevelDefinition` |
| Constellation renderer | `src/game/rendering/DiscoveryReveal.tsx` | Skia: ghost + lines + nodes + particles |
| Title / NEXT / reward | `src/components/DiscoveryOverlay.tsx` | RN, driven by the shared progress |
| Composition | `src/screens/GameScreen.tsx` | one `revealProgress` shared value, linear 0→1 over `tailMs` |

`DiscoveryReveal` is a **reusable renderer**: it takes `size`, `level`, the won
`state` (pixels keep their positions), a `progress` SharedValue and
`reducedMotion`. It recomputes the exact same `computeBoardGeometry` the board
uses, so the ghost and nodes stay spatially aligned with the solved picture. It
draws:

1. a holographic **ghost** of every original pixel (fades 0 → 0.34 → 0.13);
2. the **constellation lines** as one Skia `Path` with an animated `end` (a real
   progressive draw), softened by `Blur`;
3. the **nodes** — per-node `useDerivedValue` for a staggered rise + brighten +
   halo (accent nodes are white/warm and larger);
4. **8 restrained particles** — fixed count, deterministic per level id, drift
   out and fade (≤ 0.4 opacity). None under reduced motion.

No React state per node, no per-node JS timer, no board re-render per frame — one
master `progress` value, everything else is a UI-thread derived value.

### Authored reveal metadata

```ts
interface LevelReveal {
  name: string;                       // discovery name
  nodes: { x: number; y: number }[];  // cell coords, may be fractional
  lines: [number, number][];          // index pairs into nodes
  accentNodes?: number[];             // brighter nodes
  collectionId?: string;              // passive hook for a future collection system
}
```

Attached to **Level 1 (THE CRESCENT), Level 2 (THE GUIDING STAR), Level 10
(TOTAL ECLIPSE)**. The other seven levels use the fallback. Authored vs fallback
is surfaced as `ResolvedReveal.source` and shown as the overlay kicker —
`DISCOVERY` (authored) vs `STAR CHART` (fallback).

### Fallback reveal algorithm (deterministic, never random)

For a level with no authored `reveal`:

1. Parse the pixel positions with the engine's own `parsePixelArt`.
2. For each of eight compass directions, pick the pixel maximising `x·dx + y·dy`
   — the silhouette's extreme point in that direction. Ties break on lowest
   `(y, x)` then id.
3. De-duplicate, then order by angle around the centroid → a non-self-
   intersecting outline.
4. `lines` = consecutive nodes closed into a loop (one line per node).
5. `accentNodes` = the topmost node. `name` = the level title upper-cased.
6. Empty artwork → a fixed centred triad (still deterministic).

Invalid authored data (out-of-range line index, < 2 nodes, no name) silently
falls back. `resolveReveal` is pure and deep-equal-stable on repeat.

### Exact reveal timings (`revealTimeline`, all TUNABLE)

| beat | full (ms) | reduced (ms) |
| --- | --- | --- |
| settle / micro-pause | 150 | 60 |
| nodes lift/brighten | 220 → 720 | 80 → 240 |
| constellation lines | 480 → 1000 (draw) | 180 → 360 (short fade, `end` = 1) |
| discovery title | 780 → 1080 | 300 → 520 |
| NEXT visible | 1000 | 360 |
| **NEXT interactive** | **1320** | **560** |
| decorative tail (master duration) | 3200 | 900 |

NEXT is pressable at 1320ms while nodes/particles keep animating behind it —
`revealProgress` (the master value) is not gated by NEXT and NEXT is never
disabled because "particles are still running".

### NEXT button

`DiscoveryOverlay` renders the M2A.2 `PlayButton` (same physical metal family)
labelled `NEXT` (or `BACK TO HOME` on the last level). Immediate press feedback
(`select` haptic on press-in), `nextPress` haptic + existing `onAdvance` on
release. Visibility is an opacity ramp from `nextVisibleMs`; interactivity is a
`disabled` flag flipped by a `useAnimatedReaction` on `progress` crossing
`nextInteractiveMs` — no JS timer. Progression logic is unchanged (`onAdvance` →
`router.setParams`).

### Reward presentation

A single isolated `◈ REWARD PENDING` chip fades in after the title, at 0.7
opacity, visually subordinate. No economy logic, no slot-machine motion — it
fires the `reward` sound hook once and is a clean placeholder for the economy
pass.

### Haptic / sound hook map

| hook | haptic | sound event | fires |
| --- | --- | --- | --- |
| `finalClear` | Heavy impact | `finalClear` | the winning pixel clear |
| `win` | — (sound only now) | `win` | engine `win` event |
| `discoveryResolve` | Success notif + Medium @120ms | `discoveryResolve` | title resolves (`titleEndMs`) |
| `reward` | — | `reward` | reward chip appears |
| `nextPress` | Medium impact | `nextPress` | NEXT pressed |

Exactly one success buzz per win (at reveal confirmation), one Heavy at the
final clear — they are ~1s apart and never overlap. Sound hooks are names only;
no audio assets produced.

### Reduced motion

`useReducedMotion()` in `GameScreen` selects `revealTimeline(true)`: ~900ms
total, NEXT interactive at 560ms, no node rise, no particles, lines appear as a
short fade (`end` jumps to 1). Title still resolves; final-state ghost + nodes
still read.

### Reveal performance

- One Skia `<Canvas>`, one master `progress` SharedValue.
- Ghost = static `RoundedRect`s in one `Group` with an animated opacity.
- Lines = one `Path`, animated `end`.
- Per-node / per-particle `useDerivedValue` only (≈ 50 total for a 9-node
  reveal); no `setState`, no timers, no full board re-render.
- The gameplay board (`OrbitBoard`) stays mounted showing the rail; the reveal
  is a transparent overlay.

## Deliverable 2 — Difficulty Gate

### Architecture

One authoritative model in `src/game/levels/difficulty.ts`:

- `gateGeometry(difficulty)` → `GateGeometry` (the tier's shape spec).
- `gatePrimitives(difficulty, size)` → pure draw data (paths, block rects, ticks)
  for a `size×size` box — testable straight from output.
- `gateIntroTimeline(difficulty)` → `{ duration, phases, haptic, sound }` — the
  future level-intro animation hook (exposed, restrained implementation).
- `difficultyMeta` is now a thin **derived** accessor over the same table (no
  duplicate definition); `difficultyA11yLabel` gives "Difficulty: Super Hard".

`src/components/difficulty/DifficultyGate.tsx` renders it in Skia, three
variants: `hud` (18px icon + label), `badge` (30px + label under), `intro`
(88px, optional `animateIn` settle). `memo`'d — stable for the life of a level.

### Exact geometry per tier (block count = tier = the reliable non-colour counter)

| tier | key → label | frame | blocks | segments | outer guard | fracture | stroke× | accent |
| --- | --- | --- | ---: | ---: | :-: | :-: | ---: | --- |
| 1 | easy → **NORMAL** | clean ring | 1 | 0 | – | – | 1.00 | accent |
| 2 | medium → **MEDIUM** | **segmented ring** | 2 | 4 | – | – | 1.18 | accent |
| 3 | hard → **HARD** | **hexagon** | 3 | 6 | – | – | 1.34 | warn |
| 4 | super-hard → **SUPER HARD** | hexagon | 4 | 6 | **yes** (2nd hex) | – | 1.50 | danger |
| 5 | extreme → **EXTREME** | hexagon | 5 | 8 | yes | **yes** (asymmetric energy break) | 1.70 | danger |

Separators, in order of reliability: **block count** (1→5), **frame shape**
(ring for 1–2, hex for 3–5), **segmentation** (0 for NORMAL, ≥4 otherwise —
this is the NORMAL↔MEDIUM fix), **outer guard** (HARD↔SUPER HARD), **fracture**
(SUPER HARD↔EXTREME). A test asserts every pair of tiers differs in ≥ 2 of these
non-colour dimensions and that the five non-colour signatures are unique.
EXTREME's fracture is a bright energy break across a *heavier* frame with the
*most* blocks — reads as intensity, not damage.

### Material

Machined metal frame (`metalHi`) + a thin energy inlay (accent), inset glow
(blurred wide stroke), physical mounting blocks (`metalRaised` + accent cap),
`metalLo` segment ticks. Hue is a secondary accent (`accent`/`warn`/`danger`
from `arcade.ts`) — no traffic-light, no flat badge fill.

### HUD legibility (~88×18)

`hud` variant = 18px machined icon + the text label ("NORMAL" … "EXTREME").
Text label + frame shape + segmentation together keep NORMAL and MEDIUM clearly
apart at that size; block count and guard/fracture reinforce the higher tiers.
`gatePrimitives` is tested at both 18px and 88px.

### Difficulty-intro hooks

`gateIntroTimeline` exposes `duration` (NORMAL 310ms → EXTREME 670ms), per-
structure `phases` fractions (guard/fracture phases are 0 unless the tier has
them), a `haptic` name (`gateLock` for tier ≥ 3, `select` for tier 2) and a
`sound` name (`gate_<key>`). `DifficultyGate` has an `animateIn` prop that plays
a restrained scale/opacity settle over that duration. No full cinematic intro —
there is no level-intro route yet.

### Accessibility

Non-colour geometry is the primary identifier (see the distinction test). Every
Gate has `accessibilityRole="image"` + `accessibilityLabel` "Difficulty: <Tier>".
Distinguishable in grayscale and at small size by construction.

## Integration

- **Home** (`LevelBadge`): the temporary 5-pip indicator is **removed**;
  `LEVEL N` + `<DifficultyGate variant="badge">`. Home hierarchy unchanged
  (centerpiece > PLAY > level info > top utility).
- **Gameplay HUD** (`Hud`): `<DifficultyGate variant="hud">` rides the existing
  progress line as `[gate] LABEL · cleared/total` — HUD grows ~5px, the board
  stays hero. `GameScreen` passes `level.difficulty`.
- Win: `GameScreen` renders `DiscoveryReveal` (board overlay) + `DiscoveryOverlay`
  (lower third) when `status === 'won'`; `ResultOverlay` now only handles the
  loss path.

## Validation

- `npm test` — **117 passed, 12 suites** (was 97 / 11). New:
  `revealGeometry.test.ts` (+6), `difficulty.test.ts` (+7, was 3), plus
  `buildScript` (+2), `haptics` (+ cases), `levelDefinitions` (+1). No existing
  test weakened.
- `npm run typecheck` — pass. `npm run lint` — pass.
- `npx expo-doctor` — 21/21.
- `npx expo export --platform all` — iOS 4.3 MB + Android 4.5 MB → `dist/m2a3/export`.
- No device / simulator run — no screenshots.

Focused tests added, mapped to the brief: authored reveal parsing ✓, fallback
determinism ✓ (+ empty-art + invalid-authored fallback), NEXT availability
ordering ✓, reduced-motion reveal timeline ✓, difficulty tier geometry mapping
✓, compact Gate distinction ✓ (pairwise ≥2 non-colour diffs), grayscale/non-
colour identifier uniqueness ✓, `gatePrimitives` at 18px & 88px ✓, single-source
`difficultyMeta` delegation ✓. Component render tests are not in the harness
(jest is node-env, `roots: src/game`); Home/HUD wiring is covered by typecheck +
lint + the shared pure model.

## Known visual risks (need a device pass)

1. Constellation node alignment vs the faded ghost on 7×7 boards — the geometry
   matches by construction, eyeball it.
2. Skia `Path` `end` progressive draw across many `M…L…` subpaths trims by total
   length; the sweep order for level 2's 16 lines (spokes then rim) may look
   uneven — reorder authored `lines` if so.
3. Reveal readability over the still-mounted `OrbitBoard` rail — confirm the rail
   doesn't fight the constellation.
4. `DiscoveryOverlay` scrim covers the controls; verify it fully hides the
   Holding/Tunnel/Tools row on tall and short phones.
5. Difficulty Gate at 18px on low-DPI Android — blocks may blur; the text label
   carries it but check.
6. `finalClear` Heavy impact on devices that map Heavy≈Rigid — may not feel
   distinct from `pixelPop`; fall back to a double-Rigid if needed.
7. EXTREME fracture has no real level yet (no `extreme` levels ship); its look is
   unproven on device.

## TUNABLE

- `revealTimeline` — every beat, full + reduced (`revealGeometry.ts`).
- Master reveal easing (`Easing.linear`) and `DiscoveryReveal` interpolation
  windows, particle count (8), ghost opacity stops, node rise (`cell·0.5`).
- `DiscoveryOverlay` scrim opacity (0.82), title/reward/next opacity ramps.
- `gateGeometry` table — labels, block counts, segment counts, strokeScale,
  accents; `gatePrimitives` padding / block size / tick length; `gateIntroTimeline`
  durations and phase fractions (`difficulty.ts`).
- `DifficultyGate` `ICON` / `LABEL_SIZE` per variant; HUD `subRow` height.
- Haptic weights: `finalClear` Heavy, `nextPress` Medium, `gateLock` Rigid
  (`haptics.ts`).
- Authored reveals on L1/L2/L10 (`levelDefinitions.ts`); add more or retune nodes.

## Deferred (unchanged from the brief)

Special pixel materials (Frozen/Shielded/Armored/Wild/Bomb/Linked/Hidden/Locked),
five-active-orbit gameplay, backend/accounts/ads/purchases/economy/store/daily
rewards, a real collections system (only the `collectionId` metadata hook),
final sound assets, the full cinematic Difficulty Gate intro and any level-intro
route.
