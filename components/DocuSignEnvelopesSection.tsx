import { useState, useEffect, useRef } from 'react';
import { FileText, Download, ChevronDown, ChevronUp, RefreshCw, Clock, CheckCircle2, XCircle, Eye, Send } from 'lucide-react';
import { dashboardAPI } from '../utils/authUtils';

interface Envelope {
  envelope_id: string;
  document_name: string;
  recipient_email: string;
  recipient_name: string;
  status: 'sent' | 'delivered' | 'signed' | 'completed' | 'declined' | 'voided';
  signed_document_url?: string;
  created_at: string;
}

interface Props {
  memoryId: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  sent:      { label: 'Sent',      color: 'bg-blue-100 text-blue-700',   icon: <Send className="w-3 h-3" /> },
  delivered: { label: 'Delivered', color: 'bg-yellow-100 text-yellow-700', icon: <Eye className="w-3 h-3" /> },
  signed:    { label: 'Signed',    color: 'bg-green-100 text-green-700',  icon: <CheckCircle2 className="w-3 h-3" /> },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700',  icon: <CheckCircle2 className="w-3 h-3" /> },
  declined:  { label: 'Declined',  color: 'bg-red-100 text-red-700',     icon: <XCircle className="w-3 h-3" /> },
  voided:    { label: 'Voided',    color: 'bg-gray-100 text-gray-500',   icon: <XCircle className="w-3 h-3" /> },
};

export function DocuSignEnvelopesSection({ memoryId }: Props) {
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEnvelopes = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await dashboardAPI.docuSignGetEnvelopes(memoryId);
      if (res.success && res.data?.envelopes) {
        setEnvelopes(res.data.envelopes);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchEnvelopes();
    // Poll every 30 seconds for status updates
    intervalRef.current = setInterval(() => fetchEnvelopes(true), 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [memoryId]);

  const pendingEnvelopes = envelopes.filter(e => e.status !== 'completed' && e.status !== 'signed');

  if (loading || pendingEnvelopes.length === 0) return null;

  const hasPending = pendingEnvelopes.some(e => e.status === 'sent' || e.status === 'delivered');

  return (
    <div className="fixed bottom-6 right-6 z-[9000] w-80 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-[#6C60FF] cursor-pointer"
        onClick={() => setExpanded(prev => !prev)}
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-white" />
          <span className="text-sm font-semibold text-white">DocuSign Documents</span>
          <span className="bg-white/20 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full">
            {pendingEnvelopes.length}
          </span>
          {hasPending && (
            <span className="w-2 h-2 rounded-full bg-yellow-300 animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {refreshing && <RefreshCw className="w-3.5 h-3.5 text-white/70 animate-spin" />}
          {expanded ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronUp className="w-4 h-4 text-white" />}
        </div>
      </div>

      {/* Envelope list */}
      {expanded && (
        <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
          {pendingEnvelopes.map(env => {
            const cfg = STATUS_CONFIG[env.status] || STATUS_CONFIG['sent'];
            const isComplete = env.status === 'signed' || env.status === 'completed';
            const date = new Date(env.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            return (
              <div key={env.envelope_id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                {/* Doc name + status */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-900 truncate">{env.document_name || 'Document'}</span>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${cfg.color}`}>
                    {cfg.icon}
                    {cfg.label}
                  </span>
                </div>

                {/* Recipient */}
                <p className="text-xs text-gray-500 mb-1">
                  To: <span className="text-gray-700">{env.recipient_name}</span>
                  {' '}({env.recipient_email})
                </p>

                {/* Date */}
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                  <Clock className="w-3 h-3" />
                  <span>{date}</span>
                </div>

                {/* Download button when signed */}
                {isComplete && env.signed_document_url && (
                  <a
                    href={env.signed_document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold transition-colors border border-green-200"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Signed PDF
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer refresh hint */}
      {expanded && hasPending && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">Auto-refreshes every 30s</span>
          <button
            onClick={() => fetchEnvelopes(true)}
            className="text-xs text-[#6C60FF] hover:underline font-medium"
          >
            Refresh now
          </button>
        </div>
      )}
    </div>
  );
}
