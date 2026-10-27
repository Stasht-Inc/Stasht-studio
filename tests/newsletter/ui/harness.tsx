// Dev-only harness for the newsletter screenshot checks (tests/newsletter/ui/check.mjs). Not part of the app
// build: Vite builds index.html only. It mounts the real components with the providers App gives them.
import { useEffect, useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import '../../../styles/globals.css';
import { AuthProvider } from '../../../contexts/AuthContext';
import { PropertyProvider } from '../../../contexts/PropertyContext';
import CreateMemory from '../../../components/CreateMemory';
import TitleBlockEditor from '../../../components/newsletters/blocks/TitleBlockEditor';
import TextBlockEditor from '../../../components/newsletters/blocks/TextBlockEditor';
import ButtonBlockEditor from '../../../components/newsletters/blocks/ButtonBlockEditor';
import DividerBlockEditor from '../../../components/newsletters/blocks/DividerBlockEditor';
import ImageBlockEditor from '../../../components/newsletters/blocks/ImageBlockEditor';
import YoutubeBlockEditor from '../../../components/newsletters/blocks/YoutubeBlockEditor';
import HeaderEditor from '../../../components/newsletters/HeaderEditor';
import EcardFooter from '../../../components/newsletters/EcardFooter';
import { useSenderProfile } from '../../../components/newsletters/hooks/useSenderProfile';
import { newslettersAPI, type NewsletterHeader } from '../../../services/newslettersAPI';
import NewsletterResults from '../../../components/newsletters/NewsletterResults';
import MemoriesPage from '../../../pages/MemoriesPage';

function HeaderGallery() {
  const [header, setHeader] = useState<NewsletterHeader>({ logo_url: null, banner_url: null, background_color: '#6C60FF', title: 'Serpa Chrysler' });
  return (
    <>
      <HeaderEditor header={header} onChange={setHeader} selected onSelect={() => {}} readOnly={false} />
      <pre data-testid="gallery-data" className="mx-6 mt-2 whitespace-pre-wrap break-all rounded bg-gray-50 p-2 text-xs text-gray-500">{JSON.stringify(header)}</pre>
    </>
  );
}

function FooterGallery() {
  const profile = useSenderProfile();
  const [address, setAddress] = useState<string | null>(null);
  return (
    <EcardFooter
      profile={profile}
      fromName="Serpa Chrysler"
      businessAddress={address}
      readOnly={false}
      onSaveAddress={async (value) => {
        const res = await newslettersAPI.updateBrand({ business_address: value });
        if (res.ok) setAddress(value);
        return res.ok;
      }}
    />
  );
}

const params = new URLSearchParams(window.location.search);

function ComposerHarness() {
  const [open, setOpen] = useState(true);
  const id = params.get('newsletterId');
  // ?photos=1: a photo passed in, as Scan Photo does (App → MemoriesPage → CreateMemory initialPhotos).
  const [photos, setPhotos] = useState<File[] | null>(null);
  useEffect(() => {
    if (params.get('photos') !== '1') return;
    void fetch('/pwa-icon-512.png').then((r) => r.blob()).then((b) => setPhotos([new File([b], 'scan.png', { type: 'image/png' })]));
  }, []);
  return (
    <div className="p-6">
      <button type="button" onClick={() => setOpen(true)}>Open Create Campaign</button>
      <CreateMemory open={open} onOpenChange={setOpen} newsletterId={id ? Number(id) : null} defaultCategory={params.get('category') || undefined}
        initialPhotos={photos} onNewsletterChanged={() => console.log('newsletter changed')} />
    </div>
  );
}

// One editor per gallery entry, selected, in the email's 600 px column (40 px side padding, as the email has).
// The <pre> shows what the editor saved.
function Stateful<D>({ initial, children }: { initial: D; children: (data: D, set: (patch: Partial<D>) => void) => ReactElement }) {
  const [data, setData] = useState<D>(initial);
  return (
    <>
      <div className="px-10 py-3">{children(data, (patch) => setData((d) => ({ ...d, ...patch })))}</div>
      <pre data-testid="gallery-data" className="mx-6 mt-2 whitespace-pre-wrap break-all rounded bg-gray-50 p-2 text-xs text-gray-500">{JSON.stringify(data)}</pre>
    </>
  );
}

const GALLERY: Array<{ name: string; render: () => ReactElement }> = [
  { name: 'Title', render: () => <Stateful initial={{ text: 'This month at Serpa', size: 'large' as const }}>{(d, set) => <TitleBlockEditor blockId="g-title" data={d} selected readOnly={false} onChange={set} />}</Stateful> },
  { name: 'Text', render: () => <Stateful initial={{ html: '<p>Hello <strong>there</strong>, see our <a href="https://serpachrysler.ca/deals">deals</a>.</p>' }}>{(d, set) => <TextBlockEditor blockId="g-text" data={d} selected readOnly={false} onChange={set} />}</Stateful> },
  { name: 'Button', render: () => <Stateful initial={{ label: 'Book a test drive', url: '', color: '#6C60FF' }}>{(d, set) => <ButtonBlockEditor blockId="g-button" data={d} selected readOnly={false} onChange={set} />}</Stateful> },
  { name: 'Divider', render: () => <Stateful initial={{ style: 'line' as const }}>{(d, set) => <DividerBlockEditor blockId="g-divider" data={d} selected readOnly={false} onChange={set} />}</Stateful> },
  { name: 'Image', render: () => <Stateful initial={{ url: '', alt: '', link: null as string | null }}>{(d, set) => <ImageBlockEditor blockId="g-image" data={d} selected readOnly={false} onChange={set} />}</Stateful> },
  { name: 'YouTube', render: () => <Stateful initial={{ url: '' }}>{(d, set) => <YoutubeBlockEditor blockId="g-youtube" data={d} selected readOnly={false} onChange={set} />}</Stateful> },
  { name: 'Header', render: () => <HeaderGallery /> },
  { name: 'Footer', render: () => <FooterGallery /> },
  // New gallery entries go above this line.
];

function BlocksHarness() {
  return (
    <div className="mx-auto max-w-[600px] space-y-6 p-6">
      {GALLERY.map((entry) => (
        <section key={entry.name} data-testid={`gallery-${entry.name}`} aria-label={`${entry.name} gallery`} className="rounded-xl border border-gray-200 bg-white py-4">
          <h2 className="px-6 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{entry.name}</h2>
          {entry.render()}
        </section>
      ))}
    </div>
  );
}

function ResultsHarness() {
  const first = Number(params.get('id') || 21);
  const [id, setId] = useState<number | null>(first);
  return (
    <div className="p-6">
      <button type="button" onClick={() => setId(first)}>Open results</button>
      <NewsletterResults newsletterId={id} onOpenChange={(o) => { if (!o) setId(null); }} onChanged={() => console.log('changed')} />
    </div>
  );
}

// A few Storeels for the All Campaigns view (App passes them as apiMemoriesData).
const SAMPLE_STOREELS = {
  all_memories: {
    data: [
      { id: 501, title: 'Fall service event', category: 'Service', author: 'Samantha Smith', label: 'Events', tags: ['fall'], photos: 12, startDate: 'Oct 1, 2026', endDate: 'Oct 31, 2026', lastVisited: '2 days ago' },
      { id: 502, title: '2026 Grand Cherokee arrivals', category: 'Inventory', author: 'Samantha Smith', label: 'New', tags: [], photos: 30, startDate: 'Sep 15, 2026', endDate: 'Oct 15, 2026', lastVisited: '1 week ago' },
      { id: 503, title: 'Customer stories', category: 'Community', author: 'Samantha Smith', label: 'Stories', tags: ['reviews'], photos: 8, startDate: 'Aug 1, 2026', endDate: 'Sep 30, 2026', lastVisited: '3 weeks ago' },
    ],
  },
};

// App passes its categories state (a stable array); without it MemoriesPage's `categories = []` default is a new
// array every render, which re-runs CreateMemory's open effect and empties the Storeel form while typing.
const SAMPLE_CATEGORIES = [
  { id: 7, name: 'Personal', count: 2, is_owner: true, can_add_story: true },
  { id: 8, name: 'Service', count: 1, is_owner: true, can_add_story: true },
];

// The Campaigns page as App mounts it (sidebar toggle included, so phones keep it on both views).
function CampaignsHarness() {
  const [sidebar, setSidebar] = useState(false);
  return (
    // pt-20: App's 80 px top bar, which the page's sticky headers (top-20) sit under.
    <div className="min-h-screen bg-[#F8F8FA] px-2 pt-20 md:px-6 md:pb-6">
      <MemoriesPage onMemorySelect={() => {}} apiMemoriesData={params.get('storeels') === '0' ? undefined : SAMPLE_STOREELS} categories={SAMPLE_CATEGORIES}
        showMobileSidebar={sidebar} onToggleMobileSidebar={() => setSidebar((v) => !v)} onCloseMobileSidebar={() => setSidebar(false)} />
    </div>
  );
}

const VIEWS: Record<string, () => ReactElement> = {
  composer: ComposerHarness,
  blocks: BlocksHarness,
  results: ResultsHarness,
  campaigns: CampaignsHarness,
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
