PIXEL ARCADIA — HOME SCREEN IMPLEMENTATION
IMPLEMENT THE LOCKED HOME DESIGN EXACTLY

You are now implementing the approved Pixel Arcadia Home screen.

The design is LOCKED.

Use the attached / provided:
LOCKED HOME DESIGN SUMMARY — PIXEL ARCADIA

Do not redesign it.
Do not reinterpret it.
Do not propose alternatives.
Do not touch Worlds or Gameplay.

Your job is to make the current Home screen match the locked spec as closely as practical in React Native / Expo.

==================================================
SCOPE
==================================================

HOME SCREEN ONLY.

Implement:

- THE CABINET + FIRST LIGHT PLAZA concept
- new Home-only V2 visual tokens
- top Hearts / Coins / Settings HUD
- marquee
- white Pixel Pal hero
- First Light plaza stage/background
- level medallion
- level name + compact difficulty
- physical PLAY button
- 3-item bottom nav:
  - Shop
  - Home/Play
  - Leaderboard
- approved Home motion system
- small-phone adaptations

Remove from Home:

- rendered level-board preview
- WORLDS button
- PICTURES RESTORED line
- redundant world/level labels

==================================================
DO NOT CHANGE
==================================================

Do NOT modify:

- gameplay mechanics
- engine
- solver
- targeting
- queue data
- level content
- tutorial
- convoy
- Holding
- gameplay HUD
- Worlds screen
- economy logic
- actual heart-loss logic
- coin economy
- leaderboard backend
- shop backend
- progression rules

The Hearts, Coins, Shop, and Leaderboard surfaces may be VISUAL PLACEHOLDERS where backend functionality does not exist yet.

Do not invent economy behavior.

==================================================
PALETTE
==================================================

Use HOME-SCOPED V2 tokens only:

navy #002662
cyan #01D8FD
purple #5C44D7
red #F24B5D
yellow #FDD54B
white #FDFDFD

Derived allowed:
deep navy #001742
PLAY skirt #C79A18

IMPORTANT:
Do NOT overwrite global shared theme tokens used by Worlds or Gameplay.

Home should migrate first.

==================================================
LAYOUT
==================================================

Follow the locked reference proportions from the spec.

Reference:
393 × 852pt

Maintain:

Top:
Hearts left
Coins + Settings right

Then:
Pixel Arcadia marquee

Then:
Hero stage occupying roughly 40% of screen height

Hero:
white Pixel Pal
~150pt reference size
centered
standing/hovering over glowing platform
First Light plaza behind

Then:
72pt level medallion

Then:
level name
compact difficulty

Then:
physical yellow PLAY button

Then:
control-deck bottom nav

Do not leave large empty dead bands.

==================================================
HOME BACKGROUND / ENVIRONMENT
==================================================

Build the approved First Light plaza environment.

Use cheap layered presentation:

L0:
purple → red → yellow horizon

L1:
far plaza silhouette

- distant arcade cabinets
- palms
- signage
- low contrast

L2:
thin glossy cabinet bezel / edge hardware

L3:
marquee + light spill

L4:
Pixel Pal platform ellipse

Do NOT use:

- floating islands
- giant portal background
- empty blue gradient
- full bulky arcade cabinet silhouette

The cabinet is an EDGE LANGUAGE, not a literal giant machine.

==================================================
PIXEL PAL
==================================================

Use the existing white Pixel Pal character.

Keep:

- hover
- blink
- core pulse
- occasional charm beat

Approved character idle:

Hover:
±3pt
3.4s
sine in-out

Squash/stretch:
derived from hover
no second timer

Blink:
120ms
random every 3.5–6.5s

Core pulse:
0.6 → 1.0
2.3s

Charm beat:
random every 9–14s
choose from:

- head tilt
- look left/right
- happy eyes
- tiny hop

Never repeat the same charm twice in a row.

Do not over-animate.

==================================================
HEARTS / COINS
==================================================

HEARTS:

Display:
♥ 5

Do not render 5 individual hearts.

Layout should reserve:

- a future recharge timer slot
- unlimited-hearts compatibility

The timer should NOT be visible yet if no real recharge system exists.

