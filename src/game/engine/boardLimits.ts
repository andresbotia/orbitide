/**
 * Authored board-size limits — the single source for content validation, the
 * Level Studio and the renderer.
 *
 * The engine itself has no size ceiling: attack-line bins, rays and solver keys
 * all scale with `width`/`height`. The ceiling is a readability decision. A
 * Core V2 board keeps roughly the same on-screen size at every density (see
 * `packRoundedRectBoard`), so more cells means smaller cells. 48 keeps a cell at
 * ≥ ~5.3pt on the narrowest supported phone (375pt wide, 267pt of artwork
 * interior), which is still a distinct, gutter-separated pixel; 40 keeps it
 * at ≥ 6.5pt.
 */
export const MIN_BOARD_DIMENSION = 1;
export const MAX_BOARD_DIMENSION = 48;
