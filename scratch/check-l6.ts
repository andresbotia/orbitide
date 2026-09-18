import { requireLevel } from '../src/game/levels/levels';
import { createGame } from '../src/game/engine/createGame';
import { resolveAction } from '../src/game/engine/resolveLaunch';

const l = requireLevel(6);
console.log('Level 6 art:');
console.log(l.pixelArt);

const s = createGame(l);
console.log('Colors of pixels:', new Set(s.pixels.map(p => p.color)));
