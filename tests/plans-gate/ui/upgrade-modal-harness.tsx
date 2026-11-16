// Dev-only harness for tests/plans-gate/ui/upgrade-modal.mjs (Chris, 16 Nov, C11). Not part of the app build.
// Mounts the real UpgradePlanModal as BillingPage / ProfileSettingsPage / MemoriesPage / App do.
// ?plan=<currentPlan>&canClose=0|1&hideStarter=1
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import '../../../styles/globals.css';
import UpgradePlanModal from '../../../components/UpgradePlanModal';

const params = new URLSearchParams(window.location.search);

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <p id="closed">{open ? 'open' : 'closed'}</p>
      <button type="button" onClick={() => setOpen(true)}>Open picker</button>
      <UpgradePlanModal
        isOpen={open}
        onClose={() => setOpen(false)}
        currentPlan={params.get('plan') ?? 'Starter'}
        canClose={params.get('canClose') !== '0'}
        hideStarter={params.get('hideStarter') === '1'}
        exitActions={params.get('canClose') === '0' ? <button type="button">Sign out</button> : undefined}
      />
      <Toaster />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
