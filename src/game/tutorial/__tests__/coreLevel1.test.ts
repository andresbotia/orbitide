import { createGame } from '@/game/engine/createGame';
import { resolveAction, resolveLaunch } from '@/game/engine/resolveLaunch';
import { resolveHoldingLaunch } from '@/game/engine/resolveHolding';
import type { LevelDefinition } from '@/game/engine/types';
import { LEVEL_DEFINITIONS } from '@/game/levels/levelDefinitions';
import {
  applyTutorialEvent,
  catchUpTutorial,
  createTutorial,
  inspectCoreLevel1TutorialFit,
  isTutorialActionAllowed,
  pickIntendedTutorialLaunch,
  shouldActivateCoreLevel1Tutorial,
  syncTutorialCompletion,
  toTutorialView,
  TUTORIAL_IDS,
  type TutorialEvent,
  type TutorialState,
} from '@/game/tutorial';

/** Core V2 Level 1 stand-in that can teach hit → remainder → Holding → relaunch. */
function coreV2Level1(extra: Partial<LevelDefinition> = {}): LevelDefinition {
  return {
    id: 1,
    title: 'First Light',
    themeId: 'first-light',
    difficulty: 'easy',
    holdingCapacity: 3,
    pixelArt: [
      'BBB',
      'BRB',
      'BRB',
    ],
    tunnels: [
      [{ color: 'red', capacity: 2 }],
      [{ color: 'blue', capacity: 8 }],
      [],
    ],
    ruleset: 'coreV2',
    ...extra,
  };
}

function coreV2Level2(): LevelDefinition {
  return coreV2Level1({ id: 2, title: 'Level Two' });
}

function drive(state: TutorialState, event: TutorialEvent): TutorialState {
  return applyTutorialEvent(state, event);
}

function launchEvent(state: TutorialState, tunnelId = 'tunnel-0'): TutorialEvent {
  const intended = pickIntendedTutorialLaunch(coreV2Level1());
  return {
    type: 'launchAccepted',
    action: { kind: 'tunnel', id: tunnelId },
    chargeId: intended?.chargeId ?? 'L1-t0-c0',
    capacity: intended?.capacity ?? 2,
  };
}

describe('activation', () => {
  test('activates for Core V2 Level 1 when incomplete', () => {
    expect(shouldActivateCoreLevel1Tutorial({
      levelId: 1, ruleset: 'coreV2', completed: [],
    })).toBe(true);
    const t = createTutorial(coreV2Level1(), []);
    expect(t.active).toBe(true);
    expect(t.stage).toBe('launch');
    expect(t.completed).toBe(false);
  });

  test('does not activate for Level 2+', () => {
    expect(shouldActivateCoreLevel1Tutorial({
      levelId: 2, ruleset: 'coreV2', completed: [],
    })).toBe(false);
    const t = createTutorial(coreV2Level2(), []);
    expect(t.active).toBe(false);
    expect(t.stage).toBe('inactive');
  });

  test('does not activate for Legacy V1, including campaign Level 1', () => {
    const campaign = LEVEL_DEFINITIONS[0]!;
    expect(campaign.id).toBe(1);
    expect(campaign.ruleset).toBeUndefined();
    expect(shouldActivateCoreLevel1Tutorial({
      levelId: 1, ruleset: campaign.ruleset, completed: [],
    })).toBe(false);
    const t = createTutorial(campaign, []);
    expect(t.active).toBe(false);
    expect(t.stage).toBe('inactive');
  });

  test('does not activate until completion persistence has loaded', () => {
    expect(shouldActivateCoreLevel1Tutorial({
      levelId: 1, ruleset: 'coreV2', completed: null,
    })).toBe(false);
    expect(createTutorial(coreV2Level1(), null).active).toBe(false);
  });
});

