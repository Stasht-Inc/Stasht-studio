// Dev-only harness for tests/plans-gate/ui/upgrade-modal.mjs (Chris, 16 Nov, C11). Not part of the app build.
// Mounts the real UpgradePlanModal as BillingPage / ProfileSettingsPage / MemoriesPage / App do.
// ?plan=<currentPlan>&canClose=0|1&hideStarter=1&shell=billing
// shell=billing: the modal opened from inside a page, with App.tsx's phone bottom bar (nav.phone-bottom-bar-pin, z-50)
// after it in the DOM, as on Billing (Chris 16 Nov final E2E: the bar covered Upgrade / Cancel at 390).
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import '../../../styles/globals.css';
import UpgradePlanModal from '../../../components/UpgradePlanModal';

const params = new URLSearchParams(window.location.search);

function Harness() {
  const [open, setOpen] = useState(true);
  const modal = (
    <UpgradePlanModal
      isOpen={open}
      onClose={() => setOpen(false)}
      currentPlan={params.get('plan') ?? 'Starter'}
      canClose={params.get('canClose') !== '0'}
      hideStarter={params.get('hideStarter') === '1'}
      exitActions={params.get('canClose') === '0' ? <button type="button">Sign out</button> : undefined}
    />
  );
  if (params.get('shell') === 'billing') {
    return (
      <>
        <main className="relative min-h-screen pb-20">
          <h1>Billing &amp; Payment</h1>
          <p id="closed">{open ? 'open' : 'closed'}</p>
          {modal}
        </main>
        {/* App.tsx's phone bottom bar, same classes */}
        <nav data-testid="phone-bar" className="phone-bottom-bar-pin md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-50 pb-[env(safe-area-inset-bottom)] overflow-visible">
          <div className="flex h-16 items-center justify-around"><button type="button">Home</button><button type="button">Campaigns</button><button type="button">Leads</button></div>
        </nav>
        <Toaster />
      </>
    );
  }
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
