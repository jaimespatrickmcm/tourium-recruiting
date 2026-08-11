import { Outlet } from 'react-router-dom';
import { ModalProvider, useModal } from '@/contexts/modal-context';
import { BottomNav } from '@/components/bottom-nav';
import { EmpresaModal } from '@/components/modals/empresa-modal';
import { DnaModal } from '@/components/modals/dna-modal';
import { JobNewModal } from '@/components/modals/job-new-modal';

export function AppLayout() {
  return (
    <ModalProvider>
      <div className="min-h-screen bg-white">
        <main className="pb-32">
          <Outlet />
        </main>
        <BottomNav />
        <Modals />
      </div>
    </ModalProvider>
  );
}

function Modals() {
  const { modal, closeModal } = useModal();
  return (
    <>
      <EmpresaModal open={modal === 'empresa'} onClose={closeModal} />
      <DnaModal open={modal === 'dna'} onClose={closeModal} />
      <JobNewModal open={modal === 'job-new'} onClose={closeModal} />
    </>
  );
}

export default AppLayout;
