/**
 * M5.3 — Core V2 gameplay board palette.
 *
 * Deliberately brighter and more luminous than the shared `material` /
 * `brandColor` system, which stays untouched and continues to govern every
 * other screen (spec §13: the old rail "leans too dark"; Core V2 wants a
 * richer navy/indigo base with brighter blue/purple accents). Scoped to the
 * Core V2 board's own canvas paint only — never applied to HUD, tunnel,
 * Holding, or any other screen's chrome.
 */
export const coreV2Board = {
  /** Board plane fill, top -> bottom. Dark enough that Pals read without halos. */
  fieldCenter: '#002662',
  fieldEdge: '#001742',
  /** Rounded-rail structural band — the only gameplay frame. */
  railBand: '#5C44D7',
  /** Machined groove down the center of the band. */
  railGroove: '#7263F0',
  /** 1pt upper edge-light on the rail. */
  railHighlight: '#01D8FD',
  /** Inner informational guide line, near the artwork. Kept for legacy callers. */
  railGlow: '#8FF0FF',
  /** Shared launcher gate at the bottom-center perimeter entry. */
  launcherGate: '#FFC94D',
  launcherGlow: '#FFE3A0',
  /** Recessed lip just inside the rail — no stroke, no hairline. */
  innerLip: '#000C28',
} as const;
