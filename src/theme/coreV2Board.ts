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
  /** Board plane fill, center -> edge. */
  fieldCenter: '#241B63',
  fieldEdge: '#140F3C',
  /** Rounded-rail structural band. */
  railBand: '#3A2E8A',
  /** Machined groove down the center of the band. */
  railGroove: '#4B3DB0',
  /** Top-left catch-light on the rail. */
  railHighlight: '#B8A9FF',
  /** Inner informational guide line, near the artwork. */
  railGlow: '#7FE9FF',
  /** Shared launcher gate at the bottom-center perimeter entry. */
  launcherGate: '#FFC94D',
  launcherGlow: '#FFE3A0',
} as const;
