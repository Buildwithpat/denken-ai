import { Suspense } from 'react';
import AttemptContent from '@/components/attempt/AttemptContent';

export default function AttemptPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0f1117]">
          <span className="text-white/40 text-sm">Loading...</span>
        </div>
      }
    >
      <AttemptContent />
    </Suspense>
  );
}
