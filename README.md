# ORBITIDE

A one-thumb mobile color puzzle game built around orbital lanes, a changing central core, and limited holding slots.

## Product goal

Build a polished casual puzzle game with deterministic progression from Level 1 through Level 5000, short sessions, satisfying motion/haptics, and simple monetization that does not interrupt active gameplay.

## Core loop

1. The center Core requests a color.
2. The player taps the exposed orb at the head of any orbital lane.
3. A matching orb flies into the Core and clears.
4. A non-matching orb moves into a limited holding tray.
5. When the Core advances to a held color, matching held orbs auto-clear.
6. Clear every orb to win. Fill the holding tray with no valid resolution to lose.

## Technical direction

- Expo + React Native + TypeScript
- Expo Router
- React Native Skia for game rendering
- Reanimated for motion
- Local-first progress storage
- EAS Build / TestFlight
- No backend in the first playable milestone

See `docs/MILESTONES.md`, `docs/GAME_DESIGN.md`, and `docs/MILESTONE_1.md` before development.
