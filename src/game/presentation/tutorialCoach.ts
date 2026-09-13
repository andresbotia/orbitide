import type { TutorialStage, TutorialView } from '@/game/tutorial';

/**
 * M5.4C — pure presentation resolvers for the M5.4B Core V2 Level 1 tutorial
 * contract (`session.tutorial`). No engine/gating truth lives here: every
 * function only reads `TutorialView` and answers a rendering question
 * (what to say, what to glow, what to dim). Components must not recreate
 * tutorial state or second-guess `view.gating` — they call these instead.
 */

const STAGE_COPY: Partial<Record<TutorialStage, string>> = {
  launch: 'Tap a tunnel to launch a Pal.',
  // `observeHolding` is part of the documented flow but the current M5.4B
  // state machine transitions straight from `observeHit` to `relaunchHeld`;
  // mapped here too so presentation stays correct if that ever changes.
  observeHolding: 'Not finished? Tap the Pal in Holding.',
  relaunchHeld: 'Not finished? Tap the Pal in Holding.',
};

/** The one short coach line for the current stage, or `null` for no chrome. */
export function tutorialCoachText(view: TutorialView): string | null {
  if (!view.active) return null;
  return STAGE_COPY[view.stage] ?? null;
}

export function isTunnelHighlighted(view: TutorialView, tunnelId: string): boolean {
  return view.active && view.highlight.kind === 'tunnel' && view.highlight.tunnelId === tunnelId;
}

export function isHeldChargeHighlighted(view: TutorialView, chargeId: string): boolean {
  return view.active && view.highlight.kind === 'heldCharge' && view.highlight.chargeId === chargeId;
}

/** A tunnel the tutorial is not currently steering the player toward. */
export function isTunnelSubdued(view: TutorialView, tunnelId: string): boolean {
  if (!view.active) return false;
  if (isTunnelHighlighted(view, tunnelId)) return false;
  const { tunnelIds } = view.gating;
  if (tunnelIds === 'all') return false;
  if (tunnelIds === 'none') return true;
  return !tunnelIds.includes(tunnelId);
}

/** A held charge the tutorial is not currently steering the player toward. */
export function isHeldChargeSubdued(view: TutorialView, chargeId: string): boolean {
  if (!view.active) return false;
  if (isHeldChargeHighlighted(view, chargeId)) return false;
  const { holdingIds } = view.gating;
  if (holdingIds === 'all') return false;
  if (holdingIds === 'none') return true;
  return !holdingIds.includes(chargeId);
}
