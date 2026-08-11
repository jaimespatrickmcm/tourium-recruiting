import { createContext, useContext, useState, type ReactNode } from 'react';

export type ModalKey = 'empresa' | 'dna' | 'job-new' | null;

type ModalContextValue = {
  modal: ModalKey;
  openModal: (key: Exclude<ModalKey, null>) => void;
  closeModal: () => void;
};

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalKey>(null);

  return (
    <ModalContext.Provider
      value={{
        modal,
        openModal: (key) => setModal(key),
        closeModal: () => setModal(null),
      }}
    >
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
}
