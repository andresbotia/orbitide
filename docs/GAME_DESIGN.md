# ORBITIDE — Game Design Baseline

## Fantasy

A luminous orbital machine is out of alignment. Colored energy orbs circle a central Core. The player restores order by feeding the Core the correct colors without overflowing temporary storage.

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

## Early difficulty levers

- lane count
- lane depth
- number of colors
- holding slot count
- target sequence ordering
- distribution of accessible colors

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

## Presentation

- dark premium background
- luminous high-contrast orbs
- clean central Core
- restrained particles
- short, responsive animations
- haptic feedback for tap, successful clear, Core color completion, win, and failure
- no visual clutter around the playfield
