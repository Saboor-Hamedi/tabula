import { useCallback, useEffect, useState } from 'react';
import { createNote, useBoard } from './board-state';
import { NOTE_COLORS, NOTE_COLOR_ORDER } from './colors';
import { NoteCard } from './NoteCard';
import { Toolbar } from './Toolbar';
import { type BoardItem, type NoteColor, type NoteItem } from './types';

export interface StickyBoardProps {
  /** localStorage key. Use a different key for each board. */
  storageKey?: string;
  /** Shown the first time, before anything has been saved. */
  initialItems?: readonly BoardItem[];
  className?: string;
}

export function StickyBoard({
  storageKey = 'tabula-sticky-notes:v1',
  initialItems,
  className = '',
}: StickyBoardProps) {
  const board = useBoard(storageKey, initialItems);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const { add } = board;

  const addNote = useCallback(
    (color: NoteColor) => {
      const note = createNote({ color, text: '' });
      add(note);
      setLastAddedId(note.id);
    },
    [add],
  );

  const noteItems = board.items.filter((item): item is NoteItem => item.kind === 'note');
  const expandedNote = noteItems.find((n) => n.id === expandedNoteId);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expandedNoteId) {
        setExpandedNoteId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedNoteId]);

  return (
    <section className={`sticky-board-root ${className}`}>
      <Toolbar
        count={noteItems.length}
        onAddNote={addNote}
        onClear={board.clear}
      />

      <div
        role="region"
        aria-label="Studio notes"
        className="sticky-board-canvas sticky-notes-3col"
      >
        {noteItems.length === 0 ? (
          <div className="sticky-board-empty">
            <div className="sticky-board-empty-icon" aria-hidden>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <p className="sticky-board-empty-title">Studio Notes</p>
            <p className="sticky-board-empty-subtitle">
              Capture findings, thoughts, and takeaways alongside your data. Notes arrange in a clean 3-column board.
            </p>
          </div>
        ) : (
          noteItems.map((item) => (
            <NoteCard
              key={item.id}
              item={item}
              autoFocus={item.id === lastAddedId}
              onText={board.setText}
              onColor={board.setColor}
              onRaise={board.raise}
              onRemove={board.remove}
              onExpand={(id) => setExpandedNoteId(id)}
            />
          ))
        )}
      </div>

      {/* Bigger Note Modal */}
      {expandedNote && (
        <div
          className="note-modal-backdrop"
          onClick={() => setExpandedNoteId(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="note-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: NOTE_COLORS[expandedNote.color]?.gradient || NOTE_COLORS.butter.gradient,
              color: NOTE_COLORS[expandedNote.color]?.text || NOTE_COLORS.butter.text,
            }}
          >
            <div className="note-modal-header">
              <div className="note-modal-title-group">
                <span className="note-modal-wordcount">
                  {expandedNote.text.trim().split(/\s+/).filter(Boolean).length} words · {expandedNote.text.length} chars
                </span>
              </div>

              <div className="note-modal-actions">
                <div className="note-modal-colors">
                  {NOTE_COLOR_ORDER.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Change color to ${NOTE_COLORS[color].label}`}
                      aria-pressed={color === expandedNote.color}
                      title={NOTE_COLORS[color].label}
                      onClick={() => board.setColor(expandedNote.id, color)}
                      className={`sticky-note-color-btn ${color === expandedNote.color ? 'is-selected' : ''}`}
                      style={{ background: NOTE_COLORS[color].color }}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  className="note-modal-close-btn"
                  onClick={() => setExpandedNoteId(null)}
                  title="Close note (Esc)"
                  aria-label="Close note"
                >
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <line x1="3" y1="3" x2="13" y2="13" />
                    <line x1="13" y1="3" x2="3" y2="13" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="note-modal-body">
              <textarea
                autoFocus
                value={expandedNote.text}
                onChange={(e) => board.setText(expandedNote.id, e.target.value)}
                placeholder="Capture a detailed finding or working note…"
                className="note-modal-textarea"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
