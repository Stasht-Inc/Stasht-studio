import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Mail, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { leadsAPI } from '../../services/leadsAPI';
import { dashboardAPI } from '../../utils/authUtils';

// "+ Send Message" (spec 2026-09-23 §5, Chris's "Start A New Message" reference):
// text or email anyone. The backend reuses the contact's existing lead on this
// dealer, or creates a direct lead assigned to the sender.

const SMS_LIMIT = 320;
const NO_CAMPAIGN = '__none__';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: (leadId: number) => void;
}

interface Option { id: string; name: string }

export default function SendMessageDialog({ open, onOpenChange, onSent }: Props) {
  const [channel, setChannel] = useState<'sms' | 'email'>('sms');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [campaignId, setCampaignId] = useState(NO_CAMPAIGN);
  const [propertyId, setPropertyId] = useState<string>('');
  const [campaigns, setCampaigns] = useState<Option[]>([]);
  const [properties, setProperties] = useState<Option[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fresh form each time it opens; campaign + property lists load lazily.
  useEffect(() => {
    if (!open) return;
    setChannel('sms'); setName(''); setPhone(''); setEmail(''); setSubject(''); setBody('');
    setCampaignId(NO_CAMPAIGN); setError(null);

    dashboardAPI.getStoreelMyProperties().then((res: any) => {
      const list: any[] = res?.properties || res?.data?.properties || [];
      const opts = list.map((p) => ({ id: String(p.id), name: p.name }));
      setProperties(opts);
      setPropertyId(opts.length === 1 ? opts[0].id : '');
    }).catch(() => setProperties([]));
  }, [open]);

  // Campaigns that can be attached from the chosen dealership (plus the sender's
  // own). Reloads when the dealership changes; a campaign from the previous one
  // is cleared so the backend never rejects the pairing.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCampaignId(NO_CAMPAIGN);
    leadsAPI.getAttachableCampaigns(propertyId || undefined).then((res) => {
      if (cancelled) return;
      const list = res.success && res.data ? res.data.campaigns : [];
      setCampaigns(list.map((c) => ({ id: String(c.id), name: c.title })));
    }).catch(() => { if (!cancelled) setCampaigns([]); });
    return () => { cancelled = true; };
  }, [open, propertyId]);

  const digits = phone.replace(/\D/g, '');
  const contactOk = channel === 'sms' ? digits.length >= 10 : /\S+@\S+\.\S+/.test(email.trim());
  const needsProperty = properties.length > 1 && !propertyId;
  const tooLong = channel === 'sms' && body.length > SMS_LIMIT;
  const canSend = contactOk && body.trim().length > 0 && !needsProperty && !tooLong && !sending;

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
        ...(campaignId !== NO_CAMPAIGN ? { memory_id: campaignId } : {}),
      });
      if (res.success && res.data) {
        toast.success(res.data.created ? 'Message sent — new lead added' : 'Message sent');
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
                <label htmlFor="sm-subject" className={label}>Subject <span className={hint}>(optional)</span></label>
                <input id="sm-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={field} />
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
            <span id="sm-campaign-label" className={label}>Attach a campaign <span className={hint}>(optional — adds its link)</span></span>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger aria-labelledby="sm-campaign-label" className="h-10 w-full bg-white border-gray-200 text-sm">
                <SelectValue placeholder="No campaign" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={NO_CAMPAIGN}>No campaign</SelectItem>
                {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="sm-body" className={label}>Message</label>
            <textarea
              id="sm-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full px-3 py-2.5 rounded-lg bg-white text-sm text-gray-900 placeholder:text-gray-500 border border-gray-200 outline-none resize-y focus-visible:ring-2 focus-visible:ring-[#6C60FF] focus-visible:border-transparent"
              placeholder={channel === 'sms' ? 'Type your text…' : 'Type your email…'}
            />
            {channel === 'sms' && (
              <span className={`mt-1 block text-right text-xs ${tooLong ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>{body.length}/{SMS_LIMIT}</span>
            )}
          </div>

          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        </div>

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
