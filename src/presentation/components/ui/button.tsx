import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';
import { Spinner } from './spinner.js';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-300',
  secondary:
    'bg-surface text-neutral-800 border border-neutral-300 hover:bg-neutral-50 disabled:text-neutral-400',
  danger: 'bg-danger-600 text-white hover:bg-danger-700 disabled:bg-danger-300',
  ghost: 'bg-transparent text-neutral-700 hover:bg-neutral-100 disabled:text-neutral-400',
};

export function buttonClassName(variant: ButtonVariant = 'primary', className?: string): string {
  return cn(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors',
    // Achado real de revisão (Etapa 2 — hardening adicional): este componente
    // é usado por praticamente todo botão do app; `outline-none` sem um
    // substituto deixava QUALQUER botão sem nenhum indicador visível de foco
    // pelo teclado (só o mouse "via" o hover). Corrigido com o mesmo anel
    // já usado em input/checkbox/tabs/theme-toggle.
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed',
    VARIANT_CLASSES[variant],
    className,
  );
}

/** Alvo de toque confortável (altura mínima 44px) — mesmo padrão do teste2. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading = false, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClassName(variant, className)}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
});
