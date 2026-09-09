# Pixel Arcadia

Pixel Arcadia is the final consumer-facing product name. Orbitide was the development codename.

A one-thumb mobile color puzzle game built around handcrafted pixel art, orbital charges, and three manual Holding slots.

## Product goal

Build a polished casual puzzle game with deterministic progression from Level 1 through Level 5000, short sessions, satisfying motion/haptics, and simple monetization that does not interrupt active gameplay.

## Core loop

1. Tap a tunnel head or a useful held charge.
2. The charge travels from its button to one shared bottom-centre insertion point.
3. It orbits bottom -> left -> top -> right, shooting exposed matching pixels in encounter order.
4. Each clear consumes one capacity; exposure is recomputed after every shot.
5. Leftover capacity parks in Holding until the player taps it again.
6. Clear the picture to win. Lose only when pixels remain and no legal action exists.

See [M1 interaction revamp](docs/M1_INTERACTION_REVAMP.md) for the current rules,
solver witnesses, timings, and validation. Earlier design documents describe historical models.

## Technical direction

- Expo + React Native + TypeScript
- Expo Router
- React Native Skia for game rendering
- Reanimated for motion
- Local-first progress storage
- EAS Build / TestFlight
- No backend in the first playable milestone

See `docs/MILESTONES.md`, `docs/GAME_DESIGN.md`, and `docs/MILESTONE_1.md` before development.
