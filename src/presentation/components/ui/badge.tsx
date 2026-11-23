import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'brand' | 'info' | 'tooth';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-100 text-neutral-700',
  success: 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300',
  warning: 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300',
  danger: 'bg-danger-100 text-danger-700 dark:bg-danger-900/40 dark:text-danger-300',
  brand: 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300',
  info: 'bg-info-100 text-info-700 dark:bg-info-900/40 dark:text-info-300',
  tooth: 'bg-tooth-100 text-tooth-700 dark:bg-tooth-900/40 dark:text-tooth-300',
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

/** O texto sempre carrega o significado — a cor é reforço, nunca a única pista de status. */
export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
