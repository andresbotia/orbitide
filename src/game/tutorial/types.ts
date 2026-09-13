import type { GameRuleset } from '@/game/engine/types';

/**
 * Stable ids for one-time tutorials. Core V2 Level 1 is the only basic-gameplay
 * tutorial; later mechanic intros (Frozen, Shielded, …) add their own ids.
 */
export const TUTORIAL_IDS = {
  coreLevel1: 'core-level-1',
} as const;

export type TutorialId = (typeof TUTORIAL_IDS)[keyof typeof TUTORIAL_IDS] | (string & {});

export type TutorialStage =
  | 'inactive'
  | 'launch'
  | 'observeHit'
  | 'observeHolding'
  | 'relaunchHeld'
  | 'freePlay'
  | 'completed';

/** Semantic spotlight target. Never screen-space coordinates. */
export type TutorialHighlight =
  | { kind: 'none' }
  | { kind: 'tunnel'; tunnelId: string }
  | { kind: 'heldCharge'; chargeId: string };

export type TutorialInteraction =
  | 'none'
  | 'launchTunnel'
  | 'watch'
  | 'relaunchHeld'
  | 'freePlay';

export type TutorialGateList = 'all' | 'none' | readonly string[];

export interface TutorialGating {
  /** Which tunnels may be launched. `none` blocks every tunnel. */
  tunnelIds: TutorialGateList;
  /** Which held charges may be relaunched. `none` blocks every held Pal. */
  holdingIds: TutorialGateList;
}

export interface TutorialFlags {
  sawLaunch: boolean;
  sawHit: boolean;
  sawCountDecrement: boolean;
  sawHolding: boolean;
  sawRelaunch: boolean;
}

/**
 * UI-facing contract for M5.4C. Presentation reads this; it must not invent
 * engine truth or hardcode pixel positions.
 */
export interface TutorialView {
  id: TutorialId;
  active: boolean;
  completed: boolean;
  stage: TutorialStage;
  highlight: TutorialHighlight;
  interaction: TutorialInteraction;
  gating: TutorialGating;
  flags: TutorialFlags;
}

export type TutorialAction = { kind: 'tunnel' | 'holding'; id: string };

export type TutorialEvent =
  | {
      type: 'launchAccepted';
      action: TutorialAction;
      chargeId: string;
      capacity: number;
    }
  | { type: 'hitResolved'; chargeId: string; remaining: number }
  | { type: 'holdingEntered'; chargeId: string }
  | { type: 'levelWon' };

export interface TutorialActivationInput {
  levelId: number;
  ruleset: GameRuleset | undefined;
  /**
   * `null`/`undefined` means completion has not been loaded yet — do not
   * activate, so a returning player never flashes the tutorial before persist
   * resolves.
   */
  completed: Iterable<string> | null | undefined;
}
