# Milestone 1 — Core Playable Prototype

## Objective

Build the smallest version of ORBITIDE that can answer one question: is the core puzzle loop understandable and satisfying enough that someone wants to keep tapping Next Level?

## Required screens

### Home
- ORBITIDE wordmark/title
- large Play button
- shows highest unlocked level
- minimal settings entry only if needed for haptic toggle

### Game
- level number
- central Core with active color and remaining count
- orbital/radial lanes
- exposed tappable orb on each non-empty lane
- 3 holding slots
- restart action

### Level result
- lightweight in-place win treatment rather than a heavy navigation flow
- Next Level
- Retry on failure

## Game engine requirements

Create rendering-independent TypeScript types and pure functions for:
- `GameState`
- `LevelDefinition`
- `OrbColor`
- `Lane`
- `HoldingTray`
- `CoreTarget`
- legal selectable orbs
- move resolution
- auto-resolution of held orbs
- win detection
- fail detection
- reset

UI animations must react to confirmed engine transitions. Animation completion must never be the source of truth for the game rules.

## First 10 levels

Hand-author and document ten deterministic levels. They should teach through board design rather than tutorial paragraphs.

Suggested curve:
1. two colors, obvious matches, 3 slots
2. two colors, first harmless hold
3. teach that held matching colors auto-clear when Core changes
4. three colors
5. deeper lanes
6. choice between multiple exposed colors
7. first meaningful risk of tray overflow
8. sequencing puzzle
9. more lanes
10. compact capstone using only baseline rules

## Feel requirements

- touch response should feel immediate
- successful clear should be visually stronger than a hold
- Core color completion should have a distinctive pulse/haptic
- failure should be clear but not punitive
- win-to-next-level transition should be quick

## Verification

At minimum:
- typecheck
- lint
- unit tests for pure engine rules
- manual iOS/Android development-build smoke test when native dependencies require it
- repeated rapid tapping should not duplicate moves or corrupt state
- app kill/relaunch should restore highest unlocked level

## Non-goals

Do not expand Milestone 1 because something seems easy to add. No ads, purchases, backend, accounts, generated levels, skins, currency, daily systems, achievements, leaderboards, or final marketing screens.
