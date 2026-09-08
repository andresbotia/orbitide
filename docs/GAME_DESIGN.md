> Historical design document. Current implemented M1 interaction rules and validation are in [M1_INTERACTION_REVAMP.md](M1_INTERACTION_REVAMP.md).

# ORBITIDE — Game Design Baseline

## Fantasy

A luminous orbital machine is out of alignment. Colored energy orbs circle a central Core. The player restores order by feeding the Core the correct colors without overflowing temporary storage.

## Product feel

ORBITIDE should have the immediate readability and commercial polish of successful one-thumb mobile puzzle games while maintaining a distinct cosmic identity.

Structural inspiration may come from games such as Pixel Flow:
- compact portrait play area
- persistent top HUD
- prominent level indicator
- visible coin economy
- clear holding/storage slots
- bottom booster controls
- highly tactile motion and feedback

Do not copy another game's mascot, artwork, exact UI shapes, palette, iconography, screenshots, or other distinctive visual assets. ORBITIDE should feel recognizably its own product.

## Input

Tap only for the core game loop. Portrait orientation. Designed for one hand.

## Board model

- A level contains several radial/orbital lanes arranged around a central Core.
- Each lane is an ordered stack/queue of colored orbs.
- Only the exposed head orb of a lane can be selected.
- The Core has an ordered target sequence (for example BLUE x2, YELLOW x3, PURPLE x2).
- The holding tray has limited capacity.

## Move resolution

When a player taps an exposed orb:

### Matching orb
- The orb leaves its lane.
- It animates into the Core.
- Remaining count for the current Core color decreases.
- If that color is complete, the Core advances to its next target color.
- When a target color becomes active, matching orbs already in the holding tray should automatically resolve into the Core before control returns to the player.

### Non-matching orb
- The orb leaves its lane.
- It moves into the next holding slot.
- If the tray reaches capacity and the game cannot immediately auto-resolve a held orb, the level is lost.

## Win

All lane orbs and holding orbs have been cleared and the Core target sequence is complete.

## Lose

The holding tray becomes full with no immediate valid auto-resolution.

## Campaign philosophy

Campaign levels are intentionally designed, not randomly generated for players.

- every shipped level has a stable definition
- every level is solver/validator checked
- every level is manually accepted into the campaign
- internal tools may propose variations, but a human designer decides what ships
- puzzle logic is designed before decorative silhouette/theme decisions

## Difficulty

Every campaign level has an explicit difficulty label:

- Easy
- Medium
- Hard
- Super Hard

Opening cadence:
- Levels 1–8: Easy
- Level 9: Medium
- Level 10: Hard

Later sets deliberately mix ratings. Easy levels continue to appear later as recovery/breather levels.

Difficulty is influenced by:
- lane count
- lane depth
- number of colors
- holding slot count
- target sequence ordering
- distribution of accessible colors
- misleading but legal choices
- number of decision points
- peak holding pressure
- advanced mechanics

## Theme and silhouette system

Campaign presentation is organized into:

### 10-level themed sets
Each set receives:
- name
- background treatment
- accent palette
- particles/ambient motion
- preferred silhouette families
- difficulty rhythm

Initial direction:
- 1–10: First Light
- 11–20: Comet Trail
- 21–30: Satellite Field
- 31–40: Nebula Bloom
- 41–50: Eclipse Run

### 50-level worlds
Five 10-level sets combine into a larger world/chapter with a shared broader visual identity.

### Layout families
Rather than random blobs, level layouts use intentional readable silhouette families:
- radial: circle, flower, sunburst, star
- directional: comet, arrow, wave, spiral
- mechanical: satellite, cross, gear, split ring
- dense challenge: hourglass, fractured ring, crown, double spiral

Silhouettes should suggest recognizable forms without compromising puzzle readability.

## Economy

Levels award coins, with increased first-clear rewards for higher difficulty.

Exact values are tuned later, but the hierarchy should remain:

`Easy < Medium < Hard < Super Hard`

Coins can be spent on rotating booster-store items.

Boosters should help recover from mistakes or reduce uncertainty without becoming mandatory for normally designed levels.

Candidate boosters:
- Undo
- Reveal/Hint
- temporary Extra Holding Slot
- Clear Holding Orb, if balance-safe

## Later mechanics — not Milestone 1

- frozen/locked orb
- mystery color orb
- linked orbs
- wildcard orb
- portals between lanes
- blocker occupying holding capacity
- bomb/chain clear
- reversing lane order
- temporary extra holding slot

## Visual presentation

Target aesthetic: **cosmic arcade toy**.

The product should combine:
- bright mobile-puzzle readability
- dimensional/tactile controls
- deep-space/orbital identity
- strong central playfield framing
- colorful, luminous gameplay pieces
- short, satisfying animation loops

Recommended overall screen structure:

### Top HUD
- Settings at upper left
- Level pill centered
- Coin balance and Store/add action at upper right

### Main playfield
- framed orbital console/play area
- central luminous Core
- lanes/orbits arranged into the level silhouette
- strong distinction between selectable and blocked orbs

### Holding tray
- visually obvious sockets directly beneath the main playfield
- empty/full/near-danger states readable instantly

### Booster bar
- bottom-row booster buttons with inventory counts
- visually separate from active puzzle state

## Motion language

Motion is part of gameplay communication, not decoration.

Principles:
- tactile response should begin immediately after valid input
- game state resolves before animation; animation reflects accepted state
- most interactions stay short to preserve flow
- stronger events use more amplitude, not dramatically longer blocking animation

Core interactions:
- selection: subtle compress/glow response
- match: orb arcs/flies toward Core with slight acceleration
- absorption: quick collapse + Core pulse
- nonmatch: orb moves decisively to a holding socket
- automatic held clear: clear visual path from tray back to Core
- target complete: stronger Core pulse + brief ring wave
- Hard/Super Hard intro: distinct but skippable emphasis
- win: short celebratory bloom/particles + quick CTA
- fail: tray/core warning response + immediate retry path
- coins: small satisfying count-up on reward/purchase
- boosters: unique activation motion by booster type

## Haptic language

Haptics should reinforce meaning without firing constantly.

Suggested hierarchy:
- exposed-orb selection: light tick
- successful Core absorption: light impact
- orb sent to holding: softer distinct tick
- Core target complete: medium pulse / short double pulse
- near-full tray: restrained warning
- booster use: medium confirmation
- level complete: success pattern
- level fail: error/failure pattern
- store purchase: success confirmation

Requirements:
- global haptics toggle
- respect reduced-motion/accessibility choices where relevant
- centralized haptics service; no random direct calls spread throughout UI code

## Launch data architecture

Gameplay and campaign content remain offline-first.

Local:
- bundled level files
- active game state
- fast progress cache
- settings
- offline sync queue

Cloudflare Workers + D1 before launch:
- durable player identity/account link
- cross-device campaign progress
- wallet ledger
- booster inventory
- purchase audit data

RevenueCat before launch:
- Remove Ads entitlement
- consumable coin purchases
- restore flows

AdMob before launch:
- interstitial ads between levels only
- optional rewarded ads

Cross-device restoration is a version-1.0 requirement, not a post-launch enhancement.
