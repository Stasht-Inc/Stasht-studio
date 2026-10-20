import { Mail } from 'lucide-react';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from './lib/ui';

/** Starter plan on the Newsletter tab (spec decision 4: paid plans only). */
export default function UpgradeCard({ onSeePlans, onMakeStoreel }: { onSeePlans(): void; onMakeStoreel(): void }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
        <span aria-hidden="true" className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#6C60FF]/10"><Mail className="h-6 w-6 text-[#6C60FF]" /></span>
        <h3 className="text-lg font-semibold text-gray-900">Newsletters are part of paid plans</h3>
        <p className="mt-1 text-sm text-gray-600">Upgrade to send newsletters by email and text to your leads and lists.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={onMakeStoreel} className={BUTTON_SECONDARY}>Make a Storeel instead</button>
          <button type="button" onClick={onSeePlans} className={BUTTON_PRIMARY}>See plans</button>
        </div>
      </div>
    </div>
  );
}
