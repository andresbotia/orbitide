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
  fieldCenter: '#3F32AA',
  fieldEdge: '#211A5E',
  /** Rounded-rail structural band. */
  railBand: '#5546D6',
  /** Machined groove down the center of the band. */
  railGroove: '#7263F0',
  /** Top-left catch-light on the rail. */
  railHighlight: '#D2C6FF',
  /** Inner informational guide line, near the artwork. */
  railGlow: '#8FF0FF',
  /** Shared launcher gate at the bottom-center perimeter entry. */
  launcherGate: '#FFC94D',
  launcherGlow: '#FFE3A0',
} as const;
