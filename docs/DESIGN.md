# Pixel Arcadia — Consumer Design System

Living reference for every consumer-facing surface (Home, campaign navigation,
gameplay, result/tutorial overlays). Established in M4C.11.1 from the existing
Pixel Arcadia brand system (M3.6B, `src/theme/brand.ts`) — this document does
not introduce a new visual identity, it makes the existing one's rules
explicit and consistent so later M4C.11 phases have one thing to check
against.

**Not covered here**: Studio (`/studio`, dev+web only) has its own
`src/components/studio/theme.ts` and must never be treated as a consumer
design reference (per M4C.11 Part 2 instruction). Engine/solver/level content
is untouched by this document entirely.

---

## 1. Token systems — which one, where

Three token modules currently exist and each has a real job. **Use the one
whose job matches the surface — do not invent a fourth, and do not reach
across systems inside one component** (the audit flagged `ResultOverlay.tsx`
and `LevelBadge.tsx` mixing systems; fix as touched, don't blanket-refactor).

| System | File | Job | Use for |
| --- | --- | --- | --- |
| `brandColor` / `brandGradient` / `brandMotion` | `theme/brand.ts` | Brand surface | Logo/wordmark, primary CTAs, card/sheet chrome (surface/border fills), splash, empty/loading states |
| `palette` | `theme/colors.ts` | UI/system chrome text + status | Body/heading text color, success/danger/warning semantics *when the surface isn't a branded card* |
| `arcade` | `theme/arcade.ts` | In-game material language | Board environment, HUD metal bezels, sockets/tunnels/holding hardware, gameplay accent/warn/danger |

Rule of thumb: **if it's a physical piece of the game machine (HUD, tunnels,
holding, board), it's `arcade`. If it's brand chrome (a CTA, a modal card, an
empty state), it's `brandColor`. `palette` is the fallback for plain UI text
that isn't inside a branded card.** A single component should draw from at
most two of the three, and only when there's a real reason (e.g. a branded
card containing plain status text).

`orbColors` / `orbGlow` / `orbLabel` (also `theme/colors.ts`) are the 15
gameplay charge colors — reserved for charges/pixels only, never for chrome,
per the existing brand ⟂ gameplay separation rule (asserted in
`brand.test.ts`; do not weaken).

## 2. Spacing scale

`theme/spacing.ts` — use it for every gap, margin, and padding value:

```
spacing: xs 4, sm 8, md 16, lg 24, xl 32, xxl 48
```

Component *dimensions* (a socket's diameter, a glow circle's radius, a
button's fixed width) are allowed to be local constants when they're a real
hardware size, not spacing — but prefer deriving them from `spacing`/`radius`
multiples where a natural relationship exists, and never invent a new
one-off spacing value when an existing token covers it.

## 3. Corner radii

`theme/spacing.ts` → `radius: sm 8, md 14, lg 22, pill 999`.

- `pill` — HUD progress track, tutorial banner, tags.
- `lg` — cards/sheets (`ResultOverlay`, future modals).
- `md` — buttons, tiles, tunnel/holding hardware (`PrimaryCta` currently uses
  a local `RADIUS = 16` between `md` and `lg` — acceptable as a deliberate
  CTA-specific value, not a pattern to copy elsewhere).
- `sm` — small chips/badges.

Do not add a fifth radius value. If nothing fits, that's a signal to use the
nearest existing one, not to add a new token.

## 4. Stroke / border rules

- Hairlines/dividers: `brandColor.border` (`#2A2440`), 1px.
- Hardware bevels (tunnels, holding, HUD icon buttons): the existing
  `metalHi`/`metalLo` two-tone top-left/bottom-right trick from `arcade.ts` —
  keep using it, it's the established "physical edge" language.
- Focus/active rings: `brandColor.violet` (brand) or `arcade.accent`
  (gameplay hardware) depending on which token system the surface uses.
- Never a glowing border as pure decoration (brief: avoid "glowing borders
  around everything"). A lit border must mean something — pressed, useful,
  active, danger.

## 5. Elevation / shadow rules

- Flat surfaces (cards, sheets, HUD chrome) carry **no drop shadow** — depth
  comes from the metal-bevel border trick and gradient fills, not shadow
  stacks.
- The one exception is `PrimaryCta`'s warm glow (`shadowColor #FF8A1F` iOS /
  `elevation 8` Android) — reserved for the single primary CTA on screen.
  Don't extend glow-shadows to secondary buttons or cards.
- No blur/glassmorphism stacks beyond the two already-approved uses:
  `arcade.glassFill`/`glassEdge` (Holding/Tunnel energy-glass) and the
  Skia `Blur` nebula haze (`StarfieldBackdrop`). Do not add a third blur
  surface without a specific material reason.

## 6. Material hierarchy

Three materials, used consistently:

1. **Painted metal** (`arcade.metal*`) — structural hardware: HUD bezels,
   tunnel/holding housings, board rail.
2. **Energy glass** (`arcade.glassFill`/`glassEdge`, `brandGradient.surface`)
   — translucent secondary chrome: cards, Home's floating fragments, socket
   wells.
3. **Emissive** (`brandGradient.cta`/`core`, `orbGlow`, `arcade.accent`) —
   the thing drawing the eye: CTA fill, charges, active/useful states, the
   portal core.

A surface should read as *mostly metal*, with glass for secondary chrome and
emissive reserved for the one or two things that actually need attention.
If everything glows, nothing does — this is the brief's "avoid excessive
glassmorphism / glowing borders" rule operationalized.

## 7. Text hierarchy

`theme/spacing.ts` → `typography`: `wordmark 40/700`, `title 24/700`,
`label 13/600` (uppercase, tracked), `body 16/500`, `numeric 34/700`.

- Headings/titles: `title`, `brandColor.textPrimary` or `palette.textPrimary`
  depending on surface (§1).
- Kickers/labels ("LEVEL", "T1", difficulty labels): `label`, tracked,
  `textSecondary`.
- Body/help copy: `body`, `textSecondary`.
- Big numerals (level number, capacity counts): `numeric`.
- Minimum readable size app-wide: 13px (matches `label`); the wordmark's own
  15px floor (`wordmark.minFontSize`) is the brand-specific exception.
- Overriding a token's font size ad hoc (as `LevelBadge` does, forcing
  `numeric` from 34→40) should be rare and intentional, not a habit — prefer
  adding a variant to the scale over silently overriding at the call site if
  a pattern repeats a third time.

