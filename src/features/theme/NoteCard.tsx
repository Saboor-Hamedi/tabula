import { memo, useEffect, useRef, type CSSProperties, type RefObject } from 'react';
import { NOTE_COLORS, NOTE_COLOR_ORDER } from './colors';
import { NOTE_SIZE, type NoteColor, type NoteItem } from './types';
import { useDrag } from './use-drag';
import { usePresence } from './use-presence';

interface NoteCardProps {
  item: NoteItem;
  boundsRef: RefObject<HTMLElement | null>;
  autoFocus: boolean;
  onText: (id: string, text: string) => void;
  onColor: (id: string, color: NoteColor) => void;
  onMove: (id: string, x: number, y: number) => void;
  onRaise: (id: string) => void;
  onRemove: (id: string) => void;
}

const FOLD = 20;

export const NoteCard = memo(function NoteCard({
  item,
  boundsRef,
  autoFocus,
  onText,
  onColor,
  onMove,
  onRaise,
  onRemove,
}: NoteCardProps) {
  const palette = NOTE_COLORS[item.color] ?? NOTE_COLORS.butter;
  const textRef = useRef<HTMLTextAreaElement>(null);

  const { leave, stateClass } = usePresence(() => onRemove(item.id));
  const { dragging, dragProps, onHandleKeyDown } = useDrag({
    x: item.x,
    y: item.y,
    width: NOTE_SIZE,
    height: NOTE_SIZE,
    boundsRef,
    onMove: (x, y) => onMove(item.id, x, y),
  });

  useEffect(() => {
    if (autoFocus) textRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  return (
    <div
      className={`sticky-note-card ${dragging ? 'is-dragging' : ''} ${stateClass}`}
      style={{
        width: NOTE_SIZE,
        height: NOTE_SIZE,
        zIndex: item.z,
        transform: `translate3d(${item.x}px, ${item.y}px, 0)`,
      }}
      onPointerDownCapture={() => onRaise(item.id)}
      {...dragProps}
    >
      <div
        className="sticky-note-inner"
        style={{ '--r': `${item.rotate}deg` } as CSSProperties}
      >
        <div
          className="sticky-note-paper"
          style={{
            background: palette.gradient,
            color: palette.text,
          }}
        >
          {/* Header with drag handle and actions */}
          <div className="sticky-note-header">
            <button
              type="button"
              aria-label="Move note. Use arrow keys."
              onKeyDown={onHandleKeyDown}
              className="sticky-note-handle"
            >
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className="sticky-note-dot" />
              ))}
            </button>

            <div data-no-drag className="sticky-note-actions">
              {NOTE_COLOR_ORDER.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Change color to ${NOTE_COLORS[color].label}`}
                  aria-pressed={color === item.color}
                  title={NOTE_COLORS[color].label}
                  onClick={() => onColor(item.id, color)}
                  className={`sticky-note-color-btn ${color === item.color ? 'is-selected' : ''}`}
                  style={{ background: NOTE_COLORS[color].color }}
                />
              ))}
              <button
                type="button"
                aria-label="Delete note"
                title="Delete note"
                onClick={leave}
                className="sticky-note-delete-btn"
              >
                <svg viewBox="0 0 12 12" className="sticky-note-x-icon" aria-hidden="true">
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
          </div>

          {/* Textarea */}
          <div className="sticky-note-content">
            <textarea
              ref={textRef}
              data-no-drag
              value={item.text}
              maxLength={600}
              placeholder="Write a note…"
              aria-label="Note text"
              onChange={(event) => onText(item.id, event.target.value)}
              onFocus={() => onRaise(item.id)}
              className="sticky-note-textarea"
            />
          </div>

          {/* Folded corner */}
          <span
            aria-hidden="true"
            style={{ width: FOLD, height: FOLD }}
            className="sticky-note-fold"
          />
        </div>

        {/* Tape at top */}
        <span aria-hidden="true" className="sticky-note-tape" />
      </div>
    </div>
  );
});
