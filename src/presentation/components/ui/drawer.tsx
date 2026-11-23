import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn.js';

export const Drawer = RadixDialog.Root;
export const DrawerClose = RadixDialog.Close;
export const DrawerTitle = RadixDialog.Title;
export const DrawerDescription = RadixDialog.Description;

/**
 * Painel lateral (pedido do usuário: "tooltip, painel lateral ou
 * drawer" para o detalhe do dente, em vez de poluir o gráfico). Mesma
 * base Radix Dialog do `Dialog` centralizado, só a posição/animação de
 * entrada muda — o comportamento de foco/Escape/overlay é idêntico.
 */
export function DrawerContent({
  className,
  children,
  title,
  ...props
}: RadixDialog.DialogContentProps & { title: string }) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
      <RadixDialog.Content
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-[min(26rem,100vw)] flex-col',
          'bg-surface shadow-lg focus-visible:outline-none',
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <RadixDialog.Title className="text-base font-semibold text-neutral-900">{title}</RadixDialog.Title>
          <RadixDialog.Close className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Fechar</span>
          </RadixDialog.Close>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
