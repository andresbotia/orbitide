import { orbitFraction } from '@/game/engine/orbit';
import { progressAt } from '@/game/presentation/motion';
import type { FlightPass } from '@/game/presentation/events';
import type { BoardLayout, Point } from './layout';
/** The single position function used by the rendered orb AND every projectile. */
export function flightPosition(pass: FlightPass, layout: BoardLayout, time: number): Point {
  'worklet';
  if (time < pass.liftMs) {
    const from = pass.from ?? { x: layout.center.x + (pass.sourceIndex - 1) * 80, y: layout.size + 50 };
    const p = Math.max(0, time / pass.liftMs);
    const e = 1 - (1 - p) ** 2;
    return { x: from.x + (layout.insertion.x - from.x) * e,
      y: from.y + (layout.insertion.y - from.y) * e };
  }
  const angle = orbitFraction(progressAt(pass, time)) * Math.PI * 2 - Math.PI / 2;
  const point = { x: layout.center.x + Math.cos(angle) * layout.orbit[0]!.rx,
    y: layout.center.y + Math.sin(angle) * layout.orbit[0]!.ry };
  if (time > pass.orbitEndAt && pass.endKind === 'toHolding') {
    const to = pass.holdingTarget ?? { x: layout.center.x, y: layout.size + 100 };
    const p = Math.min(1, (time - pass.orbitEndAt) / (pass.landingAt - pass.orbitEndAt));
    return { x: point.x + (to.x - point.x) * p, y: point.y + (to.y - point.y) * p };
  }
  return point;
}
