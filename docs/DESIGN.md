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

**Updated in redesign Milestone 1.** Four token modules now exist. `arcade`
is in a documented, deliberate migration — it is not gone, but it is no
longer where new work should draw from. **Use the one whose job matches the
surface, do not reach across systems inside one component** (the audit
flagged `ResultOverlay.tsx` and `LevelBadge.tsx` mixing systems; fix as
touched, don't blanket-refactor).

| System | File | Job | Use for |
| --- | --- | --- | --- |
| `brandColor` / `brandGradient` / `brandMotion` | `theme/brand.ts` | Brand surface | Logo/wordmark, primary CTAs, card/sheet chrome (surface/border fills), splash, empty/loading states |
| `palette` | `theme/colors.ts` | UI/system chrome text + status | Body/heading text color, success/danger/warning semantics *when the surface isn't a branded card* |
| `material` | `theme/material.ts` | **New Pixel Arcadia product-chrome material system** | Any *new* in-game/product chrome work from Milestone 2 onward — HUD, tunnels, holding, board environment, world map. This is the target system. |
| `arcade` | `theme/arcade.ts` | **Legacy "Cosmic Arcade" material language — deprecated, mid-migration** | Existing consumers only (`OrbitBoard`, `TunnelBar`, `HoldingTray`, `Hud`, `WorldCard`, `LevelNode`, ...), unchanged until their own redesign milestone reskins them onto `material`. **Do not add new consumers.** |

Rule of thumb, current state: **if it's an *existing* physical piece of the
game machine that hasn't been touched by its redesign milestone yet, it's
still `arcade` (untouched, unchanged — this is intentional, not an oversight).
Any *new* in-game/product chrome, or a component actively being redesigned
this phase, is `material`. Brand chrome (a CTA, a modal card, an empty state)
stays `brandColor`. `palette` is the fallback for plain UI text that isn't
inside a branded card.** A single component should draw from at most two
systems, and only when there's a real reason (e.g. a branded card containing
plain status text).

Migration discipline (see §22 for the full rationale): `arcade.ts`'s cosmic-
specific tokens (`nebulaCore`, `nebulaEdge`, `starFar`, `starNear`) are
`@deprecated` in code and must never be silently repurposed to mean something
new — add the new role to `material.ts` instead. `arcade.ts`'s generic
hardware-material tokens (`metal*`, `socket*`, `glass*`, `rail*`, `accent`/
`warn`/`danger`) are a temporary compatibility layer, not deprecated in the
same sense — they keep working exactly as-is until their consumer's milestone
lands.

`orbColors` / `orbGlow` / `orbLabel` (also `theme/colors.ts`) are the 15
gameplay charge colors — reserved for charges/pixels only, never for chrome,
per the existing brand ⟂ gameplay separation rule (asserted in
`brand.test.ts`; do not weaken). `theme/worldSkins.ts`'s per-world accents
follow the same rule — see §26.

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

---

# Part 2 — Redesign Foundations (Milestone 1)

Everything below was added by the Pixel Arcadia identity redesign's first
implementation milestone (see the redesign audit for full context: Orbitide
remnants, the KEEP/REBUILD/REMOVE matrix, and the phased roadmap). Part 1
above is the M4C.11-era document and is left intact as the historical record
of what shipped before this phase — its rules still apply to every component
`arcade`/`brandColor`/`palette` continue to describe; nothing in Part 1 was
invalidated, only extended.

## 22. The `material` system and the `arcade` deprecation

**Why a new file instead of rewriting `arcade.ts` in place**: `arcade.ts` is
imported by ~10 live components (`OrbitBoard`, `TunnelBar`, `HoldingTray`,
`Hud`, `IconButton`, `WorldCard`, `LevelNode`, `WorldSelectScreen`,
`WorldLevelsScreen`, `DifficultyGate`, ...). Changing its token *values* would
re-theme every one of those at once, in an uncontrolled way, before their
individual redesign milestones (Home = 2, World map = 3, Gameplay board/HUD =
4, Tunnels/Holding = 5, Win/fail = 7) have actually redesigned their
composition, motion, and content — not just their colours. `theme/material.ts`
is therefore new and additive; `arcade.ts` is untouched in *value*, only
annotated in *documentation*.

**What changed in `arcade.ts` this milestone**: comments only.
- A file-level migration-status note explaining the new system exists and
  that new consumers should not be added here.
