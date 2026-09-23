import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Mail, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
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

  const tab = (value: 'sms' | 'email', label: string, Icon: typeof MessageSquare) => (
    <button
      type="button"
      aria-pressed={channel === value}
      onClick={() => setChannel(value)}
      className={`flex-1 h-10 inline-flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${channel === value ? 'bg-[#6C60FF] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
    >
      <Icon className="w-4 h-4" />{label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!sending) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl">Start a new message</DialogTitle>
          <DialogDescription className="text-gray-600">Text or email anyone. The conversation shows up in your Leads.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {tab('sms', 'Text (SMS)', MessageSquare)}
            <span className="w-px bg-gray-200" />
            {tab('email', 'Email', Mail)}
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-800">Name <span className="text-gray-500 font-normal">(optional)</span></span>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-10" autoComplete="off" />
          </label>

          {channel === 'sms' ? (
            <label className="block">
              <span className="text-sm font-medium text-gray-800">Phone number *</span>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" inputMode="tel" className="mt-1 h-10" autoComplete="off" />
            </label>
          ) : (
            <>
              <label className="block">
                <span className="text-sm font-medium text-gray-800">Email *</span>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" type="email" className="mt-1 h-10" autoComplete="off" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-800">Subject <span className="text-gray-500 font-normal">(optional)</span></span>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 h-10" />
              </label>
            </>
          )}

          {properties.length > 1 && (
            <div>
              <span className="text-sm font-medium text-gray-800">Send from *</span>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger className="mt-1 h-10"><SelectValue placeholder="Choose a dealership" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <span className="text-sm font-medium text-gray-800">Attach a campaign <span className="text-gray-500 font-normal">(optional — adds its link)</span></span>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger className="mt-1 h-10"><SelectValue placeholder="No campaign" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={NO_CAMPAIGN}>No campaign</SelectItem>
                {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-800">Message *</span>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className="mt-1 text-base" />
            {channel === 'sms' && (
              <span className={`mt-1 block text-right text-sm ${tooLong ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>{body.length}/{SMS_LIMIT}</span>
            )}
          </label>

          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1 h-11" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button className="flex-1 h-11 bg-[#6C60FF] hover:bg-[#5A4FE5] text-white" onClick={send} disabled={!canSend}>
            {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</> : 'Send'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
