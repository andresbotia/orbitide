# M3.6B — Pixel Arcadia Brand Implementation

Production branding/UI pass. **No gameplay, engine, solver, level-data, campaign
or Level Studio behaviour was changed.** Source of truth: the approved
*Pixel Arcadia Brand System* (M3.6A production branding lock) plus the M3.6B
implementation corrections.

---

## 1. Brand assets

### Raster (`assets/`)
| File | Size | Alpha | Purpose |
| --- | --- | --- | --- |
| `icon.png` | 1024² | opaque | Full-bleed app-icon master (OS masks corners). Regenerated from the approved `glowing_pixel_sun_portal.png`: centred card crop, 6% safe inset, composited on `#07060D`. |
| `adaptive-icon.png` | 1024² | transparent | Android adaptive **foreground** — arch + core focus-cropped and centred; plinth/pier edges fall in the mask sacrificial zone. |
| `android-icon-foreground.png` | 1024² | transparent | Same art; keeps the existing 3-file adaptive config working. |
| `android-icon-background.png` | 1024² | opaque | Flat `#120E2A` (`brand.backgroundAlt`). |
| `android-icon-monochrome.png` | 1024² | transparent | White logo-mark silhouette for themed icons. |
| `splash-icon.png` | 1024² | transparent | Stacked lockup — geometry mark + `PIXEL` / `ARCADIA` in Space Grotesk 700. `resizeMode: contain` on `#07060D`. |
| `favicon.png` | 64² | opaque | Core-only plus-shape on `#120E2A` rounded square (§13). Drives the generated `favicon.ico` (16/32/48). |
| `favicon-32.png` / `favicon-16.png` | 32² / 16² | opaque | Standalone simplified sizes (16 = flat `#FFC94D` square). Also copied to `public/`. |

### Vector (`assets/brand/`, static — web/marketing only, not imported by RN)
`logo-mark.svg` (+`-mono-light`, `-mono-dark`), `wordmark.svg` (+`-stacked`),
`logo-horizontal.svg`, `logo-stacked.svg`. 120-unit viewBox, no embedded raster,
no filters. Clear space baked into the lockup viewBoxes.

### Regeneration
`python scripts/generate-brand-assets.py` (requires Pillow + numpy and the
approved master in `~/Downloads/`). Deterministic; safe to re-run.

---

## 2. Brand tokens — `src/theme/brand.ts`

Pure module, **no React/RN imports**, importable from unit tests. Kept fully
separate from the 15 gameplay colours (`theme/colors.ts`) and the in-game
material language (`theme/arcade.ts`). A gameplay colour is never a brand colour
and vice-versa (asserted in tests).

**11 colour tokens** (`brandColor.*`): `background #07060D`, `backgroundAlt
#120E2A`, `indigo #4B47C9`, `violet #9A7BFF`, `portalWarm #FFB24D`, `cyanAccent
#4DE1FF`, `textPrimary #EDEAF6`, `textSecondary #948FB0`, `surface #1A1730`,
`border #2A2440`, `glow #FFB24D`. Plus `brandInk #2A1405` (CTA label ink).

