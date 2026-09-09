/**
 * Local, deliberately plain visual tokens for the internal Level Studio. This is
 * a developer tool — clarity over beauty — so it does not pull in the consumer
 * Cosmic Arcade design system.
 */
export const studioTheme = {
  bg: '#12141a',
  panel: '#1b1e27',
  panelAlt: '#232733',
  border: '#333949',
  borderStrong: '#454d63',
  text: '#e7eaf2',
  textDim: '#9aa2b4',
  textFaint: '#6b7387',
  accent: '#5b9dff',
  accentText: '#0a0c11',
  error: '#ff6b81',
  warning: '#ffbf47',
  ok: '#54d6a0',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

export const studioSpace = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
