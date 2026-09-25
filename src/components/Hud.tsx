import { memo, useCallback, useEffect, useState, type ReactNode } from 'react';
import { type LayoutChangeEvent, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';

import { usePressDepth } from '@/components/gameplay/motionKit';
import { AvIcon, type AvIconName } from '@/components/v2/AvIcon';
import { CoinMedallion, DifficultyMeter, LipSurface, PixelCaption } from '@/components/v2/primitives';
import type { LevelDifficulty } from '@/game/engine/types';
import { AV, AV_DEPTH, AV_FONT, AV_SIZE, AV_TYPE, formatCount } from '@/theme/arcadiaV2';
import { GAMEPLAY } from '@/theme/gameplayLayout';
import { GP } from '@/theme/gameplayUi';

interface HudProps {
  levelId: number;
  difficulty: LevelDifficulty;
  /** Presented cleared pixels / total — the only values the HUD re-renders on. */
  cleared: number;
  total: number;
  coins?: number;
  onRestart: () => void;
  onHome: () => void;
}

const BTN = GAMEPLAY.hudButton;
const HIT = GAMEPLAY.hudButtonHit;
const PLATE_W = AV_SIZE.levelPlateW;
const PLATE_H = AV_SIZE.levelPlateH;
const TAB_W = AV_SIZE.progressTabW;
const TAB_H = AV_SIZE.progressTabH;
const TRACK_H = GAMEPLAY.hudProgressHeight;

/**
 * M7A — v2 gameplay top HUD. Left: a 40pt glass menu button that opens a
 * sheet with Resume / Home / Restart. Centre: the one bright plate on the
 * screen — LEVEL + number | difficulty pips + label — with the board progress
 * tab hanging under it. Right: a glass coin chip (no "+": no shopping
 * mid-level). Only `ProgressTab` re-renders per presented clear.
 *
 * The menu does not freeze the board: the game has no timer, so with no taps
 * nothing new launches; Pals already on the track finish their lap.
 */
export const Hud = memo(function Hud({ levelId, difficulty, cleared, total, coins, onRestart, onHome }: HudProps) {
  const progress = total === 0 ? 0 : cleared / total;
  const [menuOpen, setMenuOpen] = useState(false);
  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const handleHome = useCallback(() => { setMenuOpen(false); onHome(); }, [onHome]);
  const handleRestart = useCallback(() => { setMenuOpen(false); onRestart(); }, [onRestart]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <GlassButton onPress={openMenu} accessibilityLabel="Menu">
          <View style={styles.pauseBars}>
            <View style={styles.pauseBar} />
            <View style={styles.pauseBar} />
          </View>
        </GlassButton>
        <View style={styles.spacer} />
        {coins !== undefined ? <CoinChip coins={coins} /> : null}
      </View>

      <View pointerEvents="box-none" style={styles.center}>
        <LevelPlate levelId={levelId} difficulty={difficulty} />
        <ProgressTab progress={progress} />
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={closeMenu} statusBarTranslucent>
        <Pressable style={styles.scrim} onPress={closeMenu} accessibilityLabel="Close menu" accessibilityRole="button">
          <Pressable style={styles.sheet} onPress={() => undefined} accessible={false}>
            <PixelCaption color={AV.iconSoft} size={12}>{`LEVEL ${levelId}`}</PixelCaption>
            <Text style={styles.sheetTitle}>Menu</Text>
            <Pressable
              onPress={closeMenu}
              accessibilityRole="button"
              accessibilityLabel="Resume"
              style={({ pressed }) => [styles.resume, pressed && styles.pressedDown]}
            >
              <LipSurface
                height={54}
                radius={18}
                lip={AV_DEPTH.ctaLip}
                lipColor={AV.goldLip}
                colors={[AV.goldLight, AV.gold, AV.goldDeep]}
                locations={[0, 0.55, 1]}
                faceStyle={styles.resumeFace}
              >
                <AvIcon name="resume" size={20} color={AV.goldInk} stroke={2.6} />
                <Text style={styles.resumeLabel}>RESUME</Text>
              </LipSurface>
            </Pressable>
            <View style={styles.actions}>
              <SheetButton icon="home" label="Home" accessibilityLabel="Home" onPress={handleHome} />
              <SheetButton icon="restart" label="Restart" accessibilityLabel="Restart level" onPress={handleRestart} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
});

const GlassButton = memo(function GlassButton({ onPress, accessibilityLabel, children }: {
  onPress: () => void; accessibilityLabel: string; children: ReactNode;
}) {
  const { depth, pressIn, pressOut } = usePressDepth();
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 - depth.value * 0.08 }] }));
  const slop = Math.max(0, Math.ceil((HIT - BTN) / 2));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={slop}
    >
      <Animated.View style={[styles.glassBtn, style]}>{children}</Animated.View>
    </Pressable>
  );
});

const SheetButton = memo(function SheetButton({ icon, label, accessibilityLabel, onPress }: {
  icon: AvIconName; label: string; accessibilityLabel: string; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.sheetBtnWrap, pressed && styles.pressedDown]}
    >
      <LipSurface
        height={52}
        radius={16}
        lip={AV_DEPTH.plateLip}
        lipColor={AV.plateLip}
        colors={[AV.plate, AV.plateLow]}
        faceStyle={styles.sheetBtnFace}
      >
        <AvIcon name={icon} size={22} color={AV.icon} stroke={2.4} />
        <Text style={styles.sheetBtnLabel}>{label}</Text>
      </LipSurface>
    </Pressable>
  );
});

