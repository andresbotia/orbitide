import { Circle, Group } from '@shopify/react-native-skia';
import { useMemo } from 'react';

/** Tiny deterministic PRNG so the starfield is stable across renders. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface StarfieldProps {
  size: number;
  count?: number;
  seed?: number;
}

/** Subtle background depth: a scatter of faint stars behind the board. */
export function Starfield({ size, count = 46, seed = 20260907 }: StarfieldProps) {
  const stars = useMemo(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: count }, () => ({
      x: rand() * size,
      y: rand() * size,
      r: 0.4 + rand() * 1.4,
      opacity: 0.06 + rand() * 0.22,
    }));
  }, [size, count, seed]);

  return (
    <Group>
      {stars.map((star, i) => (
        <Circle
          key={i}
          cx={star.x}
          cy={star.y}
          r={star.r}
          color="#C9D6FF"
          opacity={star.opacity}
        />
      ))}
    </Group>
  );
}
