import { useCallback, useEffect, useRef, useState } from 'react';
import { createNote, createSticker, useBoard } from './board-state';
import { clampPoint } from './geometry';
import { NoteCard } from './NoteCard';
import { StickerCard } from './StickerCard';
import { Toolbar } from './Toolbar';
import { NOTE_SIZE, STICKER_SIZE, type BoardItem, type NoteColor } from './types';

export interface StickyBoardProps {
  /** localStorage key. Use a different key for each board. */
  storageKey?: string;
  /** Shown the first time, before anything has been saved. */
  initialItems?: readonly BoardItem[];
  className?: string;
}

/** A spot near the middle of the board, nudged so new items don't stack exactly. */
function spawnPoint(board: HTMLElement | null, size: number) {
  const width = board?.clientWidth ?? 360;
  const height = board?.clientHeight ?? 420;
  const jitter = () => (Math.random() - 0.5) * 80;
  return clampPoint(
    { width, height },
    Math.max(12, (width - size) / 2 + jitter()),
    Math.max(12, (height - size) / 2 + jitter()),
    size,
    size,
  );
}

export function StickyBoard({
  storageKey = 'tabula-sticky-notes:v1',
  initialItems,
  className = '',
}: StickyBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const board = useBoard(storageKey, initialItems);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const { add, fit } = board;

  // Keep everything on the board when it gets resized.
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      fit({ width: el.clientWidth, height: el.clientHeight }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit]);

  const addNote = useCallback(
    (color: NoteColor) => {
      const note = createNote({ color, ...spawnPoint(boardRef.current, NOTE_SIZE) });
      add(note);
      setLastAddedId(note.id);
    },
    [add],
  );

  const addSticker = useCallback(
    (emoji: string) => {
      add(createSticker(emoji, spawnPoint(boardRef.current, STICKER_SIZE)));
    },
    [add],
  );

  return (
    <section className={`sticky-board-root ${className}`}>
      <Toolbar
        count={board.items.length}
        onAddNote={addNote}
        onAddSticker={addSticker}
        onClear={board.clear}
      />

      <div
        ref={boardRef}
        role="region"
        aria-label="Sticky note board"
        className="sticky-board-canvas"
      >
        {board.items.length === 0 && (
          <div className="sticky-board-empty">
            <p className="sticky-board-empty-title">Notes & Studio Board</p>
            <p className="sticky-board-empty-subtitle">
              Add sticky notes and stickers to organize findings, questions, and insights alongside your data.
            </p>
          </div>
        )}

        {board.items.map((item) =>
          item.kind === 'note' ? (
            <NoteCard
              key={item.id}
              item={item}
              boundsRef={boardRef}
              autoFocus={item.id === lastAddedId}
              onText={board.setText}
              onColor={board.setColor}
              onMove={board.move}
              onRaise={board.raise}
              onRemove={board.remove}
            />
          ) : (
            <StickerCard
              key={item.id}
              item={item}
              boundsRef={boardRef}
              onMove={board.move}
              onRaise={board.raise}
              onRemove={board.remove}
            />
          ),
        )}
      </div>
    </section>
  );
}