## 8. Button hierarchy

- **Primary**: `PrimaryCta` `variant="primary"` — one per screen/moment.
  PLAY, NEXT, CONTINUE, RETRY, TRY AGAIN.
- **Secondary**: `PrimaryCta` `variant="secondary"` — `brandGradient.surface`
  fill + border. Use for the second action next to a primary (e.g. a future
  "Worlds" button beside PLAY), not for tertiary links.
- **Tertiary / link**: plain text, no chrome (e.g. the "Home" link under
  `ResultOverlay`/`DiscoveryOverlay`). Reserve for a single low-emphasis exit
  action per screen.
- **Icon buttons** (HUD settings/restart, Home settings): the shared metal
  square-bezel treatment already in `Hud.tsx` — keep this as the one icon-
  button pattern; don't introduce a second icon-button style elsewhere.
- Disabled state is always: flat `surface` fill, `textSecondary` ink, no
  glow — never a dimmed copy of the enabled gradient.

## 9. Icon sizing

No dedicated icon set exists yet — current icon buttons use Unicode glyphs
(`⚙ ◈ ⟲ ◎ ＋`) at HUD-bezel size (40×40 hit target, per `Hud.tsx`). Keep this
40×40 minimum hit target for any new icon control (meets mobile tap-target
guidance); glyph visual size inside it can be smaller. Do not introduce an
icon font/asset library for this milestone unless a specific surface (Part 8)
cannot be legibly built with existing glyph/geometry primitives — prefer the
same "built from geometry" approach as `LogoMark`/`DifficultyGate` when a new
mark is genuinely needed.

## 10. Surface treatments

- **Full-bleed background**: `arcade.envTop→envMid→envBottom` gradient
  (gameplay/Home) or `brandGradient.background` (brand-only surfaces like a
  future dedicated splash/empty screen).
- **Cards/sheets**: `brandColor.surface` fill, `brandColor.border` 1px,
  `radius.lg`.
- **HUD/hardware panels**: `arcade.metal*` bevel treatment, not card chrome —
  don't give the HUD a "floating card" look, it's part of the machine.

## 11. Modal / sheet treatment

Only one modal-style surface exists today (`ResultOverlay`): full-screen
scrim `rgba(5,6,10,0.82)` + centered card, `FadeIn` scrim / `FadeInDown` card
entrance. This is the house style for any future modal (e.g. a confirm-exit
sheet): scrim opacity ~0.82, card = §10 card treatment, entrance = fade +
8–16px rise, never a hard cut or a slide-from-edge (reserve directional
slides for full-screen navigation, per Apple-design-skill guidance on
spatial consistency).

## 12. HUD treatment

Three-zone layout (left utility / center info / right action) is the
established pattern (`Hud.tsx`) — reuse this shape for any HUD-adjacent
surface rather than inventing a new arrangement. HUD chrome must never
visually compete with the board for attention: no HUD element should use
`brandGradient.cta`'s emissive amber (reserved for the primary CTA) or an
animated glow loop.

## 13. Interactive states

