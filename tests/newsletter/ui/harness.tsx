// Dev-only harness for the newsletter screenshot checks (tests/newsletter/ui/check.mjs). Not part of the app
// build: Vite builds index.html only. It mounts the real components with the providers App gives them.
import { useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import '../../../styles/globals.css';
import { AuthProvider } from '../../../contexts/AuthContext';
import { PropertyProvider } from '../../../contexts/PropertyContext';
import CreateMemory from '../../../components/CreateMemory';

const params = new URLSearchParams(window.location.search);

function ComposerHarness() {
  const [open, setOpen] = useState(true);
  const id = params.get('newsletterId');
  return (
    <div className="p-6">
      <button type="button" onClick={() => setOpen(true)}>Open Create Campaign</button>
      <CreateMemory open={open} onOpenChange={setOpen} newsletterId={id ? Number(id) : null} defaultCategory={params.get('category') || undefined}
        onNewsletterChanged={() => console.log('newsletter changed')} />
    </div>
  );
}

const VIEWS: Record<string, () => ReactElement> = {
  composer: ComposerHarness,
};
const View = VIEWS[params.get('view') || 'composer'] ?? ComposerHarness;

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <PropertyProvider>
      <View />
      <Toaster position="top-right" richColors />
    </PropertyProvider>
  </AuthProvider>,
);
