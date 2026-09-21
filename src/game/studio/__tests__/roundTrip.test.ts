/**
 * PART 11 — the Studio must load production levels, serialise them without semantic
 * edits, and the engine must behave identically on the result.
 */
import { createGame } from '../../engine/createGame';
import { applyActionWithArrivals } from '../../engine/holdingArrival';
import { solve } from '../../engine/__tests__/solver';
import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';
import { fromLevelDefinition, serializeToJSON, toLevelDefinition } from '../serialize';

test.each(LEVEL_DEFINITIONS)('level $id: load → serialize → identical engine behaviour', (def) => {
  const back = toLevelDefinition(fromLevelDefinition(def));

  // No semantic change: the freshly built game state is deep-equal.
  expect(createGame(back)).toEqual(createGame(def));

  // Structural fields survive verbatim.
  expect(back.pixelArt).toEqual(def.pixelArt);
  expect(back.tunnels).toEqual(def.tunnels);
  expect(back.difficulty).toBe(def.difficulty);
  expect(back.holdingCapacity).toBe(def.holdingCapacity);
  expect(back.themeId).toBe(def.themeId);
  expect(back.reveal).toEqual(def.reveal);
  expect(back.legend).toEqual(def.legend);

  // Idempotent: a second round-trip is a fixed point.
  const twice = toLevelDefinition(fromLevelDefinition(back));
  expect(serializeToJSON(fromLevelDefinition(twice))).toBe(serializeToJSON(fromLevelDefinition(back)));
});

test('every campaign level stays solvable after a round-trip, with the same witness length', () => {
  for (const def of LEVEL_DEFINITIONS) {
    const back = toLevelDefinition(fromLevelDefinition(def));
    const original = solve(def);
    const roundTripped = solve(back);
    expect(roundTripped.solved).toBe(true);
    expect(roundTripped.length).toBe(original.length);
    expect(roundTripped.lossProbability).toBeCloseTo(original.lossProbability, 10);

    // The original winning witness replays move-for-move on the round-tripped level.
    let state = createGame(back);
    for (const action of original.moves) {
      const outcome = applyActionWithArrivals(state, action);
      expect(outcome.accepted).toBe(true);
      state = outcome.state;
    }
    expect(state.status).toBe('won');
  }
}, 120_000);
