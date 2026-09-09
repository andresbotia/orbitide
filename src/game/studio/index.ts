/**
 * Level Studio — pure, engine-facing core. Consumed by the dev-only web Studio
 * UI (`src/screens/LevelStudioScreen.tsx`). No React / React Native imports here.
 *
 * There is exactly one level schema (the engine's `LevelDefinition`), one engine
 * (`src/game/engine`), one solver (`src/game/engine/solver.ts`) and one
 * validation path — this module wires the editor to them, it does not fork them.
 */
export * from './types';
export * from './constants';
export * from './grid';
export * from './model';
export * from './serialize';
export * from './validate';
