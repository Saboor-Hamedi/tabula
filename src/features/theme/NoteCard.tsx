import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { CheckIcon, CopyIcon } from '../common/Icons';
import { countNoteWords, MAX_NOTE_WORDS } from './board-state';
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
  onExpand?: (id: string) => void;
}

export const NoteCard = memo(function NoteCard({
  item,
  autoFocus = false,
  onText,
  onColor,
  onRaise,
  onRemove,
  onExpand,
}: NoteCardProps) {
  const palette = NOTE_COLORS[item.color] ?? NOTE_COLORS.butter;
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const { leave, stateClass } = usePresence(() => onRemove(item.id));

  const wordCount = useMemo(() => countNoteWords(item.text), [item.text]);

  useEffect(() => {
    if (autoFocus) {
      textRef.current?.focus({ preventScroll: true });
    }
  }, [autoFocus]);

  const handleCycleColor = () => {
    const idx = NOTE_COLOR_ORDER.indexOf(item.color);
    const nextColor = NOTE_COLOR_ORDER[(idx + 1) % NOTE_COLOR_ORDER.length];
    onColor(item.id, nextColor);
  };

  const handleCopy = async () => {
    if (!item.text.trim()) return;
    try {
      await navigator.clipboard.writeText(item.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className={`sticky-note-card ${stateClass}`}
      style={{
        background: palette.gradient,
        color: palette.text,
      }}
      onPointerDownCapture={() => onRaise(item.id)}
    >
      {/* Clean Header: live 200-word counter on left, actions on right (no color dots) */}
      <div className="sticky-note-header">
        <button
          type="button"
          className="sticky-note-word-pill"
          onClick={handleCycleColor}
          title={`Tone: ${palette.label} (click to switch tone) · ${wordCount} of ${MAX_NOTE_WORDS} words`}
        >
          {wordCount}/{MAX_NOTE_WORDS}w
        </button>

        <div className="sticky-note-actions">
          <button
            type="button"
            aria-label="Copy note text"
            title="Copy note"
            onClick={handleCopy}
            className="sticky-note-expand-btn"
          >
            {copied ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
          </button>
          {onExpand && (
            <button
              type="button"
              aria-label="Expand note in bigger modal"
              title="Open note in larger view"
              onClick={() => onExpand(item.id)}
              className="sticky-note-expand-btn"
            >
              <svg
                viewBox="0 0 16 16"
                width="11"
                height="11"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="10 2 14 2 14 6" />
                <polyline points="6 14 2 14 2 10" />
                <line x1="14" y1="2" x2="9.5" y2="6.5" />
                <line x1="2" y1="14" x2="6.5" y2="9.5" />
              </svg>
            </button>
          )}
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

      {/* Note body with 200-word capped textarea */}
      <div className="sticky-note-content">
        <textarea
          ref={textRef}
          value={item.text}
          onChange={(e) => onText(item.id, e.target.value)}
          placeholder="Write a note (up to 200 words)…"
          className="sticky-note-textarea"
        />
      </div>
    </div>
  );
});
