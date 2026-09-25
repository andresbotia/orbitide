import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AvIcon } from '@/components/v2/AvIcon';
import { DifficultyMeter, PixelCaption, PixelStepBadge, type BadgeTone } from '@/components/v2/primitives';
import type { LevelDifficulty } from '@/game/engine/types';
import { AV, AV_FONT, AV_TYPE, DIFFICULTY_LABEL } from '@/theme/arcadiaV2';

interface HomeLevelCardProps {
  levelId: number;
  title: string;
  difficulty: LevelDifficulty;
  /** The level after this one, when the campaign has one. */
  nextLevelId?: number;
  /** Coins a first clear pays — what the chest node stands for. */
  clearReward: number;
  /** Small phones: the badge steps down so the strip never crowds the CTA. */
  compact?: boolean;
}

const BADGE_TONE: Record<LevelDifficulty, BadgeTone> = {
  easy: 'blue',
  medium: 'blue',
  hard: 'coral',
  'super-hard': 'violet',
  extreme: 'violet',
};

/**
 * M7A — v2 Home progression: a dotted strip of pixel-rounded nodes — the two
 * cleared levels before this one (mint ✓), the current level as the big
 * pixel-stepped badge, the next level (glass) and a gold reward chest — then
 * the level title and a 4-pip difficulty chip. Static; nothing animates.
 */
export const HomeLevelCard = memo(function HomeLevelCard({
  levelId,
  title,
  difficulty,
  nextLevelId,
  clearReward,
  compact = false,
}: HomeLevelCardProps) {
  const done = [levelId - 2, levelId - 1].filter((id) => id >= 1);
  const tone = BADGE_TONE[difficulty];
  const badgeW = compact ? 84 : 96;
  const badgeH = compact ? 82 : 94;

  return (
    <View style={styles.wrap}>
      <View style={[styles.strip, { height: badgeH + 6 }]}>
        <View pointerEvents="none" style={styles.dots}>
          {DOTS.map((i) => <View key={i} style={styles.dot} />)}
        </View>

        {done.map((id) => (
          <View key={id} style={[styles.node, styles.nodeDone]} accessible accessibilityLabel={`Level ${id}, cleared`}>
            <View style={[styles.nodeLip, { backgroundColor: AV.mintLip }]} />
            <AvIcon name="check" size={14} color={AV.white} stroke={4} />
          </View>
        ))}

        <View accessible accessibilityRole="header" accessibilityLabel={`Level ${levelId}, ${DIFFICULTY_LABEL[difficulty]}`}>
          {tone === 'violet' ? <PixelCrown width={badgeW} /> : null}
          <PixelStepBadge width={badgeW} height={badgeH} tone={tone}>
            <PixelCaption color="#D6E6FF">LEVEL</PixelCaption>
            <Text
              style={[styles.badgeNumber, compact && styles.badgeNumberCompact]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {levelId}
            </Text>
          </PixelStepBadge>
        </View>

        {nextLevelId !== undefined ? (
          <View style={[styles.node, styles.nodeNext]} accessible accessibilityLabel={`Next: level ${nextLevelId}`}>
            <View style={[styles.nodeLip, { backgroundColor: 'rgba(23,48,110,0.15)' }]} />
            <Text style={styles.nextNum} numberOfLines={1} adjustsFontSizeToFit>{nextLevelId}</Text>
          </View>
        ) : null}

        <View style={styles.chestLift} accessible accessibilityLabel={`First clear reward: ${clearReward} coins`}>
          <LinearGradient colors={[AV.goldLight, AV.gold]} style={styles.chest}>
            <View style={[styles.nodeLip, { backgroundColor: AV.goldLip }]} />
            <AvIcon name="chest" size={20} color={AV.chestInk} stroke={2.4} />
          </LinearGradient>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={styles.diffChip}>
        <DifficultyMeter difficulty={difficulty} clipLabel labelStyle={styles.diffLabel} />
      </View>
    </View>
  );
});

/** Pixel crown on the badge's top step — Super Hard's content-purple cue. */
function PixelCrown({ width }: { width: number }) {
  return (
    <View pointerEvents="none" style={[styles.crown, { left: width / 2 - 13 }]}>
      <View style={styles.crownRow}>
        <View style={styles.crownPoint} />
        <View style={[styles.crownPoint, styles.crownPointMid]} />
        <View style={styles.crownPoint} />
      </View>
      <View style={styles.crownBand} />
    </View>
  );
}

const NODE = 30;
/** Dotted connector: dots spread evenly along the strip (RN can't dot a single border side on iOS). */
const DOTS = Array.from({ length: 34 }, (_, i) => i);

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10 },
  strip: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  dots: {
    position: 'absolute',
    left: 54,
    right: 54,
    top: '50%',
    marginTop: -1.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(23,48,110,0.25)' },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  nodeDone: { backgroundColor: AV.mint },
  nodeNext: { backgroundColor: 'rgba(255,255,255,0.55)' },
  nodeLip: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3 },
  nextNum: { fontFamily: AV_FONT.extraBold, fontSize: 13, color: AV.inkSoft, paddingHorizontal: 2 },
  chest: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // On the wrapper: `overflow: hidden` on the chest itself would clip it.
  chestLift: {
    shadowColor: AV.goldLip,
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 4 },
  },
  badgeNumber: {
    ...AV_TYPE.badgeNumber,
    color: AV.white,
    textShadowColor: AV.badgeLip,
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 0,
    maxWidth: 84,
  },
  badgeNumberCompact: { fontSize: 34, lineHeight: 36, maxWidth: 72 },
  title: { ...AV_TYPE.title, color: AV.ink, maxWidth: 320, textAlign: 'center' },
  // Content-sized: no width, the label never shrinks, and it clips rather than
  // ellipsizes, so a sub-point rounding shortfall from centring can't eat it.
  diffChip: {
    height: 26,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
  },
  diffLabel: { flexShrink: 0 },
  crown: { position: 'absolute', top: -9, width: 26, zIndex: 2, alignItems: 'center' },
  crownRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', width: 26 },
  crownPoint: { width: 6, height: 6, backgroundColor: AV.gold },
  crownPointMid: { height: 9 },
  crownBand: { width: 26, height: 5, backgroundColor: AV.gold, borderBottomWidth: 2, borderBottomColor: AV.goldLip },
});
