import {
  isHeldChargeHighlighted,
  isHeldChargeSubdued,
  isTunnelHighlighted,
  isTunnelSubdued,
  tutorialCoachText,
} from '@/game/presentation/tutorialCoach';
import { INACTIVE_TUTORIAL_VIEW } from '@/game/tutorial';
import type { TutorialView } from '@/game/tutorial';

function view(overrides: Partial<TutorialView>): TutorialView {
  return {
    id: 'core-level-1',
    active: true,
    completed: false,
    stage: 'launch',
    highlight: { kind: 'none' },
    interaction: 'none',
    gating: { tunnelIds: 'all', holdingIds: 'all' },
    flags: {
      sawLaunch: false, sawHit: false, sawCountDecrement: false, sawHolding: false, sawRelaunch: false,
    },
    ...overrides,
  };
}

describe('tutorialCoachText', () => {
  test('inactive tutorial shows no copy', () => {
    expect(tutorialCoachText(INACTIVE_TUTORIAL_VIEW)).toBeNull();
  });

  test('launch stage shows the launch line', () => {
    expect(tutorialCoachText(view({ stage: 'launch' }))).toBe('Tap a tunnel to launch a Pal.');
  });

  test('observeHit stage shows no persistent text', () => {
    expect(tutorialCoachText(view({ stage: 'observeHit' }))).toBeNull();
  });

  test('relaunchHeld stage shows the relaunch line', () => {
    expect(tutorialCoachText(view({ stage: 'relaunchHeld' }))).toBe('Not finished? Tap the Pal in Holding.');
  });

  test('freePlay stage removes tutorial chrome', () => {
    expect(tutorialCoachText(view({ stage: 'freePlay', interaction: 'freePlay' }))).toBeNull();
  });

  test('completed stage removes tutorial chrome', () => {
    expect(tutorialCoachText(view({ stage: 'completed', active: false, completed: true }))).toBeNull();
  });
});

describe('tunnel highlight/subdue', () => {
  test('launch stage highlights the intended tunnel and subdues the rest', () => {
    const v = view({
      stage: 'launch',
      highlight: { kind: 'tunnel', tunnelId: 'tunnel-0' },
      gating: { tunnelIds: ['tunnel-0'], holdingIds: 'none' },
    });
    expect(isTunnelHighlighted(v, 'tunnel-0')).toBe(true);
    expect(isTunnelHighlighted(v, 'tunnel-1')).toBe(false);
    expect(isTunnelSubdued(v, 'tunnel-0')).toBe(false);
    expect(isTunnelSubdued(v, 'tunnel-1')).toBe(true);
  });

  test('freePlay stage highlights and subdues nothing', () => {
    const v = view({
      stage: 'freePlay',
      interaction: 'freePlay',
      highlight: { kind: 'none' },
      gating: { tunnelIds: 'all', holdingIds: 'all' },
    });
    expect(isTunnelHighlighted(v, 'tunnel-0')).toBe(false);
    expect(isTunnelSubdued(v, 'tunnel-0')).toBe(false);
  });

  test('inactive tutorial never highlights or subdues', () => {
    expect(isTunnelHighlighted(INACTIVE_TUTORIAL_VIEW, 'tunnel-0')).toBe(false);
    expect(isTunnelSubdued(INACTIVE_TUTORIAL_VIEW, 'tunnel-0')).toBe(false);
  });
});

describe('held-charge highlight/subdue', () => {
  test('relaunchHeld stage highlights the intended held charge and subdues other slots', () => {
    const v = view({
      stage: 'relaunchHeld',
      highlight: { kind: 'heldCharge', chargeId: 'charge-7' },
      gating: { tunnelIds: 'none', holdingIds: ['charge-7'] },
    });
    expect(isHeldChargeHighlighted(v, 'charge-7')).toBe(true);
    expect(isHeldChargeHighlighted(v, 'charge-9')).toBe(false);
    expect(isHeldChargeSubdued(v, 'charge-7')).toBe(false);
    expect(isHeldChargeSubdued(v, 'charge-9')).toBe(true);
  });

  test('inactive tutorial never highlights or subdues held charges', () => {
    expect(isHeldChargeHighlighted(INACTIVE_TUTORIAL_VIEW, 'charge-7')).toBe(false);
    expect(isHeldChargeSubdued(INACTIVE_TUTORIAL_VIEW, 'charge-7')).toBe(false);
  });
});
