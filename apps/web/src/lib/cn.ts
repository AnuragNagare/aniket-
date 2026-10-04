import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Joins class names and lets later Tailwind utilities override earlier ones. */
export const cn = (...values: ClassValue[]) => twMerge(clsx(values));
