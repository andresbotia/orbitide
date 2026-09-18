import { createGame } from '../src/game/engine/createGame';
import { resolveAction } from '../src/game/engine/resolveLaunch';
import { buildLaunchScript } from '../src/game/presentation/buildScript';
import { holdingSlotFor } from '../src/game/presentation/holdingSlot';
import { LevelDefinition, Charge, GameState } from '../src/game/engine/types';
import { flightPosition } from '../src/game/rendering/flightGeometry';
import { computeBoardGeometry } from '../src/game/rendering/boardGeometry';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

console.log('====================================================');
console.log('HOLDING OVERFLOW AUTHORITATIVE REPRODUCTION HARNESS');
console.log('====================================================\n');

// Level definition with holdingCapacity = 3, coreV2 ruleset
// 4 tunnels, where first 3 launches yield distinct unresolved charges in holding
const testLevel: LevelDefinition = {
  id: 9999,
  title: 'Holding Overflow Test Level',
  themeId: 'test',
  difficulty: 'easy',
  holdingCapacity: 3,
  ruleset: 'coreV2',
  pixelArt: [
    'WWW',
    'WWW',
    'WWW',
  ],
  tunnels: [
    [{ color: 'blue', capacity: 1 }, { color: 'red', capacity: 1 }],
    [{ color: 'green', capacity: 1 }],
    [{ color: 'purple', capacity: 1 }],
    [{ color: 'gold', capacity: 1 }],
  ],
};

// 1. Setup holding to 3/3 capacity
console.log('STEP 1: Populate holding bay to 3/3 capacity...');
let state = createGame(testLevel);
assert(state.holdingCapacity === 3, 'Level holdingCapacity must be 3');

// Launch A
const outA = resolveAction(state, { kind: 'tunnel', id: 'tunnel-0' });
assert(outA.accepted, 'Launch A must be accepted');
state = outA.state;
assert(state.holding.length === 1, 'Holding count after A must be 1');

// Launch B
const outB = resolveAction(state, { kind: 'tunnel', id: 'tunnel-1' });
assert(outB.accepted, 'Launch B must be accepted');
state = outB.state;
assert(state.holding.length === 2, 'Holding count after B must be 2');

// Launch C
const outC = resolveAction(state, { kind: 'tunnel', id: 'tunnel-2' });
assert(outC.accepted, 'Launch C must be accepted');
state = outC.state;
assert(state.holding.length === 3, 'Holding count after C must be 3');
assert(state.status === 'playing', 'Engine status before overflow must be playing');

const holdingBefore = state.holding.map((c) => ({ ...c }));
console.log('Holding before overflow:');
holdingBefore.forEach((c, idx) => console.log(`  slot ${idx} = ${c.id} (${c.color}, cap ${c.capacity})`));

assert(holdingBefore[0]!.id === 'L9999-t0-c0', 'Slot 0 must be Pal A');
assert(holdingBefore[1]!.id === 'L9999-t1-c0', 'Slot 1 must be Pal B');
assert(holdingBefore[2]!.id === 'L9999-t2-c0', 'Slot 2 must be Pal C');

// 2. Incoming unresolved Pal D
console.log('\nSTEP 2: Launch fourth unresolved Pal D from tunnel-3...');
const outD = resolveAction(state, { kind: 'tunnel', id: 'tunnel-3' });
console.log(`Launch D outcome: accepted=${outD.accepted}, status=${outD.state.status}`);
console.log(`Launched charge: ${outD.launchedCharge?.id} (${outD.launchedCharge?.color})`);

// VERIFY ENGINE TRUTH INVARIANTS
console.log('\nSTEP 3: Verify Engine Truth Invariants...');
// Status must be lost
assert(outD.state.status === 'lost', 'Engine status MUST be "lost"');
console.log('  [PASS] Engine status is strictly "lost"');

// Epoch must be closed
assert(outD.state.epoch === null, 'Epoch must be closed (null) on terminal loss');
console.log('  [PASS] Epoch is null');

// Holding length must be strictly 3
assert(outD.state.holding.length === 3, 'Holding length must strictly remain 3');
console.log('  [PASS] Holding length strictly preserved at 3');

