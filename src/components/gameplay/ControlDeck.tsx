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
 * Single gameplay control surface: Active, ready Pals, Holding, item dock.
 * Material matches Home's nav deck. Slot count follows engine capacity.
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
      <View pointerEvents="none" style={styles.bevel} />
      <View pointerEvents="none" style={[styles.screw, styles.screwTL]} />
      <View pointerEvents="none" style={[styles.screw, styles.screwTR]} />
      {activeCapacity > 0 ? (
        <ActiveStatus count={activeCount} capacity={activeCapacity} embedded />
      ) : null}
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
      <ItemRack />
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
    paddingTop: GAMEPLAY.deckPadTop,
    paddingHorizontal: GAMEPLAY.deckPadX,
    paddingBottom: GAMEPLAY.deckPadBottom,
    gap: GAMEPLAY.deckGap,
    borderTopWidth: 1,
    borderTopColor: homeAlpha(homeV2.cyan, 0.22),
    shadowColor: homeV2.cyan,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  litEdge: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: homeAlpha(homeV2.cyan, 0.7),
  },
  bevel: {
    position: 'absolute',
    top: 2,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: homeAlpha(homeV2.navy, 0.35),
  },
  screw: {
    position: 'absolute',
    top: 8,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: homeAlpha(homeV2.yellow, 0.55),
    borderWidth: 1,
    borderColor: homeAlpha(homeV2.yellow, 0.8),
  },
  screwTL: { left: 8 },
  screwTR: { right: 8 },
  status: {
    color: homeAlpha(homeV2.white, 0.7),
    fontSize: 12,
    textAlign: 'center',
    marginTop: -4,
  },
});
