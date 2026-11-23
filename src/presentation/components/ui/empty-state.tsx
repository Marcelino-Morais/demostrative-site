import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-10 text-center',
        className,
      )}
    >
      <p className="text-sm font-medium text-neutral-700">{title}</p>
      {description && <p className="max-w-sm text-sm text-neutral-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
