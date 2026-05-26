import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import PricingContent from '@/components/pricing/PricingContent';

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#0B0E14]">
          <Loader2 size={22} className="animate-spin text-[#8762F7]/60" />
        </div>
      }
    >
      <PricingContent />
    </Suspense>
  );
}
