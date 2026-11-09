export type NoteColor = 'butter' | 'blush' | 'mint' | 'sky' | 'lilac' | 'peach';

interface BaseItem {
  id: string;
  /** Position inside the board, in px */
  x: number;
  y: number;
  /** Resting tilt in degrees */
  rotate: number;
  /** Stacking order; the last item touched has the highest z */
  z: number;
}

export interface NoteItem extends BaseItem {
  kind: 'note';
  color: NoteColor;
  text: string;
}

export interface StickerItem extends BaseItem {
  kind: 'sticker';
  emoji: string;
}

export type BoardItem = NoteItem | StickerItem;

export const NOTE_SIZE = 190;
export const STICKER_SIZE = 56;

export const sizeOf = (item: BoardItem): number =>
  item.kind === 'note' ? NOTE_SIZE : STICKER_SIZE;
