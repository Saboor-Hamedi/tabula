import { memo, type CSSProperties, type RefObject } from 'react';
import { STICKER_SIZE, type StickerItem } from './types';
import { useDrag } from './use-drag';
import { usePresence } from './use-presence';

interface StickerCardProps {
  item: StickerItem;
  boundsRef: RefObject<HTMLElement | null>;
  onMove: (id: string, x: number, y: number) => void;
  onRaise: (id: string) => void;
  onRemove: (id: string) => void;
}

export const StickerCard = memo(function StickerCard({
  item,
  boundsRef,
  onMove,
  onRaise,
  onRemove,
}: StickerCardProps) {
  const { stateClass, leave } = usePresence(() => onRemove(item.id), 180);
  const { dragging, dragProps, onHandleKeyDown } = useDrag({
    x: item.x,
    y: item.y,
    width: STICKER_SIZE,
    height: STICKER_SIZE,
    boundsRef,
    onMove: (x, y) => onMove(item.id, x, y),
  });

  return (
    <div
      className={`sticky-sticker-card ${dragging ? 'is-dragging' : ''} ${stateClass}`}
      style={{
        width: STICKER_SIZE,
        height: STICKER_SIZE,
        zIndex: item.z,
        transform: `translate3d(${item.x}px, ${item.y}px, 0)`,
      }}
      onPointerDownCapture={() => onRaise(item.id)}
      {...dragProps}
    >
      <div
        className="sticky-sticker-inner"
        style={{ '--r': `${item.rotate}deg` } as CSSProperties}
      >
        <button
          type="button"
          aria-label={`Sticker ${item.emoji}. Move with arrow keys.`}
          onKeyDown={onHandleKeyDown}
          className="sticky-sticker-symbol"
        >
          {item.emoji}
        </button>
      </div>

      <button
        type="button"
        data-no-drag
        aria-label="Remove sticker"
        title="Remove"
        onClick={leave}
        className="sticky-sticker-delete-btn"
      >
        <svg viewBox="0 0 12 12" className="sticky-sticker-x-icon" aria-hidden="true">
          <path
            d="M2 2l8 8M10 2l-8 8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </button>
    </div>
  );
});
