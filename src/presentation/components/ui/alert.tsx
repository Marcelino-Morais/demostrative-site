import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

export type AlertTone = 'danger' | 'warning' | 'success' | 'brand';

const TONE_CLASSES: Record<AlertTone, string> = {
  danger:
    'border-danger-200 bg-danger-50 text-danger-800 dark:border-danger-800 dark:bg-danger-900/40 dark:text-danger-300',
  warning:
    'border-warning-100 bg-warning-50 text-warning-700 dark:border-warning-800 dark:bg-warning-900/40 dark:text-warning-300',
  success:
    'border-success-100 bg-success-50 text-success-700 dark:border-success-800 dark:bg-success-900/40 dark:text-success-300',
  brand:
    'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-900/40 dark:text-brand-300',
};

export interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Alert({ tone = 'danger', title, children, className }: AlertProps) {
  return (
    <div role="alert" className={cn('rounded-md border px-4 py-3 text-sm', TONE_CLASSES[tone], className)}>
      {title && <p className="font-medium">{title}</p>}
      <div>{children}</div>
    </div>
  );
}
