import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-2xl border border-neutral-200 bg-surface p-5 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.16)]', className)}
      {...props}
    />
  );
}
