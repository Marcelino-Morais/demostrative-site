import { useId, type ReactElement, type ReactNode, cloneElement, isValidElement } from 'react';
import { cn } from '../../lib/cn.js';

export interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** Associa label/erro/dica ao input via id/aria-describedby/aria-invalid automaticamente. */
export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  const generatedId = useId();
  const fieldId = htmlFor ?? generatedId;
  const errorId = error ? `${fieldId}-error` : undefined;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  const child =
    isValidElement(children) && !htmlFor
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          id: fieldId,
          'aria-describedby': describedBy,
          'aria-invalid': Boolean(error) || undefined,
        })
      : children;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={fieldId} className="text-sm font-medium text-neutral-800">
        {label}
        {required && (
          <span aria-hidden="true" className="text-danger-600">
            {' '}
            *
          </span>
        )}
      </label>
      {child}
      {hint && !error && (
        <p id={hintId} className="text-xs text-neutral-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger-700 dark:text-danger-500">
          {error}
        </p>
      )}
    </div>
  );
}
