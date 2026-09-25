import { memo, useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming,
} from 'react-native-reanimated';

import { ActiveStatus } from '@/components/ActiveStatus';
import { ItemRack } from '@/components/gameplay/ItemRack';
import { HoldingStatus, HoldingTray } from '@/components/HoldingTray';
import { TunnelBar } from '@/components/TunnelBar';
import type { Charge, GameState, OrbColor } from '@/game/engine/types';
import type { Point } from '@/game/rendering/boardGeometry';
import type { TutorialView } from '@/game/tutorial';
import type { LaunchDenial, LaunchDenialReason } from '@/hooks/useGameSession';
import type { GameplayItemId } from '@/game/economy/config';
import { AV, AV_SIZE } from '@/theme/arcadiaV2';
import { GAMEPLAY } from '@/theme/gameplayLayout';
import { GP, GP_TYPE } from '@/theme/gameplayUi';


interface ControlDeckProps {
  state: GameState;
  activeCount: number;
  activeCapacity: number;
  /** Colours of the Pals on the track, launch order — fills the ACTIVE pips. */
  activeColors?: readonly OrbColor[];
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

/** Tray padding (left, right) and the gap between its sections (pt). */
const TRAY_PAD_L = 14;
const TRAY_PAD_R = 10;
const TRAY_GAP = 10;
/** Room the "HOLDING n/cap" label needs beside the wells. */
const HOLDING_LABEL_W = 58;

/**
 * v2 Holding slot size: 40pt, stepped down only when a 4th (Extra Slot) well
 * would not otherwise fit in the tray's width. The tray never grows taller.
 */
function holdingSlotSize(width: number, capacity: number, activeCapacity: number): number {
  const avail = width - AV_SIZE.sideMargin * 2 - TRAY_PAD_L - TRAY_PAD_R;
  const activeW = activeCapacity > 0 ? activeCapacity * (AV_SIZE.activePipW + 3) - 3 : 0;
  const fixed = activeW + HOLDING_LABEL_W + TRAY_GAP * 3 + 1;
  const fit = Math.floor((avail - fixed - 6 * Math.max(0, capacity - 1)) / Math.max(1, capacity));
  return Math.max(30, Math.min(AV_SIZE.holdingSlot, fit));
}

function colorsEqual(a?: readonly OrbColor[], b?: readonly OrbColor[]): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/**
 * Single gameplay control surface. Slot count follows engine capacity.
 * M7A v2 stack, top to bottom:
 *   TRAY (ACTIVE pips | HOLDING n/cap + wells) → TUNNELS → ITEMS
 * One 58pt glass tray carries both pressure readouts and the Holding wells,
 * directly above the tunnels that feed them. No deck panel: the controls sit
 * on the blue shell.
 */
export const ControlDeck = memo(function ControlDeck({
  state,
  activeCount,
  activeCapacity,
  activeColors,
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
  const { width } = useWindowDimensions();
  const slot = holdingSlotSize(width, state.holdingCapacity, activeCapacity);
  const pal = Math.round(slot * 0.8);

  return (
    <View style={styles.deck}>
      <View style={styles.tray}>
        {activeCapacity > 0 ? (
          <ActiveStatus
            count={activeCount}
            capacity={activeCapacity}
            colors={activeColors}
            refusalSeq={capacityRefusalSeq}
          />
        ) : null}
        <View style={styles.flex} />
        {activeCapacity > 0 ? <View style={styles.divider} /> : null}
        <HoldingStatus count={holding.length} capacity={state.holdingCapacity} />
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
          slotSize={slot}
          palSize={pal}
          embedded
        />
        <DeckNotice denial={denial} />
      </View>

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
  && colorsEqual(prev.activeColors, next.activeColors)
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
 * A refusal notice that crossfades over the tray for ~1.3 s. Absolutely
 * positioned: it never adds a row, so it can never re-measure (and resize)
 * the board the way the old status line did.
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
    paddingTop: GAMEPLAY.deckPadTop,
    paddingHorizontal: GAMEPLAY.deckPadX,
    paddingBottom: GAMEPLAY.deckPadBottom,
    gap: GAMEPLAY.deckGap,
  },
  // v2 tray: one 58pt glass bar — Active left, Holding right.
  tray: {
    height: AV_SIZE.tray,
    borderRadius: 18,
    backgroundColor: AV.glassSoft,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: TRAY_PAD_L,
    paddingRight: TRAY_PAD_R,
    gap: TRAY_GAP,
  },
  flex: { flex: 1 },
  divider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.12)' },
  notice: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 18,
    backgroundColor: AV.shellMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeText: { ...GP_TYPE.label, color: GP.cyanPale },
});