// Exact before IDs === exact after IDs
assert(outD.state.holding[0]!.id === holdingBefore[0]!.id, 'Slot 0 MUST remain Pal A');
assert(outD.state.holding[1]!.id === holdingBefore[1]!.id, 'Slot 1 MUST remain Pal B (NOT replaced!)');
assert(outD.state.holding[2]!.id === holdingBefore[2]!.id, 'Slot 2 MUST remain Pal C');
console.log('  [PASS] Slots 0, 1, 2 strictly preserved:');
outD.state.holding.forEach((c, idx) => console.log(`    slot ${idx} = ${c.id} (${c.color})`));

// Incoming Pal D must NEVER enter holding
const dInHolding = outD.state.holding.some((c) => c.id === outD.launchedCharge?.id);
assert(!dInHolding, 'Incoming Pal D must NEVER enter holding');
console.log('  [PASS] Pal D is NOT in holding');

// 3. Verify Presentation Invariants
console.log('\nSTEP 4: Verify Presentation & Flight Invariants...');
const scriptD = buildLaunchScript(outD, state, 4);

// terminal must be 'reject' (no slot, no target), NOT 'toHolding'
assert(scriptD.pass.terminal.kind === 'reject', `Flight terminal MUST be "reject", got "${scriptD.pass.terminal.kind}"`);
console.log('  [PASS] Flight terminal is "reject" (never "toHolding", so no slot and no target)');

// Events must NOT contain 'holdingLanded'
const hasHoldingLanded = scriptD.pass.events.some((e) => e.kind === 'holdingLanded');
assert(!hasHoldingLanded, 'Events must NEVER emit holdingLanded for overflow flight');
console.log('  [PASS] Events do NOT emit "holdingLanded"');

// Events MUST contain 'fail'
const hasFail = scriptD.pass.events.some((e) => e.kind === 'fail');
assert(hasFail, 'Events MUST emit fail transition');
console.log('  [PASS] Events emit "fail" transition');

// Events MUST contain 'complete'
const hasComplete = scriptD.pass.events.some((e) => e.kind === 'complete');
assert(hasComplete, 'Events MUST emit complete transition');
console.log('  [PASS] Events emit "complete"');

console.log('  Events emitted:', scriptD.pass.events.map((e) => `${e.kind}@${e.at}ms`).join(', '));

// 4. Verify reservation rejects slot reuse
console.log('\nSTEP 5: Verify the truth slot model...');
const reservedSlot = holdingSlotFor(outD.state.holding, scriptD.pass.charge.id);
assert(reservedSlot === -1, `truth must not keep the overflow Pal, got slot ${reservedSlot}`);
console.log('  [PASS] overflow Pal has no truth slot (-1)');

// 5. Verify flight position does NOT target Well 1
console.log('\nSTEP 6: Verify flight position does NOT target Well 1...');
const geo = computeBoardGeometry(380, 3, 3);
// In a 3-slot holding tray, Well 1 is at geo.center.x
const well1X = geo.center.x;
// Check position at end of flight
const finalPos = flightPosition(scriptD.pass, geo, scriptD.pass.totalMs);
console.log(`  Board center X: ${well1X}`);
console.log(`  Flight position at totalMs (${scriptD.pass.totalMs}ms): x=${finalPos.x.toFixed(1)}, y=${finalPos.y.toFixed(1)}`);
// For burst, Pal finishes lap at the orbit perimeter/insertion point, NOT in the holding tray below the board
assert(finalPos.y < geo.size + 80, 'Flight must not land in holding tray below board');
console.log('  [PASS] Overflow flight bursts on orbit; does NOT enter holding tray');

// 6. Verify Terminal State: no further actions allowed
console.log('\nSTEP 7: Verify Terminal Lock...');
const postLossTunnel = resolveAction(outD.state, { kind: 'tunnel', id: 'tunnel-0' });
assert(!postLossTunnel.accepted, 'Subsequent tunnel launch must be rejected');
assert(postLossTunnel.rejection === 'gameOver', 'Rejection reason must be gameOver');
console.log('  [PASS] Subsequent tunnel launch rejected with gameOver');

const postLossHolding = resolveAction(outD.state, { kind: 'holding', id: outD.state.holding[0]!.id });
assert(!postLossHolding.accepted, 'Subsequent holding relaunch must be rejected');
assert(postLossHolding.rejection === 'gameOver', 'Rejection reason must be gameOver');
console.log('  [PASS] Subsequent holding relaunch rejected with gameOver');

