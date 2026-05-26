'use client';

import { DenBotProvider } from '@/context/DenBotContext';
import DenBot from '@/components/DenBot';

export default function DenBotWidget() {
  return (
    <DenBotProvider>
      <DenBot />
    </DenBotProvider>
  );
}
