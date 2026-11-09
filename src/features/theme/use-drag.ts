import { useState, useRef, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { clampPoint } from './geometry';

interface UseDragOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  boundsRef: RefObject<HTMLElement | null>;
  onMove: (x: number, y: number) => void;
}

interface DragOrigin {
  pointerX: number;
  pointerY: number;
  x: number;
  y: number;
}

/**
 * Pointer-based dragging (mouse, touch, pen) with the item kept inside the board.
 * Anything marked `data-no-drag` inside the item (text areas, buttons) is left alone.
 * `onHandleKeyDown` gives keyboard users the same movement with the arrow keys.
 */
export function useDrag({ x, y, width, height, boundsRef, onMove }: UseDragOptions) {
  const origin = useRef<DragOrigin | null>(null);
  const [dragging, setDragging] = useState(false);

  const place = (nextX: number, nextY: number) => {
    const el = boundsRef.current;
    const bounds = el ? { width: el.clientWidth, height: el.clientHeight } : null;
    const p = clampPoint(bounds, nextX, nextY, width, height);
    onMove(p.x, p.y);
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if ((event.target as HTMLElement).closest('[data-no-drag]')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    origin.current = { pointerX: event.clientX, pointerY: event.clientY, x, y };
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const start = origin.current;
    if (!start) return;
    place(start.x + event.clientX - start.pointerX, start.y + event.clientY - start.pointerY);
  };

  const end = (event: PointerEvent<HTMLElement>) => {
    if (!origin.current) return;
    origin.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onHandleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const step = event.shiftKey ? 48 : 12;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = moves[event.key];
    if (!delta) return;
    event.preventDefault();
    place(x + delta[0], y + delta[1]);
  };

  return {
    dragging,
    dragProps: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end },
    onHandleKeyDown,
  };
}
