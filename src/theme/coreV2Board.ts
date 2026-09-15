/**
 * M5.3 — Core V2 gameplay board palette.
 *
 * Home-language navy/cyan cabinet paint for the Core V2 board canvas.
 * Scoped to this board — HUD / tunnels / Holding read `homeV2` directly.
 */
export const coreV2Board = {
  /** Board plane fill, top -> bottom. Dark enough that Pals read without halos. */
  fieldCenter: '#002662',
  fieldEdge: '#001742',
  /** Rounded-rail structural band — dark teal-blue, not purple. */
  railBand: '#003057',
  /** Machined groove down the center of the band. */
  railGroove: '#00487A',
  /** Upper edge-light on the rail. */
  railHighlight: '#01D8FD',
  /** Inner informational guide line, near the artwork. Kept for legacy callers. */
  railGlow: '#8FF0FF',
  /** Shared launcher gate at the bottom-center perimeter entry. */
  launcherGate: '#FDD54B',
  launcherGlow: '#FFE3A0',
  /** Recessed lip just inside the rail — no stroke, no hairline. */
  innerLip: '#000C28',
} as const;
