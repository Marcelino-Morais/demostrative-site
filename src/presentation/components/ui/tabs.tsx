import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from '../../lib/cn.js';

export const Tabs = RadixTabs.Root;

export function TabsList({ className, ...props }: RadixTabs.TabsListProps) {
  return (
    <RadixTabs.List
      className={cn(
        'flex gap-1 overflow-x-auto border-b border-neutral-200',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: RadixTabs.TabsTriggerProps) {
  return (
    <RadixTabs.Trigger
      className={cn(
        'min-h-11 shrink-0 border-b-2 border-transparent px-3 text-sm font-medium text-neutral-600 transition-colors',
        'hover:text-neutral-900 data-[state=active]:border-brand-700 data-[state=active]:text-brand-800',
        'dark:data-[state=active]:text-brand-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: RadixTabs.TabsContentProps) {
  return <RadixTabs.Content className={cn('pt-4', className)} {...props} />;
}
