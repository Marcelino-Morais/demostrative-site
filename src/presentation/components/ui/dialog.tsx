import * as RadixDialog from '@radix-ui/react-dialog';
import { cn } from '../../lib/cn.js';

export const Dialog = RadixDialog.Root;
export const DialogClose = RadixDialog.Close;
export const DialogTitle = RadixDialog.Title;
export const DialogDescription = RadixDialog.Description;

export function DialogContent({ className, children, ...props }: RadixDialog.DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
      <RadixDialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
          'max-h-[85vh] overflow-y-auto rounded-lg bg-surface p-6 shadow-lg focus-visible:outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