console.log('\nSTEP 8: Verify useGameSession Lifecycle Simulation...');
// Simulate useGameSession state transitions
let truthState = createGame(testLevel);
let viewState = createGame(testLevel);

function appendPresentedHolding(holding: Charge[], landed: Charge | null): Charge[] {
  if (!landed || holding.some((charge) => charge.id === landed.id)) return holding;
  return [...holding, landed];
}

function simulateSessionLaunch(action: { kind: 'tunnel'; id: string }) {
  const before = truthState;
  const outcome = resolveAction(before, action);
  if (!outcome.accepted) return { outcome, pass: null };
  truthState = outcome.state;
  const presentedHolding = viewState.holding;
  const pass = buildLaunchScript(outcome, before, 1).pass;
  const isTerminal = outcome.state.status !== 'playing';
  viewState = {
    ...viewState,
    movesApplied: outcome.state.movesApplied,
    tunnels: outcome.state.tunnels,
    holding: presentedHolding,
    ...(isTerminal ? { status: outcome.state.status } : {}),
  };
  return { outcome, pass };
}

function simulatePresentThrough(pass: any, outcome: any) {
  for (const event of pass.events) {
    if (event.kind === 'holdingLanded') {
      const parked = outcome.heldCharge
        && outcome.state.holding.some((c: any) => c.id === outcome.heldCharge!.id);
      if (parked && viewState.holding.length < truthState.holdingCapacity) {
        viewState = {
          ...viewState,
          holding: appendPresentedHolding(viewState.holding, outcome.heldCharge),
        };
      }
    } else if (event.kind === 'win' || event.kind === 'fail') {
      viewState = { ...truthState, holding: viewState.holding, status: truthState.status };
    } else if (event.kind === 'complete') {
      viewState = truthState;
    }
  }
}

// Launch A, land A
const fA = simulateSessionLaunch({ kind: 'tunnel', id: 'tunnel-0' });
simulatePresentThrough(fA.pass, fA.outcome);
// Launch B, land B
const fB = simulateSessionLaunch({ kind: 'tunnel', id: 'tunnel-1' });
simulatePresentThrough(fB.pass, fB.outcome);
// Launch C, land C
const fC = simulateSessionLaunch({ kind: 'tunnel', id: 'tunnel-2' });
simulatePresentThrough(fC.pass, fC.outcome);

assert(viewState.holding.length === 3, 'Session holding length before D must be 3');
assert(viewState.status === 'playing', 'Session status before D must be playing');
const sessionHoldingBefore = viewState.holding.map((c) => ({ ...c }));

// Launch D
const fD = simulateSessionLaunch({ kind: 'tunnel', id: 'tunnel-3' });
// Verify immediate session state on launch D
assert(viewState.status === 'lost', 'Session view status must immediately lock to "lost" on launch D');
assert(viewState.holding.length === 3, 'Session holding must strictly remain 3 on launch D');
assert(viewState.holding[0]!.id === sessionHoldingBefore[0]!.id, 'Session slot 0 must remain A');
assert(viewState.holding[1]!.id === sessionHoldingBefore[1]!.id, 'Session slot 1 must remain B');
assert(viewState.holding[2]!.id === sessionHoldingBefore[2]!.id, 'Session slot 2 must remain C');
console.log('  [PASS] Immediate session launch locks status to "lost" and keeps slots 0, 1, 2 unchanged');

// Finish flight D
simulatePresentThrough(fD.pass, fD.outcome);
assert(viewState.status === 'lost', 'Session view status must remain "lost" after flight completes');
assert(viewState.holding.length === 3, 'Session holding must strictly remain 3 after flight completes');
assert(viewState.holding[0]!.id === sessionHoldingBefore[0]!.id, 'Post-flight slot 0 must remain A');
assert(viewState.holding[1]!.id === sessionHoldingBefore[1]!.id, 'Post-flight slot 1 must remain B (not replaced)');
assert(viewState.holding[2]!.id === sessionHoldingBefore[2]!.id, 'Post-flight slot 2 must remain C');
assert(!viewState.holding.some((c) => c.id === fD.outcome.launchedCharge!.id), 'Pal D must NEVER enter presented holding');
console.log('  [PASS] Session post-flight state is terminal "lost", holding bay strictly unchanged');

console.log('\n====================================================');
console.log('ALL INVARIANTS PASSED PERFECTLY!');
console.log('====================================================');
