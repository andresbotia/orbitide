import type { ChargeSpec, GameRuleset } from './types';

export const DEFAULT_RULESET: GameRuleset = 'legacyV1';

export const LEGACY_TUNNEL_COUNT = 3;
export const CORE_V2_TUNNEL_COUNT = 4;
export const DEFAULT_HOLDING_CAPACITY_V1 = 3;
export const DEFAULT_HOLDING_CAPACITY_V2 = 4;

export function resolveRuleset(ruleset: GameRuleset | undefined): GameRuleset {
  return ruleset === 'coreV2' ? 'coreV2' : DEFAULT_RULESET;
}

export function isCoreV2(ruleset: GameRuleset | undefined): boolean {
  return resolveRuleset(ruleset) === 'coreV2';
}

export function expectedTunnelCount(ruleset: GameRuleset | undefined): number {
  return isCoreV2(ruleset) ? CORE_V2_TUNNEL_COUNT : LEGACY_TUNNEL_COUNT;
}

export function defaultHoldingCapacity(ruleset: GameRuleset | undefined): number {
  return isCoreV2(ruleset) ? DEFAULT_HOLDING_CAPACITY_V2 : DEFAULT_HOLDING_CAPACITY_V1;
}

export function emptyTunnelQueues(ruleset: GameRuleset | undefined): ChargeSpec[][] {
  return Array.from({ length: expectedTunnelCount(ruleset) }, () => [] as ChargeSpec[]);
}
