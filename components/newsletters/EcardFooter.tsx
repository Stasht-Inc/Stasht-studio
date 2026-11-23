import { useState } from 'react';
import type { SenderProfile } from './lib/profile';
import { BUTTON_SMALL, LINK_BUTTON, inputClass } from './lib/ui';

/**
 * The footer every newsletter ends with (Deepak 23 Nov 2026, Fresha style), drawn as emails/newsletter/footer.blade.php
 * draws it: a light grey band, centred: "Powered by", the Stasht logo (links to stasht.com), "You're receiving this email
 * because you're in touch with {sender}." / "You can unsubscribe here.", then the business address (with its Add / Edit
 * form, as before). The sender's e-card (avatar, name, email or Reply-to email, phone, website, socials) is no longer
 * part of the footer. Preview only: the server adds the real links.
 */
export default function EcardFooter({ profile, fromName, businessAddress, onSaveAddress, readOnly, addressError, padClass = 'px-10' }: {
  profile: SenderProfile | null;
  fromName: string;
  /** No longer drawn (the e-card is gone); kept so callers don't change. */
  replyTo?: string | null;
  businessAddress: string | null;
  onSaveAddress(address: string): Promise<boolean>;
  readOnly: boolean;
  addressError?: string | null;
  padClass?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(businessAddress ?? '');
  const [saving, setSaving] = useState(false);
  const showForm = !readOnly && (editing || !businessAddress);
  const sender = fromName.trim() || profile?.name || 'this business';

  const save = async () => {
    if (!value.trim()) return;
    setSaving(true);
    const ok = await onSaveAddress(value.trim());
    setSaving(false);
    if (ok) setEditing(false);
  };

  return (
    <footer data-nl-footer="" className={`bg-[#F5F5F8] ${padClass} pb-10 pt-9 text-center text-gray-800`}>
      <p className="text-base leading-6">Powered by</p>
      <a href="https://stasht.com" target="_blank" rel="noopener noreferrer" aria-label="Stasht"
        className="mx-auto mt-2 inline-flex rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
        <img src="/stasht-wordmark.svg" alt="Stasht" width={130} height={34} className="h-[34px] w-[130px]" />
      </a>
      <p className="mt-6 text-[15px] leading-6">
        You’re receiving this email because you’re in touch with {sender}.<br />
        You can <span className="text-[#1A4BD6]">unsubscribe here</span>.
      </p>
      <div className="mt-3 text-xs leading-[1.125rem] text-gray-500">
        {showForm ? (
          <form className="mx-auto max-w-sm pt-1 text-left" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <label htmlFor="nl-business-address" className="mb-1 block text-xs font-medium text-gray-700">Business address</label>
            <div className="flex gap-2">
              <input id="nl-business-address" type="text" value={value} placeholder="Add your business address" aria-invalid={Boolean(addressError)}
                aria-describedby="nl-business-address-help" onChange={(e) => setValue(e.target.value)} className={inputClass(Boolean(addressError))} />
              <button type="submit" disabled={saving || !value.trim()} className={`${BUTTON_SMALL} h-9 flex-shrink-0`}>{saving ? 'Saving…' : 'Save address'}</button>
            </div>
            <p id="nl-business-address-help" role={addressError ? 'alert' : undefined} className={`mt-1 ${addressError ? 'text-red-600' : 'text-gray-500'}`}>
              {addressError ?? 'Email laws require your business address at the bottom of every email.'}
            </p>
          </form>
        ) : businessAddress ? (
          <p className="break-words">
            {businessAddress}
            {!readOnly ? <> · <button type="button" onClick={() => { setValue(businessAddress); setEditing(true); }} className={`${LINK_BUTTON} text-xs`}>Edit</button></> : null}
          </p>
        ) : null}
      </div>
    </footer>
  );
}
