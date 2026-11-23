import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Car, Loader2, Mail, MessageSquare, Package, Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { campaignIdsBody, leadsAPI } from '../../services/leadsAPI';
import { dashboardAPI } from '../../utils/authUtils';
import { useAuth } from '../../contexts/AuthContext';
import ShareCarsDialog, { samePickTab, type PickKind } from '../ShareCarsDialog';
import CountrySelect from '../CountrySelect';
import { isPlausibleSplitPhone, splitTypedPhone, toE164 } from '../../utils/phoneUtils';
import { useProperty } from '../../contexts/PropertyContext';
import { actingPerson, messageSignoff } from '../../utils/messageSignoff';
import { existingCampaignsText, fallbackDraft, insertDraft, removeDraft, replaceDraft, trackedCampaignId, type ExistingCampaignPick } from '../../utils/composerCampaign';
import CampaignPickerDialog from '../newsletters/CampaignPickerDialog';
import type { CampaignItem } from '../../services/newslettersAPI';
import { defaultSendAs, offersBusiness, SEND_AS_BUSINESS } from '../../utils/sendAsDefault';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { findPropertyRow } from '../../utils/propertyRows';
import { CAMPAIGN_PILL, EXISTING_CAMPAIGNS_DESCRIPTION, EXISTING_CAMPAIGNS_TITLE, ProductsPickButton, useCampaignSources, VehiclesPickButton } from './CampaignPickButtons';

// "+ Send Message" (spec 2026-09-23 §5, Chris's "Start A New Message" reference):
// text or email anyone. The backend reuses the contact's existing lead on this
// dealer, or creates a direct lead assigned to the sender. "+ Campaign" works
// like the lead chat's: picked cars become a NEW campaign whose link is sent.

const SMS_LIMIT = 320;

// ids are vehicle ids (car_ids), Website Catalogue / manual product ids (catalog_item_ids) or Shopify product ids
// (shopify_product_ids).
// draft: the wording put in the message (Chris 14 Nov 2026: the items go into the message box, "[campaign link]" where
// the link goes); the campaign itself is created only on Send.
interface PickedCampaign { ids: number[]; name: string; kind: PickKind; defaultName?: string; draft?: string }

// Pre-written text (Chris: "so they don't have to do anything"). No greeting —
// the server already opens emails and first texts with "Hi {name},". With cars,
// the campaign link is appended on its own line after the colon.
function itemWords(count: number, kind: PickKind): string {
  const noun = kind === 'vehicle' ? 'vehicle' : 'product';
  return count === 1 ? `a ${noun}` : `${count} ${noun}s`;
}

// `who` is the sign-off from utils/messageSignoff: "Brenna at TheRoyalWoodShop", or the business alone.
function suggestedBody(carCount: number, who: string, kind: PickKind = 'vehicle'): string {
  if (carCount > 0) {
    return `I picked out ${itemWords(carCount, kind)} I think you'll like — take a look:`;
  }
  return `Just checking in to see if you have any questions. I'm happy to help${who ? ` — ${who}` : ''}.`;
}

function suggestedSubject(carCount: number, business: string, kind: PickKind = 'vehicle'): string {
  if (carCount > 0) {
    const words = itemWords(carCount, kind);
    return `${words.charAt(0).toUpperCase()}${words.slice(1)} picked for you`;
  }
  return business ? `Checking in from ${business}` : 'Checking in';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: (leadId: number) => void;
}

// account_type etc. come from GET /properties (my-properties sends id + name only): a property's name is used in the
// sign-off only when that row says it is internal (utils/messageSignoff).
// The business itself (SEND_AS_BUSINESS) is listed first when offersBusiness(): the account's name and logo.
interface Option { id: string; name: string; row?: Record<string, any>; avatar?: string | null }

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

function readSwitchData(): any {
  try { return JSON.parse(localStorage.getItem('admin_switch_data') || 'null'); } catch { return null; }
}
function readToken(): string | null {
  try { return localStorage.getItem('stasht_token'); } catch { return null; }
}

