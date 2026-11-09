import { memo, useEffect, useRef, type RefObject } from 'react';
import { NOTE_COLORS, NOTE_COLOR_ORDER } from './colors';
import { type NoteColor, type NoteItem } from './types';
import { usePresence } from './use-presence';

export interface NoteCardProps {
  item: NoteItem;
  index?: number;
  boundsRef?: RefObject<HTMLElement | null>;
  autoFocus?: boolean;
  onText: (id: string, text: string) => void;
  onColor: (id: string, color: NoteColor) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onRaise: (id: string) => void;
  onRemove: (id: string) => void;
}

export const NoteCard = memo(function NoteCard({
  item,
  index = 1,
  autoFocus = false,
  onText,
  onColor,
  onRaise,
  onRemove,
}: NoteCardProps) {
  const palette = NOTE_COLORS[item.color] ?? NOTE_COLORS.butter;
  const textRef = useRef<HTMLTextAreaElement>(null);
  const { leave, stateClass } = usePresence(() => onRemove(item.id));

  useEffect(() => {
    if (autoFocus) {
      textRef.current?.focus({ preventScroll: true });
    }
  }, [autoFocus]);

  return (
    <div
      className={`sticky-note-card ${stateClass}`}
      style={{
        background: palette.gradient,
        color: palette.text,
      }}
      onPointerDownCapture={() => onRaise(item.id)}
    >
      {/* Header with note index, color palette swatches, and delete action */}
      <div className="sticky-note-header">
        <span className="sticky-note-index">Note #{index}</span>

        <div className="sticky-note-actions">
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

      {/* Note body with scrollable auto-fitting textarea */}
      <div className="sticky-note-content">
        <textarea
          ref={textRef}
          value={item.text}
          onChange={(e) => onText(item.id, e.target.value)}
          placeholder="Capture a finding or working note…"
          className="sticky-note-textarea"
        />
      </div>
    </div>
  );
});
