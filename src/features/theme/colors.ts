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
    color: '#FDE047',
    gradient: 'linear-gradient(180deg, #FEF08A 0%, #FDE047 100%)',
    text: '#1C1917',
  },
  mint: {
    label: 'Mint',
    color: '#6EE7B7',
    gradient: 'linear-gradient(180deg, #A7F3D0 0%, #6EE7B7 100%)',
    text: '#1C1917',
  },
  sky: {
    label: 'Sky',
    color: '#7DD3FC',
    gradient: 'linear-gradient(180deg, #BAE6FD 0%, #7DD3FC 100%)',
    text: '#1C1917',
  },
  blush: {
    label: 'Rose',
    color: '#FDA4AF',
    gradient: 'linear-gradient(180deg, #FECDD3 0%, #FDA4AF 100%)',
    text: '#1C1917',
  },
  lilac: {
    label: 'Lilac',
    color: '#C0A6FF',
    gradient: 'linear-gradient(180deg, #E6D8FF 0%, #C0A6FF 100%)',
    text: '#1C1917',
  },
  peach: {
    label: 'Peach',
    color: '#FFB87D',
    gradient: 'linear-gradient(180deg, #FFE0C4 0%, #FFB87D 100%)',
    text: '#1C1917',
  },
};

/** The 4 primary curated colors for sticky notes */
export const NOTE_COLOR_ORDER: NoteColor[] = ['butter', 'mint', 'sky', 'blush'];

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
