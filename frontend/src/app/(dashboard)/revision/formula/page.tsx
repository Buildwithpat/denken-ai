import { Suspense } from 'react';
import FormulaRevisionContent from '@/components/revision/FormulaRevisionContent';

export default function FormulaRevisionPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-6 py-6">
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-1/3 rounded bg-white/[0.04]" />
                  <div className="h-3 w-1/4 rounded bg-[#8762F7]/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      }
    >
      <FormulaRevisionContent />
    </Suspense>
  );
}
