import type { NoteColor } from './types';

export interface NotePalette {
  label: string;
  color: string;
  gradient: string;
  text: string;
}

export const NOTE_COLORS: Record<NoteColor, NotePalette> = {
  butter: {
    label: 'Butter',
    color: '#FFDF4F',
    gradient: 'linear-gradient(180deg, #FFF08A 0%, #FFDF4F 100%)',
    text: '#292524',
  },
  blush: {
    label: 'Blush',
    color: '#FFA9C0',
    gradient: 'linear-gradient(180deg, #FFD3DE 0%, #FFA9C0 100%)',
    text: '#292524',
  },
  mint: {
    label: 'Mint',
    color: '#92E5B8',
    gradient: 'linear-gradient(180deg, #CFF7E0 0%, #92E5B8 100%)',
    text: '#292524',
  },
  sky: {
    label: 'Sky',
    color: '#8FCCFF',
    gradient: 'linear-gradient(180deg, #CDE9FF 0%, #8FCCFF 100%)',
    text: '#292524',
  },
  lilac: {
    label: 'Lilac',
    color: '#C0A6FF',
    gradient: 'linear-gradient(180deg, #E6D8FF 0%, #C0A6FF 100%)',
    text: '#292524',
  },
  peach: {
    label: 'Peach',
    color: '#FFB87D',
    gradient: 'linear-gradient(180deg, #FFE0C4 0%, #FFB87D 100%)',
    text: '#292524',
  },
};

export const NOTE_COLOR_ORDER = Object.keys(NOTE_COLORS) as NoteColor[];

export const STICKERS = [
  { emoji: '⭐', name: 'star' },
  { emoji: '🔥', name: 'fire' },
  { emoji: '💡', name: 'idea' },
  { emoji: '✅', name: 'check' },
  { emoji: '❤️', name: 'heart' },
  { emoji: '📌', name: 'pin' },
  { emoji: '🎯', name: 'target' },
  { emoji: '🌈', name: 'rainbow' },
] as const;
