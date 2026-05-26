import { Suspense } from 'react';
import NotesContent from '@/components/revision/NotesContent';

export default function SmartNotesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="h-8 w-40 animate-pulse rounded bg-white/[0.04]" />
        </div>
      }
    >
      <NotesContent />
    </Suspense>
  );
}
