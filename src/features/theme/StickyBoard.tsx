import { useCallback, useState } from 'react';
import { createNote, useBoard } from './board-state';
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
          noteItems.map((item, index) => (
            <NoteCard
              key={item.id}
              item={item}
              index={index + 1}
              autoFocus={item.id === lastAddedId}
              onText={board.setText}
              onColor={board.setColor}
              onRaise={board.raise}
              onRemove={board.remove}
            />
          ))
        )}
      </div>
    </section>
  );
}