- `nebulaCore`, `nebulaEdge`, `starFar`, `starNear` are now `@deprecated` in
  code — these are the Orbitide-era "deep space" tokens (redesign audit
  findings B.1/B.2). They must not be silently repurposed for an unrelated
  new effect; a genuinely new visual role belongs in `material.ts`.
- `metal*`/`socket*`/`glass*`/`rail*`/`accent`/`warn`/`danger` are explicitly
  *not* deprecated in the same sense — they're the still-useful "physical
  hardware" compatibility layer and keep working unchanged until their
  consumer's own milestone reskins it.

**`theme/material.ts` roles** (see the file for exact values): `background`,
`elevatedBackground`, `structuralSurface`, `raisedSurface`,
`recessedSurface`, `bevelHighlight`, `bevelShadow`, `outline`, `energyWarm`,
`energyGlow`, `accentCyan`, `success`/`danger`/`warning` (identical values to
`palette`'s, so status colour meaning doesn't fork), `textPrimary`/
`textSecondary`, `disabled`, `overlay`. Values are a first pass, derived from
the existing `brandColor` palette (already icon-correct) plus a small set of
new bevel/surface tones in the same family — expect these to be tuned once a
real screen (Milestone 2+) actually uses them, not treated as final.

**Nothing consumes `material.ts` yet.** That is intentional — this milestone
is foundation only; wiring it into Home/board/etc. is each later milestone's
job.

## 23. Motion system (`theme/motion.ts`)

Three tiers — MICRO 50-150ms (press/selection), STANDARD 150-350ms
(cards/panels), MAJOR 350-800ms (wins/transitions/reward) — and eight named
presets (`pressSquash`, `release`, `selectionTick`, `panelEnter`, `cardEnter`,
`warningPulse`, `successResponse`, `rewardResponse`), each with a duration,
easing/spring config, and a reduced-motion resolution. This is the general
product-chrome motion vocabulary — the equivalent of `brandMotion` (§ brand
moments only) but for buttons/cards/panels/alerts generally.

**Explicitly out of scope for this system**: gameplay-board choreography
(`game/presentation/motion.ts`/`constants.ts` — `FEEL`, `LAUNCH_HUB`), which
is engine-event-timed and must stay exactly as it is; this system must never
be used to re-time a launch/orbit/clear beat.

No screen is wired to `motion.ts` yet — later milestones reach for a named
preset instead of hand-rolling a new duration/easing pair at the call site.

## 24. Haptic hierarchy (documentation only — no rewrite)

