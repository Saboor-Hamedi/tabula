import { memo, useEffect, useState } from 'react';
import { NOTE_COLORS, NOTE_COLOR_ORDER, STICKERS } from './colors';
import type { NoteColor } from './types';

interface ToolbarProps {
  count: number;
  onAddNote: (color: NoteColor) => void;
  onAddSticker: (emoji: string) => void;
  onClear: () => void;
}

export const Toolbar = memo(function Toolbar({
  count,
  onAddNote,
  onAddSticker,
  onClear,
}: ToolbarProps) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const id = window.setTimeout(() => setConfirming(false), 3000);
    return () => window.clearTimeout(id);
  }, [confirming]);

  useEffect(() => {
    if (count === 0) setConfirming(false);
  }, [count]);

  return (
    <div className="sticky-toolbar">
      <div className="sticky-toolbar-group" role="group" aria-label="Add a note">
        <span className="sticky-toolbar-label">Note</span>
        <div className="sticky-toolbar-swatches">
          {NOTE_COLOR_ORDER.map((color) => (
            <button
              key={color}
              type="button"
              title={`${NOTE_COLORS[color].label} note`}
              aria-label={`Add a ${NOTE_COLORS[color].label.toLowerCase()} note`}
              onClick={() => onAddNote(color)}
              className="sticky-swatch-btn"
              style={{ background: NOTE_COLORS[color].gradient }}
            />
          ))}
        </div>
      </div>

      <div className="sticky-toolbar-group" role="group" aria-label="Add a sticker">
        <span className="sticky-toolbar-label">Sticker</span>
        <div className="sticky-toolbar-stickers">
          {STICKERS.map(({ emoji, name }) => (
            <button
              key={emoji}
              type="button"
              title={`Add a ${name} sticker`}
              aria-label={`Add a ${name} sticker`}
              onClick={() => onAddSticker(emoji)}
              className="sticky-sticker-btn"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="sticky-toolbar-actions">
        <span className="sticky-toolbar-count">
          {count} {count === 1 ? 'item' : 'items'}
        </span>
        <button
          type="button"
          disabled={count === 0}
          onClick={() => {
            if (confirming) {
              setConfirming(false);
              onClear();
            } else {
              setConfirming(true);
            }
          }}
          className={`sticky-clear-btn ${confirming ? 'is-confirming' : ''}`}
        >
          {confirming ? 'Confirm clear' : 'Clear'}
        </button>
      </div>
    </div>
  );
});
