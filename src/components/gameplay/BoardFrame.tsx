import { memo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

interface BoardFrameProps {
  /** The board's own square edge length (`boardSize` in `GameScreen`). */
  size: number;
  /** Faint environmental hint only — never recolors board/pixel/HUD materials. */
  worldAccent: string;
  active: boolean;
  reducedMotion: boolean;
  /** 0 idle -> 1 on the win transition. Kept so GameScreen's celebrate clock is harmless. */
  celebrate: SharedValue<number>;
}

/**
 * Pal overflow inset. The decorative cabinet bezel, cyan hairline, rivets,
 * and outer aura were removed — the rail is the only gameplay frame. This
 * inset is just enough for in-flight Pals sitting on a near-edge rail.
 */
export const BOARD_FRAME_MARGIN = 8;
/** @deprecated Use {@link BOARD_FRAME_MARGIN}. */
export const BOARD_EDGE_INSET = BOARD_FRAME_MARGIN;

/**
 * Decorative outer board chrome is gone. The rail in `RoundedRail` is the
 * load-bearing frame. This component is a no-op so existing GameScreen
 * wiring (celebrate / sizing) does not have to fork.
 */
export const BoardFrame = memo(function BoardFrame(_props: BoardFrameProps) {
  return null;
});
