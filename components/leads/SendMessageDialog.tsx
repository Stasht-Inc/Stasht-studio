import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Car, Loader2, Mail, MessageSquare, Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { leadsAPI } from '../../services/leadsAPI';
import { dashboardAPI } from '../../utils/authUtils';
import { useAuth } from '../../contexts/AuthContext';
import ShareCarsDialog from '../ShareCarsDialog';

// "+ Send Message" (spec 2026-09-23 §5, Chris's "Start A New Message" reference):
// text or email anyone. The backend reuses the contact's existing lead on this
// dealer, or creates a direct lead assigned to the sender. "+ Campaign" works
// like the lead chat's: picked cars become a NEW campaign whose link is sent.

const SMS_LIMIT = 320;

interface PickedCampaign { carIds: number[]; name: string }

// Pre-written text (Chris: "so they don't have to do anything"). No greeting —
// the server already opens emails and first texts with "Hi {name},". With cars,
// the campaign link is appended on its own line after the colon.
function suggestedBody(carCount: number, senderName: string, dealerName: string): string {
  if (carCount > 0) {
    return `I picked out ${carCount === 1 ? 'a vehicle' : `${carCount} vehicles`} I think you'll like — take a look:`;
  }
  const who = [senderName, dealerName].filter(Boolean).join(' at ');
  return `Just checking in to see if you have any questions. I'm happy to help${who ? ` — ${who}` : ''}.`;
}

function suggestedSubject(carCount: number, dealerName: string): string {
  if (carCount > 0) return `${carCount === 1 ? 'A vehicle' : `${carCount} vehicles`} picked for you`;
  return dealerName ? `Checking in from ${dealerName}` : 'Checking in';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: (leadId: number) => void;
}

interface Option { id: string; name: string }

export default function SendMessageDialog({ open, onOpenChange, onSent }: Props) {
  const { user } = useAuth();
  const [channel, setChannel] = useState<'sms' | 'email'>('sms');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  // null = use the suggested text, which follows the cars/dealership picked.
  const [subjectOverride, setSubjectOverride] = useState<string | null>(null);
  const [bodyOverride, setBodyOverride] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedCampaign | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [propertyId, setPropertyId] = useState<string>('');
  const [properties, setProperties] = useState<Option[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fresh form each time it opens; the property list loads lazily.
  useEffect(() => {
    if (!open) return;
    setChannel('sms'); setName(''); setPhone(''); setEmail(''); setSubjectOverride(null); setBodyOverride(null);
    setPicked(null); setShowPicker(false); setError(null);

    dashboardAPI.getStoreelMyProperties().then((res: any) => {
      const list: any[] = res?.properties || res?.data?.properties || [];
      const opts = list.map((p) => ({ id: String(p.id), name: p.name }));
      setProperties(opts);
      setPropertyId(opts.length === 1 ? opts[0].id : '');
    }).catch(() => setProperties([]));
  }, [open]);

  const carCount = picked?.carIds.length ?? 0;
  const senderName = user?.name?.trim().split(/\s+/)[0] ?? '';
  const dealerName = properties.find((p) => p.id === propertyId)?.name ?? '';
  const bodySuggestion = suggestedBody(carCount, senderName, dealerName);
  const body = bodyOverride ?? bodySuggestion;
  const subject = subjectOverride ?? suggestedSubject(carCount, dealerName);
  // Mirrors the server's opener (LeadDeliveryService buildSmsBody / buildEmailHtml).
  const contactFirst = name.trim().split(/\s+/)[0];
  const greeting = contactFirst ? `Hi ${contactFirst},` : channel === 'email' ? 'Hi there,' : 'Hi,';

  const digits = phone.replace(/\D/g, '');
  const contactOk = channel === 'sms' ? digits.length >= 10 : /\S+@\S+\.\S+/.test(email.trim());
  const needsProperty = properties.length > 1 && !propertyId;
  const tooLong = channel === 'sms' && body.length > SMS_LIMIT;
  const canSend = contactOk && (body.trim().length > 0 || carCount > 0) && !needsProperty && !tooLong && !sending;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const res: any = await leadsAPI.startConversation({
        channel,
        ...(channel === 'sms' ? { phone } : { email: email.trim(), ...(subject.trim() ? { subject: subject.trim() } : {}) }),
        ...(name.trim() ? { name: name.trim() } : {}),
        body: body.trim(),
        ...(propertyId ? { property_id: propertyId } : {}),
        ...(picked ? { car_ids: picked.carIds, campaign_title: picked.name } : {}),
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
  // purple focus ring. The shadcn defaults draw borders from colour tokens that
  // don't resolve in this app, which is what showed up as black outlines.
  const field = 'w-full h-10 px-3 rounded-lg bg-white text-sm text-gray-900 placeholder:text-gray-500 border border-gray-200 outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF] focus-visible:border-transparent';
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
              <input id="sm-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" inputMode="tel" className={field} autoComplete="off" />
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
              <span id="sm-property-label" className={label}>Send from</span>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger aria-labelledby="sm-property-label" className="h-10 w-full bg-white border-gray-200 text-sm">
                  <SelectValue placeholder="Choose a dealership" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <span id="sm-campaign-label" className={label}>Campaign <span className={hint}>(optional — pick items for a new campaign; its link is added)</span></span>
            {picked ? (
              <div className="flex items-center gap-3 rounded-lg border border-[#6C60FF] bg-[#F5F2FF] px-3 py-2">
                <span aria-hidden="true" className="w-8 h-8 shrink-0 rounded-md bg-white flex items-center justify-center">
                  <Car className="w-4 h-4 text-[#5A4FE5]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">{picked.name}</span>
                  <span className="block text-xs text-gray-600">{carCount} {carCount === 1 ? 'item' : 'items'} · new campaign</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="h-8 px-2.5 rounded-md text-sm font-medium text-[#5A4FE5] hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setPicked(null)}
                  aria-label="Remove campaign"
                  className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md text-gray-500 hover:bg-white hover:text-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              // Same "＋ Campaign" pill as the lead chat composer.
              <button
                type="button"
                aria-labelledby="sm-campaign-label"
                onClick={() => setShowPicker(true)}
                className="flex items-center gap-1.5 h-10 px-4 rounded-lg bg-purple-50 hover:bg-purple-100 text-[#5A4FE5] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Campaign
              </button>
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
                  className="shrink-0 text-xs font-medium text-[#5A4FE5] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF] rounded"
                >
                  Use suggested text
                </button>
              )}
            </div>
            <textarea
              id="sm-body"
              value={body}
              onChange={(e) => setBodyOverride(e.target.value)}
              rows={5}
              className="w-full px-3 py-2.5 rounded-lg bg-white text-sm text-gray-900 placeholder:text-gray-500 border border-gray-200 outline-none resize-y focus-visible:ring-2 focus-visible:ring-[#6C60FF] focus-visible:border-transparent"
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
          initialSelection={picked?.carIds}
          initialCampaignName={picked?.name}
          onPick={(carIds, campaignName) => setPicked({ carIds, name: campaignName })}
        />

        <div className="border-t border-gray-100 px-6 py-4 flex gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={sending}
            className="flex-1 h-11 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF] focus-visible:ring-offset-2"
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
