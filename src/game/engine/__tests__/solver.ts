/**
 * The solver now lives at `src/game/engine/solver.ts` as a real
 * production-neutral module (M3A). This shim re-exports it so the pre-M3A test
 * imports (`../../engine/__tests__/solver`) keep resolving unchanged.
 *
 * Prefer `import { solve } from '@/game/engine/solver'` (or `'../solver'`).
 */
export * from '../solver';