**4 gradients** (`brandGradient.*`, no fifth allowed): `background` (radial
indigo field), `core` (radial warm white→#F2662E), `cta` (linear 180° amber),
`surface` (linear 165° violet-grey). Centralised through `<BrandGradientView>`.

**5 additive motion tokens** (`brandMotion.*`): `portalBreathe`, `corePulse`,
`particleArrival`, `wordmarkReveal`, `iconEntrance` — each declares its
reduced-motion resolution (`end-state` / `static-hold`). Gameplay motion tokens
untouched.

**Wordmark contract** (`wordmark`): Space Grotesk 700 (`SpaceGrotesk_700Bold`),
`PIXEL` = `textPrimary`, `ARCADIA` = `portalWarm`, equal weight, tracking
0.10/0.14/0.20 em by layout, 15px min.

---

## 3. Icon configuration (`app.json`)

- `expo.name` = **"Pixel Arcadia"**, `expo.web.name` = **"Pixel Arcadia"**.
- `expo.backgroundColor` `#05060A` → `#07060D`.
- `expo.icon` → `./assets/icon.png` (unchanged path, new art).
- `android.adaptiveIcon.backgroundColor` `#05060A` → `#120E2A`; foreground /
  background / monochrome image paths unchanged (art regenerated).
- `expo-splash-screen` plugin `backgroundColor` `#05060A` → `#07060D`.
- `web`: added `name`, `themeColor`/`backgroundColor` `#07060D`; `favicon`
  path unchanged.

**Preserved verbatim**: `slug` `orbitide`, `scheme` `orbitide`, iOS
`bundleIdentifier` `com.andresbotia.orbitide`, EAS `projectId`
`07cb395c-…`, `updates.url`, `runtimeVersion`, Android package.

---

## 4. Logo mark — `src/components/brand/LogoMark.tsx`

Rebuilt-as-geometry portal glyph: 5-block arch + plus-shaped pixel core on the
4-unit grid (`geometry.ts`). Variants: `full` (violet-blue block gradient + warm
core), `mono-light` (`#120E2A`), `mono-dark` (`#EDEAF6`, or a custom `ink`).
Optional `glow` layer (never in the file), optional `unlit` (core removed → an
unlit portal). Arms auto-drop below 24px.

> **Deviation:** the project has **no `react-native-svg`** (gameplay renders with
> Skia). The in-app mark is drawn with plain `<View>` rectangles — the simplified
> mark is ~9 rects, so this stays dependency-free and cheap. The `.svg` files are
> shipped for web/marketing only. The decorative crown **diamond is omitted** —
> identity is arch + core, per correction #3.

---

## 5. Wordmark — `src/components/brand/PixelArcadiaWordmark.tsx`

**Live accessible text**, never an image (correction #1). `layout`:
`single` | `stacked` | `compact`. `PIXEL` off-white, `ARCADIA` portal amber;
colour split + tighter word gap only, never a weight change. `accessibilityRole
="header"`, collapses to a single "PIXEL ARCADIA" label. Falls back to the system
bold face until `SpaceGrotesk_700Bold` loads (`useFonts` in `app/_layout.tsx`;
startup never blocks on it — the native splash is held only until the font
resolves or errors).

Outlined SVG masters (`assets/brand/wordmark*.svg`) exist for splash/marketing
lockups.

---

## 6. Home changes — `src/screens/HomeScreen.tsx`

Structure, hierarchy, PLAY position, level preview and surrounding layout
**unchanged**. Applied:

- Top wordmark: grey `<Text>` → `<PixelArcadiaWordmark layout="stacked" />`
  (live text, brand colours). Dev secret-reset long-press preserved.
- One rationed warm radial wash behind the centrepiece (`brandColor.glow`, two
  soft discs at 6% / 10% ≤ 18% total). **No portal arch motif** behind the
  preview — that is the whole of Home's arch budget.
- PLAY now uses the shared primary-CTA treatment (see §7).

---

## 7. Primary CTA — `src/components/brand/PrimaryCta.tsx`

One shared control for **PLAY / NEXT / CONTINUE / RETRY**. `primary`: `grad.cta`
fill, inset top highlight `rgba(255,255,255,.55)` + bottom lip
`rgba(150,70,10,.40)`, warm drop glow `rgba(255,138,31,.32)`, ink `#2A1405`,
700 / +0.16em / uppercase, min-height 52, radius 16. Pressed: `translateY(2)`,
lip removed, glow dimmed. Disabled: `surface` fill + `textSecondary` ink, no
glow. `secondary`: `grad.surface` + 1px border.

- `PlayButton` is now a thin wrapper over `PrimaryCta` (same props/position).
- `ResultOverlay` NEXT / BACK TO HOME / TRY AGAIN routed through `PrimaryCta`;
  card adopts `brand.surface` / `brand.border`.

> **Deviation:** added **`expo-linear-gradient`** (Expo-managed, autolinked, no
> config) to render the four approved gradients faithfully via
> `<BrandGradientView>`. This is the "expo-linear-gradient or the existing
> gradient path" option named in the brand system.

---

## 8. Splash / launch

Static native launch screen only: `splash-icon.png` (stacked lockup) contained
on `#07060D`, no animation, no gameplay UI. Startup is **not** gated on branding
— the font load holds the native splash at most until resolve/error, then
`SplashScreen.hideAsync()`. The optional post-mount core-pulse continuation is
**not** wired (no existing app-loading surface to host it safely); `CorePulse` is
available if one is added later.

---

## 9. Loading / error / empty

Shared primitives built, exported from `src/components/brand`:

- `CorePulse` / `BrandLoader` — the pixel-core breathing pulse (§ Loading).
  Token-driven, zero asset dependency, `accessibilityRole="progressbar"`,
  label "Loading". Reduce-motion → static core at full opacity.
- `BrandEmptyState` — unlit-portal mark (`mono-dark` @ `border`) + 17px headline
  + one line of copy + optional secondary button + ≤3 4px pixel squares. Same
  construction for no-content / failed-load / offline; no mascot.

The consumer app currently has **no blocking full-screen loading or empty
surface** to retrofit (the only `ActivityIndicator` is in the dev-only, web-only
Studio, which is out of scope). `ResultOverlay` is the one shared result surface
and it is branded. The primitives are ready for the first real async surface.

---

## 10. Favicon / web

`web.favicon` → the simplified core-only `assets/favicon.png`; Expo generates
`favicon.ico` with 16/32/48 embedded. `app/+html.tsx` sets `<title>Pixel
Arcadia</title>`, description, `theme-color #07060D`, `apple-touch-icon`.
`public/favicon-16.png` / `-32.png` shipped for manual linking.

> **Note:** Expo Router SSG normalises `<head>`; extra `<link rel="icon">` tags
> in `+html.tsx` are dropped in favour of the config-generated `.ico`. Verified
> in `expo export -p web`: title and theme-color resolve correctly.

---

## 11. Accessibility

- Wordmark is live text with a single collapsed screen-reader label; ≥15px,
  tracking ≥0.10em.
- Logo mark authored glow-free; recognisable in flat mono. Decorative marks pass
  `accessibilityLabel={null}` (hidden) next to the live wordmark.
- Colour never sole carrier: PIXEL/ARCADIA split has the word gap; unlit-portal
  empty state carries copy; loader has an a11y label + `busy` state.
- Contrast: `textPrimary` 16.9:1, `textSecondary` 6.0:1, CTA ink on `portalWarm`
  8.9:1 — all AA at body size (from the approved system).

## 12. Reduced motion

`CorePulse` starts and stays at end-state when `useReducedMotion()` is true (no
repeat animation registered). `BrandLoader` remains a labelled static core.
`brandMotion` tokens each declare their reduced-motion resolution. No new
always-on animation was added to Home or gameplay.

## 13. Performance

- Brand marks are static `<View>` trees (≤ ~15 nodes), memoised. No SVG runtime,
  no Skia added for branding, no blur stacks, no JS-frame loops.
- One `expo-linear-gradient` per CTA; `<BrandGradientView>` memoised.
- Home adds two flat low-opacity discs — no animation, no measure work.
- `CorePulse` uses a single Reanimated shared value on the UI thread.
- Fonts: 1 TTF (87 KB) bundled; UI never blocks on it.

---

## 14. Technical identifiers intentionally preserved

`slug` `orbitide` · `scheme` `orbitide` · iOS bundle `com.andresbotia.orbitide`
· Android package · EAS `projectId` / `updates.url` · AsyncStorage keys · git
repo name · historical `docs/`. Lowercase `orbitide` appears only in these
technical contexts (and a code comment noting it is technical).

## 15. Remaining legacy-brand occurrences

`ORBITIDE` / `Orbitide` in active consumer UI source: **none** (asserted by
`appIdentity.test.ts` and `brand.test.ts`). Remaining `orbitide` occurrences are
all technical identifiers or historical `docs/M1..M3` reports (M3.5 intentionally
preserved these).

## 16. Tests

`src/game/__tests__/brand.test.ts` — 40 cases: token structure + exact hex,
4-gradient cap, 5 motion tokens with reduced-motion field, brand ⟂ gameplay
colour separation, Home wordmark integration, PLAY/Result → `PrimaryCta`, font
loading wiring, `app.json` display-name-over-identifiers, web title/favicon,
asset presence, vector-mark purity, reduced-motion fallbacks, no new legacy
strings. Existing `appIdentity.test.ts` unchanged and still green.

Full suite: **454 passed** (was 414). No assertions weakened.

## 17. Validation results

| Check | Result |
| --- | --- |
| `jest` | 44 suites, 454 tests passed |
| `tsc --noEmit` | clean |
| `eslint .` | clean |
| `expo-doctor` | 21/21 passed |
| `expo export -p web` | ok — `<title>Pixel Arcadia`, theme-color `#07060D`, favicon.ico 16/32/48 |
| `expo export -p ios` / `-p android` | ok — bundles produced |
| Studio in native bundle | not present (`LevelStudioScreen`, `WitnessVisualizer`, `analyzeLevel`, `AnalysisPanel`, "Level Studio" all absent from iOS/Android hbc) |

Device testing not performed.

## 18. Known limitations / risks

- **Splash mark** is a PIL-rendered composite; arch keystones read as separate
  blocks (as in the approved SVG) — acceptable for a <900ms launch screen.
- **Adaptive foreground** is a focus-cropped composite of the master art, not a
  hand-cut arch+core on transparent; the card's own dark field (not exactly
  `#120E2A`) sits inside the mask circle. Reads as the icon; a bespoke cut could
  be authored later.
- **Alternate lighter/darker icon variants** (§1 of the brand system) not
  shipped — they need art-level editing of the master, not just a bg swap.
- **180/120 hand-tuned icon tiers** not authored (correction #2 — 1024 master +
  downscale until proven insufficient).
- **`+html.tsx` extra favicon links** are stripped by Expo Router SSG; the
  generated multi-size `.ico` covers the requirement.
- `expo-linear-gradient` + `@expo-google-fonts/space-grotesk` are new
  dependencies (both Expo-managed, autolinked, low risk).

## 19. Brand-spec deviations (summary)

| Spec expectation | What shipped | Why |
| --- | --- | --- |
| Marks via `react-native-svg` | Plain `<View>` geometry | Not a project dependency; Skia is. Mark is ~9 rects. |
| Space Grotesk "already loaded" | Bundled via `@expo-google-fonts/space-grotesk` + `useFonts` | It was **not** loaded. |
| Gradients via existing path | Added `expo-linear-gradient` | No gradient path existed in RN chrome; option is named in the spec. |
| 3 raster icon tiers | 1024 master + adaptive + favicons | Correction #2. |
| Wordmark SVG-only | Live text in-app, SVG for lockups | Correction #1. |
| Crown diamond | Omitted from the geometry mark | Correction #3. |
| Post-mount splash continuation | Not wired | No safe host surface yet. |
