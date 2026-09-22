import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming,
} from 'react-native-reanimated';

import { ActiveStatus } from '@/components/ActiveStatus';
import { ItemRack } from '@/components/gameplay/ItemRack';
import { HoldingStatus, HoldingTray } from '@/components/HoldingTray';
import { TunnelBar } from '@/components/TunnelBar';
import type { Charge, GameState } from '@/game/engine/types';
import type { Point } from '@/game/rendering/boardGeometry';
import type { TutorialView } from '@/game/tutorial';
import type { LaunchDenial, LaunchDenialReason } from '@/hooks/useGameSession';
import type { GameplayItemId } from '@/game/economy/config';
import { GAMEPLAY } from '@/theme/gameplayLayout';
import { GP, GP_TYPE } from '@/theme/gameplayUi';


interface ControlDeckProps {
  state: GameState;
  activeCount: number;
  activeCapacity: number;
  layoutVersion: number;
  disabled: boolean;
  /** Rail full: controls stay pressable (so a refused tap can explain itself) but read as blocked. */
  blocked: boolean;
  /** Bumped per tap refused because ACTIVE is full (drives the ACTIVE flash). */
  capacityRefusalSeq: number;
  usefulIds: Set<string>;
  colorAssist?: boolean;
  pixelPal: boolean;
  onSourceLayout: (key: string, point: Point) => void;
  onLaunchTunnel: (id: string) => boolean;
  onLaunchHeld: (id: string) => boolean;
  /** The most recent refused tap; drives the one-line notice over the status strip. */
  denial: LaunchDenial | null;
  tutorial?: TutorialView;
  inventory?: Record<GameplayItemId, number>;
  canUndo?: boolean;
  extraSlotActive?: boolean;
  bombArmed?: boolean;
  onPressItem?: (itemId: GameplayItemId) => void;
}

/**
 * Why a tap did nothing, in the deck's own words. ACTIVE-full needs no text —
 * the ACTIVE meter itself flashes — and tutorial refusals are the coach's job.
 */
const DENIAL_NOTICE: Record<LaunchDenialReason, string> = {
  activeFull: '',
  tutorial: '',
  // The level is already decided in truth; its result card is on its way, so
  // the tap gets its acknowledgement without a competing message.
  gameOver: '',
  unavailable: 'PAL NOT AVAILABLE',
  inFlight: 'PAL STILL IN FLIGHT',
};
/** TUNABLE — how long a refusal notice holds over the strip. */
const NOTICE_HOLD_MS = 1300;

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/**
 * Single gameplay control surface. Slot count follows engine capacity.
 * Visual stack, top to bottom:
 *   STATUS STRIP (ACTIVE · HOLDING) → HOLDING WELLS → TUNNELS → ITEMS
 * Both pressure readouts share one strip directly above the controls that
 * change them, so the deck spends one row on status instead of two.
 */
export const ControlDeck = memo(function ControlDeck({
  state,
  activeCount,
  activeCapacity,
  layoutVersion,
  disabled,
  blocked,
  capacityRefusalSeq,
  usefulIds,
  colorAssist,
  pixelPal,
  onSourceLayout,
  onLaunchTunnel,
  onLaunchHeld,
  denial,
  tutorial,
  inventory,
  canUndo,
  extraSlotActive,
  bombArmed,
  onPressItem,
}: ControlDeckProps) {
  const holding: Charge[] = state.holding;

  return (
    <View style={styles.deck}>
      {/* Subtle lit edge along the top — hardware seam */}
      <View pointerEvents="none" style={styles.litEdge} />

      <View style={styles.strip}>
        {activeCapacity > 0 ? (
          <ActiveStatus count={activeCount} capacity={activeCapacity} refusalSeq={capacityRefusalSeq} />
        ) : <View />}
        <HoldingStatus count={holding.length} capacity={state.holdingCapacity} />
        <DeckNotice denial={denial} />
      </View>

      {/* Holding sits above tunnels — the hierarchy is Board → Status → Holding → Tunnels → Items */}
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
        blocked={blocked}
        colorAssist={colorAssist}
        onSourceLayout={onSourceLayout}
        onLaunch={onLaunchTunnel}
        tutorial={tutorial}
        embedded
      />

      <ItemRack
        inventory={inventory}
        canUndo={canUndo}
        extraSlotActive={extraSlotActive}
        bombArmed={bombArmed}
        disabled={disabled}
        onPressItem={onPressItem}
      />
    </View>
  );
}, (prev, next) => (
  prev.activeCount === next.activeCount
  && prev.activeCapacity === next.activeCapacity
  && prev.layoutVersion === next.layoutVersion
  && prev.disabled === next.disabled
  && prev.blocked === next.blocked
  && prev.capacityRefusalSeq === next.capacityRefusalSeq
  && prev.colorAssist === next.colorAssist
  && prev.pixelPal === next.pixelPal
  && prev.canUndo === next.canUndo
  && prev.extraSlotActive === next.extraSlotActive
  && prev.bombArmed === next.bombArmed
  && prev.inventory === next.inventory
  && prev.onPressItem === next.onPressItem
  && prev.onSourceLayout === next.onSourceLayout
  && prev.onLaunchTunnel === next.onLaunchTunnel
  && prev.onLaunchHeld === next.onLaunchHeld
  && prev.denial === next.denial
  && prev.tutorial === next.tutorial
  && setsEqual(prev.usefulIds, next.usefulIds)
  && prev.state.holding === next.state.holding
  && prev.state.holdingCapacity === next.state.holdingCapacity
  && prev.state.tunnels === next.state.tunnels
  && prev.state.ruleset === next.state.ruleset
));

/**
 * A refusal notice that crossfades over the status strip for ~1.3 s. Fixed
 * height and absolutely positioned: it never adds a row, so it can never
 * re-measure (and resize) the board the way the old status line did.
 */
const DeckNotice = memo(function DeckNotice({ denial }: { denial: LaunchDenial | null }) {
  const text = denial ? DENIAL_NOTICE[denial.reason] : '';
  const shown = useSharedValue(0);
  useEffect(() => {
    if (!text) return;
    cancelAnimation(shown);
    shown.set(withSequence(
      withTiming(1, { duration: 120 }),
      withDelay(NOTICE_HOLD_MS, withTiming(0, { duration: 260 })),
    ));
  }, [denial, text, shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value }));
  if (!text) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.notice, style]}>
      <Text accessibilityLiveRegion="polite" style={styles.noticeText}>{text}</Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  deck: {
    width: '100%',
    // One ink control surface with a lit top edge — sections, never cards.
    backgroundColor: GP.deck,
    paddingTop: GAMEPLAY.deckPadTop,
    paddingHorizontal: GAMEPLAY.deckPadX,
    paddingBottom: GAMEPLAY.deckPadBottom,
    gap: GAMEPLAY.deckGap,
    borderTopWidth: 1,
    borderTopColor: GP.hairline,
  },
  litEdge: {
    position: 'absolute',
    top: -1,
    left: 24,
    right: 24,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: GP.litEdge,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  // Deliberately a hairline, not a card border — Holding/Tunnels/Items are
  // one deck with sections, never separately-framed cards.
  separator: {
    height: 1,
    marginHorizontal: 8,
    backgroundColor: GP.hairline,
    opacity: 0.6,
  },
  notice: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: GP.deck,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeText: { ...GP_TYPE.label, color: GP.cyanPale },
});
