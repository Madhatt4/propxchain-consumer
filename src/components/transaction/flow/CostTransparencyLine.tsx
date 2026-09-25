import type { ReactNode } from 'react';
import { PoundSterling } from 'lucide-react';

interface CostTransparencyLineProps {
  costPence: number;
  label?: string;
}

export function CostTransparencyLine({ costPence, label }: CostTransparencyLineProps): ReactNode {
  const formatted = `£${(costPence / 100).toFixed(2)}`;
  const displayLabel = label ?? 'zero PropXchain markup';

  return (
    <div className="bg-green-50 dark:bg-green-900/20 rounded-md px-4 py-2 text-center">
      <p className="flex items-center justify-center gap-1.5 text-xs text-green-700 dark:text-green-400">
        <PoundSterling className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {formatted} · {displayLabel}
      </p>
    </div>
  );
}
