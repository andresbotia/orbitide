import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActiveStatus } from '@/components/ActiveStatus';
import { HoldingTray } from '@/components/HoldingTray';
import { TunnelBar } from '@/components/TunnelBar';
import type { Charge, GameState } from '@/game/engine/types';
import type { Point } from '@/game/rendering/boardGeometry';
import type { TutorialView } from '@/game/tutorial';
import { homeAlpha, homeV2 } from '@/theme/homeV2';

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
  onLaunchTunnel: (id: string) => void;
  onLaunchHeld: (id: string) => void;
  message: string;
  tutorial?: TutorialView;
}

function isTransientStatus(message: string): boolean {
  if (!message.trim()) return false;
  if (/tap a held/i.test(message)) return false;
  return true;
}

/**
 * Single gameplay control surface: Active, Holding (4 slots), Tunnels (4).
 * Material matches Home's nav deck. No per-row cards, T-labels, or helper copy.
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
      <View pointerEvents="none" style={styles.litEdge} />
      {activeCapacity > 0 ? (
        <ActiveStatus count={activeCount} capacity={activeCapacity} embedded />
      ) : null}
      <HoldingTray
        layoutVersion={layoutVersion}
        holding={holding}
        capacity={state.holdingCapacity}
        overflow={state.status === 'lost'}
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
      {status ? (
        <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  deck: {
    width: '100%',
    backgroundColor: homeV2.deepNavy,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  litEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: homeAlpha(homeV2.cyan, 0.3),
  },
  status: {
    color: homeAlpha(homeV2.white, 0.7),
    fontSize: 12,
    textAlign: 'center',
    marginTop: -8,
  },
});