describe('Level 1 teaching sequence via engine-observed events', () => {
  const def = coreV2Level1();

  test('fixture can deterministically exercise hit, remainder, and Holding', () => {
    const fit = inspectCoreLevel1TutorialFit(def);
    expect(fit.ok).toBe(true);
    expect(fit.intended?.tunnelId).toBe('tunnel-0');
    const outcome = resolveLaunch(createGame(def), 'tunnel-0');
    expect(outcome.accepted).toBe(true);
    expect(outcome.pass!.encounters.length).toBeGreaterThanOrEqual(1);
    expect(outcome.heldCharge).not.toBeNull();
    expect(outcome.heldCharge!.capacity).toBeGreaterThan(0);
    expect(outcome.state.status).toBe('playing');
  });

  test('first required launch advances launch → observeHit', () => {
    let t = createTutorial(def, []);
    const intended = pickIntendedTutorialLaunch(def)!;
    expect(isTutorialActionAllowed(t, { kind: 'tunnel', id: 'tunnel-1' })).toBe(false);
    expect(isTutorialActionAllowed(t, { kind: 'tunnel', id: intended.tunnelId })).toBe(true);

    t = drive(t, {
      type: 'launchAccepted',
      action: { kind: 'tunnel', id: intended.tunnelId },
      chargeId: intended.chargeId,
      capacity: intended.capacity,
    });
    const view = toTutorialView(t);
    expect(view.stage).toBe('observeHit');
    expect(view.flags.sawLaunch).toBe(true);
    expect(view.interaction).toBe('watch');
    expect(isTutorialActionAllowed(t, { kind: 'tunnel', id: intended.tunnelId })).toBe(false);
  });

  test('a real successful attack validates the hit teaching stage', () => {
    const intended = pickIntendedTutorialLaunch(def)!;
    const outcome = resolveLaunch(createGame(def), intended.tunnelId);
    const hit = outcome.pass!.encounters.find((e) => !e.frozenBreak && !e.shieldBreak);
    expect(hit).toBeDefined();

    let t = createTutorial(def, []);
    t = drive(t, {
      type: 'launchAccepted',
      action: { kind: 'tunnel', id: intended.tunnelId },
      chargeId: intended.chargeId,
      capacity: intended.capacity,
    });
    t = drive(t, {
      type: 'hitResolved',
      chargeId: intended.chargeId,
      remaining: hit!.remaining,
    });
    expect(t.stage).toBe('observeHit');
    expect(t.flags.sawHit).toBe(true);
    expect(t.flags.sawCountDecrement).toBe(true);
    expect(hit!.remaining).toBeLessThan(intended.capacity);
  });

  test('entering Holding advances to the relaunch prompt', () => {
    const intended = pickIntendedTutorialLaunch(def)!;
    const outcome = resolveLaunch(createGame(def), intended.tunnelId);
    let t = createTutorial(def, []);
    t = drive(t, {
      type: 'launchAccepted',
      action: { kind: 'tunnel', id: intended.tunnelId },
      chargeId: intended.chargeId,
      capacity: intended.capacity,
    });
    t = drive(t, {
      type: 'hitResolved',
      chargeId: intended.chargeId,
      remaining: outcome.heldCharge!.capacity,
    });
    t = drive(t, { type: 'holdingEntered', chargeId: intended.chargeId });
    const view = toTutorialView(t);
    expect(view.stage).toBe('relaunchHeld');
    expect(view.flags.sawHolding).toBe(true);
    expect(view.highlight).toEqual({ kind: 'heldCharge', chargeId: intended.chargeId });
    expect(isTutorialActionAllowed(t, { kind: 'tunnel', id: 'tunnel-1' })).toBe(false);
    expect(isTutorialActionAllowed(t, { kind: 'holding', id: intended.chargeId })).toBe(true);
  });

  test('held-Pal relaunch advances into free play and releases gating', () => {
    const intended = pickIntendedTutorialLaunch(def)!;
    const first = resolveLaunch(createGame(def), intended.tunnelId);
    let t = createTutorial(def, []);
    t = drive(t, {
      type: 'launchAccepted',
      action: { kind: 'tunnel', id: intended.tunnelId },
      chargeId: intended.chargeId,
      capacity: intended.capacity,
    });
    t = drive(t, {
      type: 'hitResolved',
      chargeId: intended.chargeId,
      remaining: first.heldCharge!.capacity,
    });
    t = drive(t, { type: 'holdingEntered', chargeId: intended.chargeId });
    t = drive(t, {
      type: 'launchAccepted',
      action: { kind: 'holding', id: intended.chargeId },
      chargeId: intended.chargeId,
      capacity: first.heldCharge!.capacity,
    });
    const view = toTutorialView(t);
    expect(view.stage).toBe('freePlay');
    expect(view.flags.sawRelaunch).toBe(true);
    expect(view.gating).toEqual({ tunnelIds: 'all', holdingIds: 'all' });
    expect(isTutorialActionAllowed(t, { kind: 'tunnel', id: 'tunnel-1' })).toBe(true);
    expect(isTutorialActionAllowed(t, { kind: 'holding', id: 'other' })).toBe(true);
  });

  test('level completion marks tutorial completed', () => {
    let t = createTutorial(def, []);
    t = drive(t, launchEvent(t));
    t = drive(t, { type: 'levelWon' });
    expect(t.active).toBe(false);
    expect(t.completed).toBe(true);
    expect(t.stage).toBe('completed');
  });

  test('completed tutorial does not automatically replay on Level 1', () => {
    const completed = new Set([TUTORIAL_IDS.coreLevel1]);
    expect(shouldActivateCoreLevel1Tutorial({
      levelId: 1, ruleset: 'coreV2', completed,
    })).toBe(false);
    const t = createTutorial(def, completed);
    expect(t.active).toBe(false);
    expect(t.completed).toBe(true);
    expect(isTutorialActionAllowed(t, { kind: 'tunnel', id: 'tunnel-1' })).toBe(true);
  });

  test('interaction gating is released once the required action is demonstrated', () => {
    const intended = pickIntendedTutorialLaunch(def)!;
    let t = createTutorial(def, []);
    expect(toTutorialView(t).gating.tunnelIds).toEqual([intended.tunnelId]);
    t = drive(t, {
      type: 'launchAccepted',
      action: { kind: 'tunnel', id: intended.tunnelId },
      chargeId: intended.chargeId,
      capacity: intended.capacity,
    });
    expect(toTutorialView(t).gating.tunnelIds).toBe('none');
    t = drive(t, {
      type: 'hitResolved', chargeId: intended.chargeId, remaining: 1,
    });
    t = drive(t, { type: 'holdingEntered', chargeId: intended.chargeId });
    expect(toTutorialView(t).gating.holdingIds).toEqual([intended.chargeId]);
    t = drive(t, {
      type: 'launchAccepted',
      action: { kind: 'holding', id: intended.chargeId },
      chargeId: intended.chargeId,
      capacity: 1,
    });
    expect(toTutorialView(t).gating).toEqual({ tunnelIds: 'all', holdingIds: 'all' });
  });
});

