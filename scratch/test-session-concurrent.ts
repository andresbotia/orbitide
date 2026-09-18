import { createGame } from '../src/game/engine/createGame';
import { resolveAction, LaunchOutcome } from '../src/game/engine/resolveLaunch';
import { buildLaunchScript } from '../src/game/presentation/buildScript';
import { applyCoreV2Convoy } from '../src/game/presentation/convoy';

import { LevelDefinition, Charge, GameState } from '../src/game/engine/types';
import { FlightPass } from '../src/game/presentation/events';
import { isCoreV2 } from '../src/game/engine/ruleset';
import { epochHasCapacity } from '../src/game/engine/epoch';

const testLevel: LevelDefinition = {
  id: 9999,
  title: 'Test',
  themeId: 'test',
  difficulty: 'easy',
  holdingCapacity: 3,
  ruleset: 'coreV2',
  pixelArt: ['WWW', 'WWW', 'WWW'],
  tunnels: [
    [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
    [{ color: 'green', capacity: 1 }],
    [{ color: 'purple', capacity: 1 }],
    [{ color: 'gold', capacity: 1 }],
  ],
};

function appendPresentedHolding(holding: Charge[], landed: Charge | null): Charge[] {
  if (!landed || holding.some((charge) => charge.id === landed.id)) return holding;
  return [...holding, landed];
}

class SessionSimulator {
  truth: GameState;
  view: GameState;
  active = new Map<number, { pass: FlightPass; outcome: LaunchOutcome; cursor: number }>();
  serial = 0;

  constructor(level: LevelDefinition) {
    this.truth = createGame(level);
    this.view = createGame(level);
  }

  launch(tunnelId: string) {
    const joining = this.active.size > 0 && epochHasCapacity(this.truth);
    const before = this.truth;
    const outcome = resolveAction(before, { kind: 'tunnel', id: tunnelId, join: joining });
    console.log(`\n>>> LAUNCH ${tunnelId} (joining: ${joining})`);
    console.log('Outcome status:', outcome.state.status, 'accepted:', outcome.accepted);
    console.log('Engine holding after launch:', outcome.state.holding.map(c => c.id));
    if (!outcome.accepted) return;

    this.truth = outcome.state;
    let presentedHolding = this.view.holding;

    let pass = buildLaunchScript(outcome, before, ++this.serial).pass;
    if (isCoreV2(before.ruleset)) {
      pass = { ...pass, launchedAtMs: Date.now() };
      pass = applyCoreV2Convoy(pass, [...this.active.values()].map((f) => f.pass));
    }
    if (pass.terminal.kind === 'toHolding') {
      console.log(`Flight ${pass.passId} (${pass.charge.id}) truth slot: ${pass.terminal.slot}`);
    }
    this.active.set(pass.passId, { pass, outcome, cursor: 0 });
    this.view = {
      ...this.view,
      movesApplied: outcome.state.movesApplied,
      tunnels: outcome.state.tunnels,
      holding: presentedHolding,
    };
  }

  presentThrough(passId: number, count: number) {
    const flight = this.active.get(passId);
    if (!flight) return;
    const end = Math.min(count, flight.pass.events.length);
    for (; flight.cursor < end; flight.cursor++) {
      const event = flight.pass.events[flight.cursor]!;
      console.log(`[Pass ${passId}] Event: ${event.kind}`);
      if (event.kind === 'holdingLanded') {
        const parked = flight.outcome.heldCharge
          && flight.outcome.state.holding.some((c) => c.id === flight.outcome.heldCharge!.id);
        console.log(`  holdingLanded: parked=${parked}, heldCharge=${flight.outcome.heldCharge?.id}`);
        if (parked) {
          this.view = {
            ...this.view,
            holding: appendPresentedHolding(this.view.holding, flight.outcome.heldCharge),
          };
          console.log(`  view.holding now:`, this.view.holding.map(c => c.id));
        }
      } else if (event.kind === 'win' || event.kind === 'fail') {
        this.view = { ...this.truth, holding: this.view.holding };
        console.log(`  ${event.kind} event! view.status now:`, this.view.status);
      } else if (event.kind === 'complete') {
        this.active.delete(passId);
        if (this.active.size === 0) {
          this.view = this.truth;
          console.log('  All settled! view.holding:', this.view.holding.map(c => c.id), 'status:', this.view.status);
        }
      }
    }
  }

  finishFlight(passId: number) {
    const flight = this.active.get(passId);
    if (flight) {
      this.presentThrough(passId, flight.pass.events.length);
    }
  }
}

console.log('=== SCENARIO 1: Rapid 4 launches without landing ===');
const sim1 = new SessionSimulator(testLevel);
sim1.launch('tunnel-0'); // A
sim1.launch('tunnel-1'); // B
sim1.launch('tunnel-2'); // C
sim1.launch('tunnel-3'); // D

console.log('\nNow finishing all flights in order:');
sim1.finishFlight(1);
sim1.finishFlight(2);
sim1.finishFlight(3);
sim1.finishFlight(4);
