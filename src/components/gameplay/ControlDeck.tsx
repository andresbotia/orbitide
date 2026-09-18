import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActiveStatus } from '@/components/ActiveStatus';
import { ItemRack } from '@/components/gameplay/ItemRack';
import { HoldingTray } from '@/components/HoldingTray';
import { TunnelBar } from '@/components/TunnelBar';
import type { Charge, GameState } from '@/game/engine/types';
import type { Point } from '@/game/rendering/boardGeometry';
import type { TutorialView } from '@/game/tutorial';
import { GAMEPLAY } from '@/theme/gameplayLayout';
import { NEON, neonAlpha } from '@/theme/neon';


interface ControlDeckProps {
  state: GameState;
  activeCount: number;
  activeCapacity: number;
  layoutVersion: number;
  disabled: boolean;
  usefulIds: Set<string>;
  colorAssist?: boolean;
  pixelPal: boolean;
  onSourceLayout: (key: string, point: Point) => void;
  onLaunchTunnel: (id: string) => boolean;
  onLaunchHeld: (id: string) => boolean;
  message: string;
  tutorial?: TutorialView;
}

function isTransientStatus(message: string): boolean {
  if (!message.trim()) return false;
  if (/tap a held/i.test(message)) return false;
  return true;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/**
 * Single gameplay control surface: Active, ready Pals, Holding, item dock.
 * Material matches Home's nav deck. Slot count follows engine capacity.
 * Holding sits ABOVE tunnels in the visual stack:
 *   ACTIVE/STATUS → HOLDING → TUNNELS → ITEMS
 */
export const ControlDeck = memo(function ControlDeck({
  state,
  activeCount,
  activeCapacity,
  layoutVersion,
  disabled,
  usefulIds,
  colorAssist,
  pixelPal,
  onSourceLayout,
  onLaunchTunnel,
  onLaunchHeld,
  message,
  tutorial,
}: ControlDeckProps) {
  const status = isTransientStatus(message) ? message : '';
  const holding: Charge[] = state.holding;

  return (
    <View style={styles.deck}>
      {/* Subtle lit edge along the top — hardware seam */}
      <View pointerEvents="none" style={styles.litEdge} />

      {activeCapacity > 0 ? (
        <ActiveStatus count={activeCount} capacity={activeCapacity} embedded />
      ) : null}

      {/* Holding sits above tunnels — the hierarchy is Board → Active → Holding → Tunnels → Items */}
      <HoldingTray
        layoutVersion={layoutVersion}
        holding={holding}
        capacity={state.holdingCapacity}
        disabled={disabled}
        usefulIds={usefulIds}
        colorAssist={colorAssist}
        pixelPal={pixelPal}
        onSourceLayout={onSourceLayout}
        onLaunch={onLaunchHeld}
        message=""
        tutorial={tutorial}
        embedded
      />

      {/* Separator between holding and tunnels */}
      <View pointerEvents="none" style={styles.separator} />

      <TunnelBar
        layoutVersion={layoutVersion}
        state={state}
        disabled={disabled}
        colorAssist={colorAssist}
        onSourceLayout={onSourceLayout}
        onLaunch={onLaunchTunnel}
        tutorial={tutorial}
        embedded
      />

      <ItemRack />

      {status ? (
        <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>
      ) : null}
    </View>
  );
}, (prev, next) => (
  prev.activeCount === next.activeCount
  && prev.activeCapacity === next.activeCapacity
  && prev.layoutVersion === next.layoutVersion
  && prev.disabled === next.disabled
  && prev.colorAssist === next.colorAssist
  && prev.pixelPal === next.pixelPal
  && prev.onSourceLayout === next.onSourceLayout
  && prev.onLaunchTunnel === next.onLaunchTunnel
  && prev.onLaunchHeld === next.onLaunchHeld
  && prev.message === next.message
  && prev.tutorial === next.tutorial
  && setsEqual(prev.usefulIds, next.usefulIds)
  && prev.state.holding === next.state.holding
  && prev.state.holdingCapacity === next.state.holdingCapacity
  && prev.state.tunnels === next.state.tunnels
  && prev.state.ruleset === next.state.ruleset
));

const styles = StyleSheet.create({
  deck: {
    width: '100%',
    // Same ink-panel + cyan-trim language as Home's bottom nav — the deck
    // reads as one control surface, not stacked components.
    backgroundColor: neonAlpha(NEON.ink, 0.92),
    paddingTop: GAMEPLAY.deckPadTop,
    paddingHorizontal: GAMEPLAY.deckPadX,
    paddingBottom: GAMEPLAY.deckPadBottom,
    gap: GAMEPLAY.deckGap,
    borderTopWidth: 1,
    borderTopColor: neonAlpha(NEON.cyan, 0.35),
  },
  litEdge: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: neonAlpha(NEON.cyan, 0.5),
  },
  // Deliberately a hairline, not a card border — Holding/Tunnels/Items are
  // one deck with sections, never separately-framed cards.
  separator: {
    height: 1,
    marginHorizontal: 8,
    backgroundColor: neonAlpha(NEON.cyan, 0.08),
  },
  status: {
    color: neonAlpha(NEON.cyanPale, 0.6),
    fontSize: 11,
    textAlign: 'center',
    marginTop: -2,
  },
});