describe('engine isolation', () => {
  test('tutorial observation does not change Core V2 engine outcomes', () => {
    const def = coreV2Level1();
    const a = resolveLaunch(createGame(def), 'tunnel-0');
    const t = createTutorial(def, []);
    applyTutorialEvent(t, {
      type: 'launchAccepted',
      action: { kind: 'tunnel', id: 'tunnel-0' },
      chargeId: a.launchedCharge!.id,
      capacity: a.launchedCharge!.capacity,
    });
    const b = resolveLaunch(createGame(def), 'tunnel-0');
    expect(b.state).toEqual(a.state);
    expect(b.pass).toEqual(a.pass);
    expect(b.heldCharge).toEqual(a.heldCharge);
  });

  test('Legacy V1 campaign Level 1 still resolves identically', () => {
    const def = LEVEL_DEFINITIONS[0]!;
    const a = resolveAction(createGame(def), { kind: 'tunnel', id: 'tunnel-0' });
    createTutorial(def, []);
    const b = resolveAction(createGame(def), { kind: 'tunnel', id: 'tunnel-0' });
    expect(b.state).toEqual(a.state);
    expect(a.accepted).toBe(true);
  });

  test('held relaunch engine path is unchanged', () => {
    const def = coreV2Level1();
    const first = resolveLaunch(createGame(def), 'tunnel-0');
    const relaunch = resolveHoldingLaunch(first.state, first.heldCharge!.id);
    expect(relaunch.accepted).toBe(true);
    expect(relaunch.state.holding.some((c) => c.id === first.heldCharge!.id)).toBe(false);
  });
});

describe('catch-up from engine truth', () => {
  test('background settle can advance observeHit → relaunchHeld from Holding', () => {
    const def = coreV2Level1();
    const intended = pickIntendedTutorialLaunch(def)!;
    const outcome = resolveLaunch(createGame(def), intended.tunnelId);
    let t = createTutorial(def, []);
    t = drive(t, {
      type: 'launchAccepted',
      action: { kind: 'tunnel', id: intended.tunnelId },
      chargeId: intended.chargeId,
      capacity: intended.capacity,
    });
    t = catchUpTutorial(t, outcome.state);
    expect(t.stage).toBe('relaunchHeld');
    expect(t.flags.sawHit).toBe(true);
    expect(t.flags.sawHolding).toBe(true);
  });
});

describe('completion sync', () => {
  test('loading a completed id deactivates a live tutorial', () => {
    const def = coreV2Level1();
    let t = createTutorial(def, []);
    expect(t.active).toBe(true);
    t = syncTutorialCompletion(t, [TUTORIAL_IDS.coreLevel1], def);
    expect(t.active).toBe(false);
    expect(t.completed).toBe(true);
  });

  test('loading an incomplete id activates a tutorial that waited for persistence', () => {
    const def = coreV2Level1();
    let t = createTutorial(def, null);
    expect(t.active).toBe(false);
    t = syncTutorialCompletion(t, [], def);
    expect(t.active).toBe(true);
    expect(t.stage).toBe('launch');
  });
});
