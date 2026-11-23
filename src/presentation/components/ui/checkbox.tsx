import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
}

export function Checkbox({ label, className, id, ...props }: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-2 text-sm text-neutral-700',
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 shrink-0 rounded border-neutral-300 text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        {...props}
      />
      {label}
    </label>
  );
}