COINS:

Use:

- pixel/octagonal yellow coin icon
- numeric balance

If real balance exists, use it.
If not, use the current existing balance source.

Do NOT add a visible '+' button unless Store exists and is wired.

SETTINGS:

Small gear to the right of Coins.
Visually subdued.

Preserve existing Settings navigation if available.

==================================================
LEVEL PROGRESSION
==================================================

Do NOT render the puzzle board.

Display only:

[LEVEL MEDALLION]

Morning Hummingbird

• Medium

Use current actual level metadata dynamically.

Do not hardcode Level 7 / Morning Hummingbird.

Medallion:
~72pt reference
world accent ring
large level number

Difficulty:
small
white at reduced emphasis
small colored dot

==================================================
PLAY
==================================================

Label:
PLAY

Never CONTINUE.

Physical arcade button:

- yellow cap
- dark yellow skirt
- dimensional press state
- only major glow on screen

Press:
cap down 4pt
skirt compresses
medium haptic
~90ms

Release:
spring back

Specular sweep:
~700ms
roughly every 4.5s

Do not scale-pulse the whole button.

PLAY must remain the dominant action.

==================================================
BOTTOM NAV
==================================================

Three items:

LEFT:
Shop

CENTER:
Home / Play

RIGHT:
Leaderboard / Trophy

Icon-first.

Small labels allowed.

Center:
slightly larger
raised plinth
Pixel Pal / portal branding

Do not add:
Worlds
Settings
other tabs

If Shop / Leaderboard screens are not implemented:

- preserve safe placeholder navigation behavior
- do not invent backend systems
- do not crash

==================================================
MOTION
==================================================

Use the locked motion budget.

Constant:

- horizon glow
- far-plaza drift
- marquee neon

Occasional:

- max 2 pooled pixel motes
- every 7–11s randomized

Do NOT add distant cabinet flicker.

Do NOT add extra motion beyond the locked spec unless required technically.

Use:

- Reanimated
- shared values
- transform / opacity only

No JS setState per frame.

No runtime blur.

No large particle system.

==================================================
REDUCED MOTION
==================================================

Respect system reduced-motion setting.

When enabled:

- ambient background loops off
- motes off
- hover off
- blink stays
- core pulse half amplitude
- charm beats become expression-only
- button interaction remains
- navigation transition becomes simple crossfade

==================================================
SMALL PHONES
==================================================

For 375×667 and below:

Shrink in this order:

1. Hero stage
2. Marquee
3. Breathing gap

Do NOT shrink:

- HUD below 48pt
- nav below 80pt
- PLAY cap below 56pt

Pixel Pal min:
112pt

Cabinet bezel:
14pt → 10pt

Center nav plinth:
76pt → 66pt
but keep the raised/elevated appearance

Do not let content clip or overlap.

==================================================
PERFORMANCE
==================================================

Home should remain cheap.

Requirements:

- static layered background art
- no Skia required
- max 2 motes
- transform/opacity animation only
- memoize stable children
- no per-frame React rerenders
- no runtime blur
- no huge animation framework

Keep total view count reasonable.

==================================================
IMPLEMENTATION DISCIPLINE
==================================================

Do not improvise visual values that are already specified.

If something cannot be represented exactly due to the current component architecture:

- make the smallest structural change needed
- preserve navigation and behavior
- explain the deviation in the final report

Do not redesign around the limitation.

==================================================
VALIDATION
==================================================

Run:

npx tsc --noEmit

targeted eslint on changed files

Only add/run targeted tests if an existing Home navigation/layout contract requires it.

If using Jest:
--runInBand

No broad test suite.
No solver.
No campaign analysis.

Do not commit/push.

==================================================
RETURN
==================================================

Return only:

1. Home implementation summary
2. files changed
3. removed old Home elements
4. new layout structure
5. Pixel Pal animation implementation
6. Hearts/Coins/Settings implementation
7. PLAY implementation
8. bottom nav implementation
9. small-phone handling
10. performance notes
11. any deviations from the locked design
12. typecheck result
13. lint result
14. device-test checklist

STOP.

Do NOT start Worlds.
Do NOT start Gameplay.
