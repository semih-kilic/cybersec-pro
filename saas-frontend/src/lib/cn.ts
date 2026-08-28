/**
 * cn() — class name utility
 *
 * Combines clsx() (conditional joins) with tailwind-merge (dedupes / resolves
 * conflicting Tailwind utilities so the *last* class wins, e.g.
 *   cn('px-2', cond && 'px-4')  →  'px-4'
 * ).
 *
 * Use this in every component to compose className props cleanly.
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
