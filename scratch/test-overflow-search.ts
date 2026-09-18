import { requireLevel } from '../src/game/levels/levels';
import { createGame } from '../src/game/engine/createGame';
import { resolveAction } from '../src/game/engine/resolveLaunch';
import { candidateActions } from '../src/game/engine/actions';

console.log('Testing Core V2 levels for holding overflow...');

for (let id = 1; id <= 10; id++) {
  const level = requireLevel(id);
  const state = createGame(level);
  // We want to see if we can find a state where holding.length === 3 and a 4th launch happens
  // Let's do a search or check level 9
  if (id === 9) {
    let s = state;
    // t0, t0, t0, t1
    s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-0' }).state;
    s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-0' }).state;
    s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-0' }).state;
    s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-1' }).state;
    console.log('Level 9 holding before 5th launch:', s.holding.length, s.holding.map(c => c.id));
    const out = resolveAction(s, { kind: 'tunnel', id: 'tunnel-1' });
    console.log('Level 9 5th launch status:', out.state.status, 'holding:', out.state.holding.map(c => c.id));
  }
}
