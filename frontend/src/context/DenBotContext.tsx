'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface DenBotCtx {
  isOpen: boolean;
  open:   () => void;
  close:  () => void;
  toggle: () => void;
}

const DenBotContext = createContext<DenBotCtx | null>(null);

export function DenBotProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <DenBotContext.Provider value={{
      isOpen,
      open:   () => setIsOpen(true),
      close:  () => setIsOpen(false),
      toggle: () => setIsOpen(o => !o),
    }}>
      {children}
    </DenBotContext.Provider>
  );
}

export function useDenBot() {
  const ctx = useContext(DenBotContext);
  if (!ctx) throw new Error('useDenBot must be used inside DenBotProvider');
  return ctx;
}
