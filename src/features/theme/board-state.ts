import { useEffect, useMemo, useReducer, useRef } from 'react';
import { NOTE_COLORS } from './colors';
import { clampPoint, type Size } from './geometry';
import {
  sizeOf,
  type BoardItem,
  type NoteColor,
  type NoteItem,
  type StickerItem,
} from './types';

/* ------------------------------------------------------------------ */
/* Factories                                                           */
/* ------------------------------------------------------------------ */

const createId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

const randomTilt = (): number => Math.round((Math.random() * 7 - 3.5) * 10) / 10;

export function createNote(overrides: Partial<Omit<NoteItem, 'kind' | 'id'>> = {}): NoteItem {
  return {
    id: createId(),
    kind: 'note',
    x: 0,
    y: 0,
    z: 0,
    rotate: randomTilt(),
    color: 'butter',
    text: '',
    ...overrides,
  };
}

export function createSticker(
  emoji: string,
  overrides: Partial<Omit<StickerItem, 'kind' | 'id' | 'emoji'>> = {},
): StickerItem {
  return {
    id: createId(),
    kind: 'sticker',
    emoji,
    x: 0,
    y: 0,
    z: 0,
    rotate: Math.round((Math.random() * 30 - 15) * 10) / 10,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

interface BoardState {
  items: BoardItem[];
  topZ: number;
}

type Action =
  | { type: 'add'; item: BoardItem }
  | { type: 'text'; id: string; text: string }
  | { type: 'color'; id: string; color: NoteColor }
  | { type: 'move'; id: string; x: number; y: number }
  | { type: 'raise'; id: string }
  | { type: 'remove'; id: string }
  | { type: 'clear' }
  | { type: 'fit'; size: Size };

function patch(
  state: BoardState,
  id: string,
  update: (item: BoardItem) => BoardItem,
): BoardState {
  let changed = false;
  const items = state.items.map((item) => {
    if (item.id !== id) return item;
    const next = update(item);
    if (next !== item) changed = true;
    return next;
  });
  return changed ? { ...state, items } : state;
}

function reducer(state: BoardState, action: Action): BoardState {
  switch (action.type) {
    case 'add': {
      const z = state.topZ + 1;
      return { items: [...state.items, { ...action.item, z }], topZ: z };
    }
    case 'text':
      return patch(state, action.id, (item) =>
        item.kind === 'note' && item.text !== action.text ? { ...item, text: action.text } : item,
      );
    case 'color':
      return patch(state, action.id, (item) =>
        item.kind === 'note' && item.color !== action.color
          ? { ...item, color: action.color }
          : item,
      );
    case 'move':
      return patch(state, action.id, (item) =>
        item.x === action.x && item.y === action.y ? item : { ...item, x: action.x, y: action.y },
      );
    case 'raise': {
      const target = state.items.find((item) => item.id === action.id);
      if (!target || target.z === state.topZ) return state;
      const z = state.topZ + 1;
      return {
        items: state.items.map((item) => (item.id === action.id ? { ...item, z } : item)),
        topZ: z,
      };
    }
    case 'remove':
      return state.items.some((item) => item.id === action.id)
        ? { ...state, items: state.items.filter((item) => item.id !== action.id) }
        : state;
    case 'clear':
      return state.items.length ? { items: [], topZ: 0 } : state;
    case 'fit': {
      let changed = false;
      const items = state.items.map((item) => {
        const s = sizeOf(item);
        const p = clampPoint(action.size, item.x, item.y, s, s);
        if (p.x === item.x && p.y === item.y) return item;
        changed = true;
        return { ...item, x: p.x, y: p.y };
      });
      return changed ? { ...state, items } : state;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function isBoardItem(value: unknown): value is BoardItem {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  if (!(typeof o.id === 'string' && isNum(o.x) && isNum(o.y) && isNum(o.rotate) && isNum(o.z))) {
    return false;
  }
  if (o.kind === 'note') {
    return typeof o.text === 'string' && typeof o.color === 'string' && o.color in NOTE_COLORS;
  }
  return o.kind === 'sticker' && typeof o.emoji === 'string';
}

function loadItems(key: string): BoardItem[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isBoardItem) : null;
  } catch {
    return null;
  }
}

function saveItems(key: string, items: BoardItem[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* storage full or unavailable */
  }
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useBoard(storageKey: string, initialItems: readonly BoardItem[] = []) {
  const [state, dispatch] = useReducer(reducer, undefined, (): BoardState => {
    const items = loadItems(storageKey) ?? [...initialItems];
    return { items, topZ: items.reduce((max, item) => Math.max(max, item.z), 0) };
  });

  // Save shortly after changes settle, and once more when the page is hidden.
  const latest = useRef(state.items);
  latest.current = state.items;

  useEffect(() => {
    const id = window.setTimeout(() => saveItems(storageKey, state.items), 250);
    return () => window.clearTimeout(id);
  }, [storageKey, state.items]);

  useEffect(() => {
    const flush = () => saveItems(storageKey, latest.current);
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [storageKey]);

  const actions = useMemo(
    () => ({
      add: (item: BoardItem) => dispatch({ type: 'add', item }),
      setText: (id: string, text: string) => dispatch({ type: 'text', id, text }),
      setColor: (id: string, color: NoteColor) => dispatch({ type: 'color', id, color }),
      move: (id: string, x: number, y: number) => dispatch({ type: 'move', id, x, y }),
      raise: (id: string) => dispatch({ type: 'raise', id }),
      remove: (id: string) => dispatch({ type: 'remove', id }),
      clear: () => dispatch({ type: 'clear' }),
      fit: (size: Size) => dispatch({ type: 'fit', size }),
    }),
    [],
  );

  return { items: state.items, ...actions };
}
