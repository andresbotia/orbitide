import { PrimaryCta } from '@/components/brand';

interface PlayButtonProps {
  label?: string;
  onPress: () => void;
  /** Fired on touch-down for immediate feedback (haptic / activation). */
  onPressIn?: () => void;
  disabled?: boolean;
}

/**
 * Home's primary action. M3.6B: adopts the shared Pixel Arcadia primary-CTA
 * treatment (grad.cta fill, inset highlight + lip, warm drop glow, #2A1405 ink)
 * so PLAY, NEXT, RETRY and CONTINUE all read as the same control. Position and
 * props are unchanged.
 */
export function PlayButton({ label = 'PLAY', onPress, onPressIn, disabled }: PlayButtonProps) {
  return (
    <PrimaryCta
      label={label}
      onPress={onPress}
      onPressIn={onPressIn}
      disabled={disabled}
      style={{ width: 236 }}
    />
  );
}
