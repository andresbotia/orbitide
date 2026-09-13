/**
 * Authored tunnel-queue metrics. Tunnel count is taken from the definition —
 * never hardcoded to 3 or 4 — so Legacy V1 and Core V2 share this helper.
 */
import type { LevelDefinition } from '@/game/engine/types';
import type { QueueMetrics } from './types';

export function queueMetrics(def: LevelDefinition): QueueMetrics {
  const perTunnelDepth = def.tunnels.map((q) => q.length);
  const tunnelCount = perTunnelDepth.length;
  const totalCharges = perTunnelDepth.reduce((n, d) => n + d, 0);
  return {
    tunnelCount,
    totalCharges,
    perTunnelDepth,
    maxTunnelDepth: tunnelCount > 0 ? Math.max(...perTunnelDepth) : 0,
    minTunnelDepth: tunnelCount > 0 ? Math.min(...perTunnelDepth) : 0,
  };
}