export default function SendMessageDialog({ open, onOpenChange, onSent }: Props) {
  const { user } = useAuth();
  const { viewType, currentProperty } = useProperty();
  const [channel, setChannel] = useState<'sms' | 'email'>('sms');
  const [name, setName] = useState('');
  // Split like every other phone field (Profile, invites, add collaborator):
  // country code + national number, sent as E.164. Canada/US by default.
  const [phoneCountry, setPhoneCountry] = useState('+1');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  // null = use the suggested text, which follows the items / business picked.
  const [subjectOverride, setSubjectOverride] = useState<string | null>(null);
  const [bodyOverride, setBodyOverride] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedCampaign | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  // "+ Products" opens the picker on its Products tab; "+ Campaign" and Edit as before (undefined).
  const [pickerKind, setPickerKind] = useState<PickKind | undefined>(undefined);
  const pickSources = useCampaignSources(open);
  const hasProducts = pickSources.products;
  // "+ Campaign" (Chris 23 Nov 2026, G): the account's existing campaigns, their title + link put in the message.
  const [showExistingPicker, setShowExistingPicker] = useState(false);
  const [existingPicks, setExistingPicks] = useState<ExistingCampaignPick[]>([]);
  const [propertyId, setPropertyId] = useState<string>('');
  const [properties, setProperties] = useState<Option[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Fresh form each time it opens; the property list loads lazily.
  useEffect(() => {
    if (!open) return;
    setChannel('sms'); setName(''); setPhoneCountry('+1'); setPhone(''); setEmail(''); setSubjectOverride(null); setBodyOverride(null);
    setPicked(null); setShowPicker(false); setError(null); setShowExistingPicker(false); setExistingPicks([]);

    let cancelled = false;
    // The full GET /properties rows, found however the response is wrapped (utils/propertyRows, as AccountChoiceModal).
    const fullRows = dashboardAPI.getProperties().catch(() => null);
    dashboardAPI.getStoreelMyProperties().then(async (res: any) => {
      const list: any[] = res?.properties || res?.data?.properties || [];
      const rows = await fullRows;
      if (cancelled) return;
      const props: Option[] = list.map((p) => ({ id: String(p.id), name: p.name, row: findPropertyRow(rows, p.id) ?? undefined }));
      const inPropertyView = viewType === 'property';
      const accountName = ((user as any)?.name || '').trim();
      const accountLogo = (user as any)?.avatar || (user as any)?.profile_image;
      // The business itself first (Chris, 20 Nov 2026), then the properties as before.
      const opts: Option[] = accountName && offersBusiness(props, inPropertyView)
        ? [{ id: SEND_AS_BUSINESS, name: accountName, avatar: accountLogo && accountLogo !== 'null' ? accountLogo : null }, ...props]
        : props;
      setProperties(opts);
      // "Send as" starts on the current view's business, the account's own property, else the business itself
      // (utils/sendAsDefault); changeable.
      setPropertyId(defaultSendAs(opts, inPropertyView ? (currentProperty as any)?.id ?? null : null));
    }).catch(() => { if (!cancelled) setProperties([]); });
    return () => { cancelled = true; };
  }, [open]);

  const carCount = picked?.ids.length ?? 0;
  const pickedKind: PickKind = picked?.kind ?? 'vehicle';
  const asBusiness = propertyId === SEND_AS_BUSINESS;
  const pickedProperty = asBusiness ? undefined : properties.find((p) => p.id === propertyId);
  // Sent as the business: signed by the business alone ("— TheRoyalWoodShop"), not "Christian at TheRoyalWoodShop".
  const signoff = messageSignoff({
    account: user as any,
    acting: asBusiness ? null : actingPerson(readSwitchData(), user as any, readToken()),
    property: pickedProperty ? { ...(pickedProperty.row || {}), name: pickedProperty.name } : null,
    viewProperty: !asBusiness && viewType === 'property' ? (currentProperty as any) : null,
  });
  const bodySuggestion = suggestedBody(carCount, signoff.who, pickedKind);
  const body = bodyOverride ?? bodySuggestion;
  const subject = subjectOverride ?? suggestedSubject(carCount, signoff.business, pickedKind);
  // Mirrors the server's opener (LeadDeliveryService buildSmsBody / buildEmailHtml).
  const contactFirst = name.trim().split(/\s+/)[0];
  const greeting = contactFirst ? `Hi ${contactFirst},` : channel === 'email' ? 'Hi there,' : 'Hi,';

  const phoneE164 = toE164(phoneCountry, phone);
  // The server (LeadConversationStartController::normalisePhone) ignores the "+"
  // and reads any 10-digit number as North American, so an international number
  // that is 10 digits in all would be texted to the wrong person — don't send it.
  const phoneOk = isPlausibleSplitPhone(phoneCountry, phone)
    && !(phoneE164.length === 11 && !phoneE164.startsWith('+1'));
  const showPhoneHint = phone.replace(/\D/g, '').length > 0 && !phoneOk;
  const contactOk = channel === 'sms' ? phoneOk : /\S+@\S+\.\S+/.test(email.trim());
  const needsProperty = properties.length > 1 && !propertyId;
  // The picked items' links don't count against the text limit (they went on top of it before, added by the server).
  const countedLength = picked?.draft && body.includes(picked.draft) ? body.length - picked.draft.length : body.length;
  const tooLong = channel === 'sms' && countedLength > SMS_LIMIT;

  // Add in the picker: the items' wording replaces the suggested text (or the previous pick's), else goes in at the cursor.
  const pickCampaign = async (ids: number[], campaignName: string, kind: PickKind, defaultName?: string) => {
    let draft = fallbackDraft(ids.length, kind);
    try {
      const res = await leadsAPI.campaignDraft(kind, ids);
      const text = (res.data as any)?.body ?? (res.data as any)?.data?.body;
      if (res.success && typeof text === 'string' && text.trim()) draft = text;
      else if (!res.success) {
        setError((res as any)?.message || res.error || 'Could not add those items.');
        return;
      }
    } catch {
      // keep the fallback wording
    }
    const el = bodyRef.current;
    const next = bodyOverride === null && !picked?.draft
      ? { text: draft, cursor: draft.length }
      : replaceDraft(body, picked?.draft, draft, el?.selectionStart ?? body.length, el?.selectionEnd ?? body.length);
    setBodyOverride(next.text);
    setPicked({ ids, name: campaignName, kind, defaultName, draft });
    setError(null);
  };

  // "+ Campaign" → Done (G): each picked campaign's "Title: link" goes in at the cursor (after the suggested text).
  const pickExisting = (_selections: unknown, items: CampaignItem[]) => {
    const picks = items.filter((i) => i.kind === 'campaign' && i.url).map((i) => ({ id: i.id, title: i.title, url: i.url }));
    const text = existingCampaignsText(picks);
    if (!text) return;
    const el = bodyRef.current;
    const at = bodyOverride === null ? body.length : el?.selectionStart ?? body.length;
    const next = insertDraft(body, at, bodyOverride === null ? body.length : el?.selectionEnd ?? body.length, text);
    setBodyOverride(next.text);
    setExistingPicks((prev) => [...prev, ...picks.filter((p) => !prev.some((q) => q.id === p.id))]);
    setError(null);
  };

  const removeCampaign = () => {
    if (picked?.draft) {
      const rest = removeDraft(body, picked.draft);
      setBodyOverride(rest === '' ? null : rest);
    }
    setPicked(null);
  };
  const canSend = contactOk && (body.trim().length > 0 || carCount > 0) && !needsProperty && !tooLong && !sending;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const res: any = await leadsAPI.startConversation({
        channel,
        ...(channel === 'sms' ? { phone: phoneE164 } : { email: email.trim(), ...(subject.trim() ? { subject: subject.trim() } : {}) }),
        ...(name.trim() ? { name: name.trim() } : {}),
        body: body.trim(),
        ...(asBusiness ? { send_as: 'account' } : propertyId ? { property_id: propertyId } : {}),
        ...(picked ? { ...campaignIdsBody(picked.kind, picked.ids), campaign_title: picked.name } : {}),
        // An existing campaign put in with "+ Campaign" (G): the server tracks its link (never with new items).
        ...(!picked && trackedCampaignId(body, existingPicks) ? { memory_id: trackedCampaignId(body, existingPicks) as number } : {}),
      });
      if (res.success && res.data) {
        const what = picked ? `Message sent with a new campaign, "${picked.name}"` : 'Message sent';
        toast.success(res.data.created ? `${what} — new lead added` : what);
        onOpenChange(false);
        onSent(res.data.lead_id);
      } else {
        setError(res.error || res.message || 'Could not send the message.');
      }
    } catch {
      setError('Could not send the message.');
    } finally {
      setSending(false);
    }
  };

  // Same pill toggle as the Leads / Groups / My Conversations tabs.
  const tab = (value: 'sms' | 'email', label: string, Icon: typeof MessageSquare) => (
    <button
      type="button"
      aria-pressed={channel === value}
      onClick={() => setChannel(value)}
      className={`flex-1 h-9 inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors ${channel === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
    >
      <Icon className="w-4 h-4" />{label}
    </button>
  );

  // Styled like ShareCarsDialog (the app's pattern): explicit gray borders and a
  // grey focus ring. The shadcn defaults draw borders from colour tokens that
  // don't resolve in this app, which is what showed up as black outlines.
  const field = 'w-full h-10 px-3 rounded-lg bg-white text-sm text-gray-900 placeholder:text-gray-500 border border-gray-200 outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:border-transparent';
  const label = 'block text-xs font-medium text-gray-700 mb-1';
  const hint = 'font-normal text-gray-500';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!sending) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden bg-white rounded-2xl shadow-xl border-0">
        <DialogHeader className="px-6 pt-6 pb-3 pr-12">
          <DialogTitle>Start a new message</DialogTitle>
          <DialogDescription>Text or email anyone. The conversation shows up in your Leads.</DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4 space-y-4 overflow-y-auto">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {tab('sms', 'Text (SMS)', MessageSquare)}
            {tab('email', 'Email', Mail)}
          </div>

          <div>
            <label htmlFor="sm-name" className={label}>Name <span className={hint}>(optional)</span></label>
            <input id="sm-name" value={name} onChange={(e) => setName(e.target.value)} className={field} autoComplete="off" />
          </div>

          {channel === 'sms' ? (
            <div>
              <label htmlFor="sm-phone" className={label}>Phone number</label>
              <div className="flex gap-2">
                <CountrySelect
                  value={phoneCountry}
                  onChange={setPhoneCountry}
                  ariaLabel="Country code"
                  className="w-28 flex-shrink-0 h-10 rounded-lg bg-white text-sm text-gray-900 border border-gray-200 outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:border-transparent"
                />
                <input
                  id="sm-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => {
                    const next = splitTypedPhone(phoneCountry, e.target.value);
                    setPhoneCountry(next.countryCode);
                    setPhone(next.number);
                  }}
                  placeholder="1235555555"
                  autoComplete="off"
                  aria-describedby={showPhoneHint ? 'sm-phone-hint' : undefined}
                  className={`${field} flex-1 min-w-0`}
                />
              </div>
              {showPhoneHint && (
                <p id="sm-phone-hint" className="mt-1 text-xs text-gray-500">Enter the full number, including the area code.</p>
              )}
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="sm-email" className={label}>Email</label>
                <input id="sm-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" type="email" className={field} autoComplete="off" />
              </div>
              <div>
                <label htmlFor="sm-subject" className={label}>Subject</label>
                <input id="sm-subject" value={subject} onChange={(e) => setSubjectOverride(e.target.value)} className={field} />
              </div>
            </>
          )}

          {properties.length > 1 && (
            <div>
              <span id="sm-property-label" className={label}>Send as</span>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger aria-labelledby="sm-property-label" aria-describedby="sm-property-hint" className="h-10 w-full bg-white border-gray-200 text-sm">
                  <SelectValue placeholder="Choose a sender" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.id === SEND_AS_BUSINESS ? (
                        <span className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            {p.avatar && <AvatarImage src={p.avatar} alt="" />}
                            <AvatarFallback className="bg-[#E5E7EB] text-[#202224] text-[10px] font-bold">{initials(p.name)}</AvatarFallback>
                          </Avatar>
                          {p.name}
                        </span>
                      ) : p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p id="sm-property-hint" className="mt-1 text-xs text-gray-500">Who the message comes from. The team sees the conversation in Leads.</p>
            </div>
          )}

          <div>
            <span id="sm-campaign-label" className={label}>Campaign <span className={hint}>(optional — goes into your message; products make a new campaign when you send)</span></span>
            {picked ? (
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-[#F3F4F6] px-3 py-2">
                <span aria-hidden="true" className="w-8 h-8 shrink-0 rounded-md bg-white flex items-center justify-center">
                  {picked.kind !== 'vehicle' ? <Package className="w-4 h-4 text-[#4A5565]" /> : <Car className="w-4 h-4 text-[#4A5565]" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">{picked.name || picked.defaultName}</span>
                  <span className="block text-xs text-gray-600">{carCount} {carCount === 1 ? 'item' : 'items'} · new campaign</span>
                </span>
                <button
                  type="button"
                  onClick={() => { setPickerKind(undefined); setShowPicker(true); }}
                  className="h-8 px-2.5 rounded-md text-sm font-medium text-[#202224] hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={removeCampaign}
                  aria-label="Remove campaign"
                  className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md text-gray-500 hover:bg-white hover:text-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              // Same "＋ Products" / "＋ Campaign" pills as the lead chat composer (CampaignPickButtons).
              <div className="flex flex-wrap items-center gap-2">
                {hasProducts && <ProductsPickButton onClick={() => { setPickerKind('product'); setShowPicker(true); }} />}
                {pickSources.vehicles && !hasProducts && <VehiclesPickButton onClick={() => { setPickerKind('vehicle'); setShowPicker(true); }} />}
                <button
                  type="button"
                  aria-labelledby="sm-campaign-label"
                  title="Add a campaign to your message"
                  onClick={() => setShowExistingPicker(true)}
                  className={CAMPAIGN_PILL}
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Campaign
                </button>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <label htmlFor="sm-body" className="text-xs font-medium text-gray-700">
                Message <span className={hint}>(the “{greeting}” greeting is added for you)</span>
              </label>
              {bodyOverride !== null && bodyOverride !== bodySuggestion && (
                <button
                  type="button"
                  onClick={() => setBodyOverride(null)}
                  className="shrink-0 text-xs font-medium text-[#4A5565] hover:text-[#202224] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded"
                >
                  Use suggested text
                </button>
              )}
            </div>
            <textarea
              ref={bodyRef}
              id="sm-body"
              value={body}
              onChange={(e) => setBodyOverride(e.target.value)}
              rows={5}
              className="w-full px-3 py-2.5 rounded-lg bg-white text-sm text-gray-900 placeholder:text-gray-500 border border-gray-200 outline-none resize-y focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:border-transparent"
              placeholder={picked
                ? `Leave blank to send "${carCount === 1 ? 'Here is 1 new car listing that matches' : `Here are ${carCount} new car listings that match`} your criteria: <link>"`
                : channel === 'sms' ? 'Type your text…' : 'Type your email…'}
            />
            {channel === 'sms' && (
              <span className={`mt-1 block text-right text-xs ${tooLong ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>{body.length}/{SMS_LIMIT}</span>
            )}
          </div>

          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        </div>

        {/* Inside DialogContent so Radix treats it as a nested layer: clicks in the
            picker don't count as "outside" and close this dialog. */}
        <ShareCarsDialog
          open={showPicker}
          onClose={() => setShowPicker(false)}
          leadName={name.trim() || 'this contact'}
          initialSelection={pickerKind && picked && !samePickTab(picked.kind, pickerKind) ? undefined : picked?.ids}
          initialCampaignName={pickerKind && picked && !samePickTab(picked.kind, pickerKind) ? undefined : picked?.name}
          initialKind={pickerKind && picked && samePickTab(picked.kind, pickerKind) ? picked.kind : (pickerKind ?? picked?.kind)}
          onPick={pickCampaign}
        />
        <CampaignPickerDialog
          open={showExistingPicker}
          onOpenChange={setShowExistingPicker}
          only="campaign"
          title={EXISTING_CAMPAIGNS_TITLE}
          description={EXISTING_CAMPAIGNS_DESCRIPTION}
          initialSelections={[]}
          knownItems={[]}
          onDone={pickExisting}
          onCloseAutoFocus={(e) => { e.preventDefault(); bodyRef.current?.focus(); }}
        />

        <div className="border-t border-gray-100 px-6 py-4 flex gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={sending}
            className="flex-1 h-11 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            className="flex-1 h-11 rounded-xl bg-[#6C60FF] hover:bg-[#5A4FE5] text-white text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF] focus-visible:ring-offset-2"
          >
            {sending ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> : 'Send'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