Every tappable element needs, at minimum: default, pressed, disabled. The
established pressed language is **either** `translateY(1–2)` + darker fill
(hardware: tunnels, holding, HUD icons) **or** `scale(0.94–0.97)` + darker
fill (softer controls) — pick per-surface based on whether the thing being
pressed reads as rigid hardware (translate) or a soft toggle (scale), and
stay consistent with what that specific component already does. Don't add a
third pressed pattern.

## 14. Disabled states

Flat `surface`/`metalLo` fill, reduced opacity (0.35–0.62 range depending on
context — empty tunnel 0.35, non-reachable pixel 0.62), muted text color,
**always** paired with a real `accessibilityState={{ disabled: true }}` and a
label that says why when it's not obvious (e.g. "coming soon" for scoped-out
features, "No exposed matching pixels yet" for a genuinely-blocked action).
Never rely on opacity alone to communicate disabled — every disabled control
audited so far correctly also disables touch and updates its a11y label; keep
that pairing.

## 15. "Coming soon" / placeholder states

ToolBar, both settings stubs, and Holding's dormant booster slot are
*intentionally* unshipped — M4C.11 should make them read as a designed,
confident "not yet" rather than an unfinished control:
- Keep the honest a11y labelling ("(coming soon)") — don't hide the state,
  polish it.
- A placeholder control may use lower opacity and the disabled treatment
  (§14), but should still sit in the material hierarchy correctly (metal
  hardware, not a random gray box) so it reads as "this part of the machine
  isn't lit yet," consistent with `LogoMark`'s existing `unlit` variant
  concept — reuse that visual idea (an unlit/dormant version of the same
  material) rather than a generic grayed-out button.

## 16. Success / failure states

- Success: `arcade.accent` / `palette.success` (`#5BE0B0`) for in-context
  chrome (progress fill, useful-charge highlight); `brandGradient.cta` warm
  amber remains reserved for the CTA itself, not general success signaling.
- Failure/danger: `arcade.danger` / `palette.danger` (`#FF5C7A`).
- Warning/pressure: `arcade.warn` / `palette.warning` (`#FFC24B`).
- Color is never the sole signal (product rule, already respected by
  `DifficultyGate`'s geometry+label approach and `ColorAssistMark`) — any new
  success/failure/warning state needs a shape, icon, or copy change alongside
  the color shift, not color alone.

## 17. Motion durations & easing

Reuse `brandMotion` tokens for brand moments; gameplay motion already has its
own `FEEL`/timeline constants (`boardGeometry.ts`, `revealTimeline`) — don't
duplicate values, import them. General guidance for any *new* motion added in
this milestone:

| Purpose | Duration | Easing |
| --- | --- | --- |
| Press feedback | 80–120ms | linear/easeOut |
| Entrance (card, sheet, overlay) | 160–260ms | easeOut |
| Settle/overshoot (icon, badge arrival) | 400–500ms | spring |
| Ambient/idle loop | 1400ms+ | easeInOut |

Never block input on a decorative animation. Gameplay feedback (charge
launch, clear, modifier state change) always resolves engine state first,
animation reflects it — this is an existing, correct rule (`GAME_DESIGN.md`,
`CLAUDE.md`) and M4C.11 must not violate it for the sake of a fancier
transition.

## 18. Haptic mapping

Centralized haptics service already exists (per `CLAUDE.md` — "centralize
haptics behind a service/module"). Any new interaction added in this
milestone gets a semantic haptic name added to that service, never a raw
`Haptics.impactAsync()` call at the call site. Reuse the existing hierarchy
(light tick = selection, light impact = success, distinct tick = held/queued,
medium pulse = target/milestone complete, warning = near-danger, success/
failure patterns = win/lose) rather than inventing new haptic meanings.

## 19. Safe-area rules

`SafeAreaProvider`/`SafeAreaView` already wrap the app root
(`app/_layout.tsx`, `HomeScreen`). Any new full-screen surface (notably
Part 8's campaign/world screen) must be built inside the existing safe-area
context, not assume manual insets. HUD and bottom controls already respect
safe areas via this mechanism — keep using it, don't hardcode top/bottom
offsets.

## 20. Compact phone rules

`HomeScreen`'s `layout.showForeground`/`layout.showNebula`/
`FloatingFragments` gating (dropping decorative layers on small phones) and
`specialPixels.ts`'s density-tiered detail system (`full`/`medium`/`minimal`
by pixel count) are the two established patterns for scaling down on compact
devices/dense boards. New surfaces should follow the same principle: cut
*decorative* layers first, never cut hit targets, legibility, or a11y labels.

## 21. Large phone rules

No surface currently hardcodes a max-width for large phones/tablets except
`ResultOverlay`'s card (`max-width: 340`). New card/sheet surfaces should
follow that same cap rather than stretching edge-to-edge on large screens;
full-bleed board/HUD surfaces should continue to scale by measured available
space (as `GameScreen`'s `onBoardArea` already does) rather than a fixed
breakpoint table.
