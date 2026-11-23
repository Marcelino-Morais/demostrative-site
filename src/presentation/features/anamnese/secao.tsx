import type { ReactNode } from 'react';
import { Card } from '../../components/ui/card.js';

export function SecaoAnamnese({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-neutral-700">{titulo}</h2>
      {children}
    </Card>
  );
}