The existing service (`game/haptics.ts` + `hapticArbiter.ts` + `feedback.ts`)
was audited, not rewritten: its semantic-event-name discipline, throttling,
cross-charge coalescing (§ `hapticArbiter`'s `COALESCE_WINDOW_MS`), and sound-
hook stub already implement most of what the redesign brief asks for. The
current roster now maps onto six tiers (also documented as a comment directly
above `haptics.ts`'s `haptics` export):

| Tier | Events |
| --- | --- |
| micro | `select`, `orbitEnter`, `denied` |
| light | `iceCrack`, `shieldBreak` |
| medium | `heldRelaunch`, `pixelPop`, `pixelCombo`, `chargeConsumed`, `holdingLand`, `linkPrime`, `nextPress`, `gateLock` |
| warning | `holdingCritical`, `holdingFull`, `fail` |
| success | `win`, `discoveryResolve`, `finalClear`, `linkClear`, `pixelBurst` |
| special/capstone | `capstoneWin` (new this milestone — reserved, not yet called from any screen) |

`capstoneWin` is the one new semantic event added this milestone: a heavier
variant of the existing `win`/`discoveryResolve` success-bloom pattern
(success notification + a heavy impact after 160ms instead of medium after
120ms), reserved for a world-capstone or Level 100 completion. It is defined
and tested but not wired into `DiscoveryOverlay`/`GameScreen` — that's
Milestone 7's job, once the win-screen capstone treatment actually exists.

## 25. Typography + iconography foundations

`theme/spacing.ts`'s `typography` gained three additive tokens (existing
`wordmark`/`title`/`label`/`body`/`numeric` values are unchanged):
- `display` (28/700) — hero-level headlines (world-map/campaign titles),
  larger than `title`.
- `cta` (17/700, tracked 0.16em) — matches `PrimaryCta`'s existing hardcoded
  label style exactly, so future CTA-adjacent text has one token to reference
  instead of re-deriving it. `PrimaryCta` itself is not changed this
  milestone.
- `metadata` (10/500) — tiny footer/secondary metadata, one step below
  `label`.

**Iconography plan (not implemented this milestone)**: icon buttons currently
render bare Unicode glyphs (`⚙ ↺ ← ◈ ⟲ ◎ ＋`) at a shared 40×40 hit target
(`IconButton`, §9 above) — functional, but not an owned design system, and
the redesign brief specifically warns against an uncontrolled icon mix once
more icons (boosters, store, settings destinations) get added. The plan is to
build a small owned icon set the same way `DifficultyGate` already builds its
machined-frame difficulty icon: Skia-drawn from geometry primitives, not an
icon font or asset library. Initial roster once undertaken: settings,
restart, back, pause, undo, hint/scan, extra-slot, coins/currency, locked.
`IconButton` keeps its current glyphs unchanged until that system exists and
a component's own milestone adopts it.

## 26. World-skin architecture: global product UI + world-specific environmental skin

**GLOBAL PIXEL ARCADIA PRODUCT UI + WORLD-SPECIFIC ENVIRONMENTAL SKIN.**
Product chrome — HUD, tunnels, Holding, buttons, boosters, the win/fail
surfaces — is the same everywhere and must stay that way; a player should
never have to relearn a control because they're in a different world. World
identity is expressed through *environment and accent only*: `theme/
worldSkins.ts` is a small declarative registry, keyed by the campaign's real
`themeId` (§27), of `accent`, `secondaryAccent`, a forward-looking
`ambientId` (a named future treatment — e.g. `foliage`, `neonSignage`,
`gearsSteam`, `starfield` — not wired to any renderer yet), and an
`intensity` hint (`low`/`medium`/`high`).

**The architectural rule this exists to enforce**: a component that wants a
world's identity calls `worldSkin(world.themeId)` — it never branches on a
specific world id/name (no `if (themeId === 'ocean-depths')` anywhere in
component code). Adding an eleventh world would only ever mean one new
registry entry, never a new conditional scattered through the UI.

Notably, `cosmic-frontier`'s skin deliberately claims the `starfield`
ambient — the old Cosmic Arcade starfield (§22, `arcade.ts`'s deprecated
tokens) becomes ONE world's specific identity once world skinning is actually
implemented (a later milestone), instead of the whole product's default
background. That is the concrete shape of "global UI + world-specific skin"
for the one visual motif most associated with the old identity.

Only `accent` is consumed today — `campaign.ts`'s `display.accent` per world
now reads from `worldSkin(id).accent` rather than a second, hand-duplicated
hex value, so there is exactly one authored colour per world. No ambient
treatment is rendered yet; that is explicitly future scope (the World Map
milestone and beyond).

## 27. Campaign metadata correction (redesign audit finding B.6)

`campaign.ts`'s world blueprint used to group levels by the *pre-authoring-
pipeline* legacy `themeId` taxonomy (`deep-frost`, `curio-cabinet`,
`prism-works`, `frostglass-forge`, `skybound`, `tidal-depths`,
`arcane-relics`, `starforge`), imported from `levelDefinitions.ts` directly.
Since the JSON content-authoring pipeline (`content/levels/world-0N.json` +
`replacesLegacy: true`) had since replaced the actual played content for
those same level-id ranges with new worlds under new names (Neon Nights,
Mechanical City, Cosmic Frontier, World Landmarks, Ocean Depths, Mythic
Realm, Prehistoric Titans, Masterpiece Gallery), World Select / World Levels
were showing stale placeholder names for 8 of the 10 shipped worlds, while
the player was actually playing the new content.

**Fix**: `campaign.ts` now imports `LEVEL_DEFINITIONS` from `./levels` (the
runtime-merged, `replacesLegacy`-aware list — the same one `GameScreen`
actually plays) instead of the raw legacy file, and its `WORLD_BLUEPRINT`
titles/ids/themeIds/subtitles were updated to the real, current campaign.
Level ids, level content, level ordering, and gameplay definitions were not
touched — this is campaign-organisation metadata only. A dedicated regression
test (`game/levels/__tests__/campaignMetadata.test.ts`) pins the ten current
world names/ids/order and asserts none of the retired codenames can leak back
into consumer-facing metadata.
