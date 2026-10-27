import { useState } from 'react';
import { Mail, Phone } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { displayWebsite } from '../../utils/displayUrl';
import type { SenderProfile } from './lib/profile';
import { initialsFrom } from './lib/profile';
import { BUTTON_SMALL, LINK_BUTTON, inputClass } from './lib/ui';

/**
 * The footer every newsletter ends with (spec §2, decision 3: always shown): the sender's e-card, drawn like
 * the Storeel e-card (PublishedMemoryPage), then the lines from emails/newsletter/footer.blade.php: why they
 * get it with Unsubscribe, the business address and "Powered by Stasht". Preview only: the server adds the links.
 */
export default function EcardFooter({ profile, fromName, businessAddress, onSaveAddress, readOnly, addressError, padClass = 'px-10' }: {
  profile: SenderProfile | null;
  fromName: string;
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
    <footer className={`border-t border-[#ECEDF3] ${padClass} pb-8 pt-7`}>
      {profile ? (
        <div className="flex flex-col items-center text-center">
          <Avatar className="mb-2 h-14 w-14">
            {profile.photoUrl ? <AvatarImage src={profile.photoUrl} alt="" className="object-cover" /> : null}
            <AvatarFallback className="bg-[#6C60FF] text-sm text-white" style={profile.color ? { backgroundColor: profile.color } : undefined}>
              {initialsFrom(profile.name)}
            </AvatarFallback>
          </Avatar>
          <p className="text-base font-bold text-gray-900">{profile.name}</p>
          <div className="mb-1 flex flex-wrap items-center justify-center gap-2 text-sm text-gray-500">
            {profile.email ? <span className="flex min-w-0 items-center gap-1 break-all"><Mail className="h-3 w-3 flex-shrink-0" aria-hidden="true" />{profile.email}</span> : null}
            {profile.phone ? <span className="flex items-center gap-1"><Phone className="h-3 w-3 flex-shrink-0" aria-hidden="true" />{profile.phone}</span> : null}
          </div>
          {profile.website ? <span className="mb-3 break-all text-sm text-[#6C60FF]">{displayWebsite(profile.website.text)}</span> : null}
          {profile.socials.length ? (
            <div className="mb-3 mt-2 flex items-center gap-3">
              {profile.socials.map((s) => (
                <span key={s.key} className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
                  <img src={s.icon} alt={s.label} className="h-6 w-6 object-contain" />
                </span>
              ))}
            </div>
          ) : null}
          {!readOnly ? <p className="text-xs text-gray-500">Your e-card comes from Profile settings.</p> : null}
        </div>
      ) : null}

      <div className="mt-6 space-y-1.5 text-center text-xs leading-[1.125rem] text-gray-500">
        <p>You’re getting this because you’re in touch with {sender}. <span className="underline">Unsubscribe</span></p>
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
        <p className="text-gray-400">Powered by Stasht</p>
      </div>
    </footer>
  );
}
