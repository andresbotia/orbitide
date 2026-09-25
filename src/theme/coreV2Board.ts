/**
 * M5.3 — Core V2 gameplay board palette.
 *
 * M7A — the v2 blue-forward board: a light blue track band framing a deep
 * `#10245B` well, the only deep surface on screen, so pixel colours, Pals and
 * hits carry the energy. Static paint only — no animated border, no cyan
 * outline. Scoped to this board.
 */
export const coreV2Board = {
  /** Board well (the rail interior), top -> bottom. */
  fieldCenter: '#10245B',
  fieldEdge: '#0C1D4C',
  /** v2 track band gradient, top -> bottom. */
  trackTop: '#7598FF',
  trackBottom: '#5F86FF',
  /** Track bevel: top light + bottom shade. */
  trackBevelLight: 'rgba(255,255,255,0.5)',
  trackBevelShade: 'rgba(25,55,150,0.35)',
  /** Seam just outside the well. */
  wellRim: 'rgba(28,60,160,0.55)',
  /** Direction chevrons along the track centreline. */
  chevron: 'rgba(255,255,255,0.38)',
  /**
   * Legacy navy/cyan rail values. Kept (and asserted by
   * `gameplayShell.test.ts`) for the Legacy V1 path; the v2 track above is
   * what `RoundedRail` paints.
   */
  railBand: '#003057',
  railGroove: '#00487A',
  railHighlight: '#01D8FD',
  /** Inner informational guide line, near the artwork. Kept for legacy callers. */
  railGlow: '#8FF0FF',
  /** Shared launcher gate at the bottom-center perimeter entry — v2 amber ring. */
  launcherGate: '#FFC53D',
  launcherGlow: '#FFE27A',
  launcherCore: '#203B8F',
  /** Recessed lip just inside the rail — no stroke, no hairline. */
  innerLip: '#000C28',
} as const;
