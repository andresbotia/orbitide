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

## Running Milestone 1

Requires Node 20+.

```bash
npm install
npm run typecheck      # tsc --noEmit (strict)
npm run lint           # eslint
npm test               # pure-engine unit tests (ts-jest, no simulator)
npm start              # Expo dev server
```

The game board uses `@shopify/react-native-skia`, which is **not** in Expo Go.
Use a development build (`npx expo run:ios` / `npx expo run:android`, or an EAS
dev build) to play on a device or simulator.

### Architecture

- `src/game/engine/` — pure, rendering-independent game rules. No React / RN /
  Skia imports. This is the source of truth for every state transition.
  **In a lane, index 0 is the exposed (selectable) orb.**
- `src/game/levels/` — the 10 handcrafted level definitions (serializable data).
- `src/game/rendering/` — Skia field + Reanimated orb chips. Reacts to committed
  engine state; never decides rules.
- `src/hooks/useGameSession.ts` — owns engine state plus a purely cosmetic
  interaction lock (kept separate from the rules).
- `src/storage/progress.ts` — AsyncStorage persistence of `highestUnlockedLevel`.

A dev-only debug overlay (state inspector + haptics toggle + progress reset) is
available in the game screen when `__DEV__` is true. Progress can also be reset
via a hidden long-press on the home wordmark (dev builds only).
