import { UPDATE_MAX } from '@worktrail/types';

/** Adds dictated words to what's already typed, tidily, without passing the length limit. */
export function appendDictated(current: string, spoken: string, max = UPDATE_MAX): { text: string; truncated: boolean } {
  const words = spoken.trim();
  if (!words) return { text: current, truncated: false };
  const base = current.replace(/\s+$/, '');
  const startsSentence = base === '' || /[.!?।]$/.test(base);
  const piece = startsSentence ? words.charAt(0).toUpperCase() + words.slice(1) : words;
  const joined = base ? `${base} ${piece}` : piece;
  return joined.length > max ? { text: joined.slice(0, max), truncated: true } : { text: joined, truncated: false };
}

export const countLabel = (text: string) => `${text.trim().length} / ${UPDATE_MAX}`;
