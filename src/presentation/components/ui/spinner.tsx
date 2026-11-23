import { cn } from '../../lib/cn.js';

export interface SpinnerProps {
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}

export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  const dimensao = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6';
  return (
    <div className={cn('flex items-center gap-2 text-neutral-500', className)}>
      <svg
        className={cn('animate-spin', dimensao)}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
        />
      </svg>
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