const CoinChip = memo(function CoinChip({ coins }: { coins: number }) {
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={`${coins} coins`} style={styles.coinChip}>
      <CoinMedallion size={22} />
      <Text style={styles.coinNum}>{formatCount(coins)}</Text>
    </View>
  );
});

const LevelPlate = memo(function LevelPlate({ levelId, difficulty }: { levelId: number; difficulty: LevelDifficulty }) {
  return (
    <LipSurface
      width={PLATE_W}
      height={PLATE_H}
      radius={16}
      lip={AV_DEPTH.plateLip}
      lipColor={AV.plateLip}
      colors={[AV.plate, AV.plateLow]}
      lift={AV_DEPTH.lift}
      style={styles.plateLayer}
      faceStyle={styles.plateFace}
    >
      <View style={styles.levelBlock} accessible accessibilityRole="text" accessibilityLabel={`Level ${levelId}`}>
        <PixelCaption size={10}>LEVEL</PixelCaption>
        <Text style={styles.levelNum} numberOfLines={1} adjustsFontSizeToFit>{levelId}</Text>
      </View>
      <View style={styles.plateDivider} />
      <DifficultyMeter
        difficulty={difficulty}
        pipWidth={10}
        pipHeight={6}
        gap={2}
        vertical
        labelStyle={styles.diffLabel}
      />
    </LipSurface>
  );
});

/**
 * Board progress tab under the level plate. Compositor-only: a full-width
 * mint fill slid left by (1 - progress), clipped by the track — animating
 * `width` would re-run layout on every clear. The fill eases on each clear;
 * nothing moves between clears.
 */
const ProgressTab = memo(function ProgressTab({ progress }: { progress: number }) {
  const reducedMotion = useReducedMotion();
  const fill = useSharedValue(progress);
  const trackW = useSharedValue(0);
  useEffect(() => {
    fill.set(withTiming(progress, { duration: reducedMotion ? 0 : 220, easing: Easing.out(Easing.quad) }));
  }, [progress, reducedMotion, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: trackW.value > 0 ? 1 : 0,
    transform: [{ translateX: (fill.value - 1) * trackW.value }],
  }));
  const onTrackLayout = (e: LayoutChangeEvent) => trackW.set(Math.max(0, e.nativeEvent.layout.width));
  const pct = Math.floor(progress * 100);

  return (
    <View style={styles.tab} accessible accessibilityRole="progressbar" accessibilityLabel={`Board ${pct} percent cleared`}>
      <View style={styles.track} onLayout={onTrackLayout}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
      <Text style={styles.pct}>{pct}%</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    height: 70,
    marginTop: AV_SIZE.hudTopGap,
    marginBottom: 10,
    zIndex: 5,
  },
  row: {
    height: AV_SIZE.hudRow,
    paddingHorizontal: AV_SIZE.sideMargin,
    flexDirection: 'row',
    alignItems: 'center',
  },
  spacer: { flex: 1 },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  glassBtn: {
    width: BTN,
    height: BTN,
    borderRadius: 14,
    backgroundColor: AV.glass,
    borderWidth: 1,
    borderColor: AV.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseBars: { flexDirection: 'row', gap: 4 },
  pauseBar: { width: 4, height: 14, borderRadius: 2, backgroundColor: AV.white },
  coinChip: {
    height: 32,
    paddingLeft: 5,
    paddingRight: 12,
    borderRadius: 16,
    backgroundColor: AV.glassDark,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  coinNum: { ...AV_TYPE.counter, fontSize: 14, color: AV.white },
  plateLayer: { zIndex: 1 },
  plateFace: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 10,
  },
  levelBlock: { alignItems: 'flex-start' },
  levelNum: { ...AV_TYPE.plateNumber, color: AV.ink, maxWidth: 56 },
  plateDivider: { width: 1, height: 26, backgroundColor: 'rgba(23,48,110,0.14)' },
  diffLabel: { fontFamily: AV_FONT.bold, fontSize: 11, color: AV.ink },
  tab: {
    width: TAB_W,
    height: TAB_H,
    marginTop: -2,
    paddingTop: 3,
    paddingHorizontal: 8,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: AV.glassDeep,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  track: {
    flex: 1,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    height: '100%',
    borderRadius: TRACK_H / 2,
    backgroundColor: GP.mint,
  },
  pct: {
    fontFamily: AV_FONT.extraBold,
    fontSize: 9,
    color: AV.white,
    minWidth: 24,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  scrim: {
    flex: 1,
    backgroundColor: GP.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 26,
    backgroundColor: AV.plate,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    alignItems: 'center',
    gap: 12,
    ...AV_DEPTH.lift,
  },
  sheetTitle: { ...AV_TYPE.title, fontSize: 22, color: AV.ink, marginTop: -6 },
  resume: { alignSelf: 'stretch' },
  resumeFace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  resumeLabel: { ...AV_TYPE.cta, fontSize: 20, color: AV.goldInk },
  actions: { flexDirection: 'row', alignSelf: 'stretch', gap: 12 },
  sheetBtnWrap: { flex: 1 },
  sheetBtnFace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  sheetBtnLabel: { fontFamily: AV_FONT.extraBold, fontSize: 15, color: AV.icon },
  pressedDown: { transform: [{ translateY: 2 }], opacity: 0.92 },
});
