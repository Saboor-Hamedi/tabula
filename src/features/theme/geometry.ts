/** Breathing room kept between items and the board edge (also fits the tape) */
export const BOARD_PADDING = 12;

export interface Size {
  width: number;
  height: number;
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), Math.max(min, max));

/** Keeps an item of size w×h fully inside the board. */
export function clampPoint(
  bounds: Size | null,
  x: number,
  y: number,
  w: number,
  h: number,
): { x: number; y: number } {
  if (!bounds) return { x, y };
  return {
    x: clamp(x, BOARD_PADDING, bounds.width - w - BOARD_PADDING),
    y: clamp(y, BOARD_PADDING, bounds.height - h - BOARD_PADDING),
  };
}
