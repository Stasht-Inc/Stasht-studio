import { useEffect, useState } from 'react';
import LeadsTab from '../components/LeadsTab';
import LeadDetailDrawer from '../components/LeadDetailDrawer';
import GroupDetailDrawer from '../components/GroupDetailDrawer';
import ConversationDrawer from '../components/ConversationDrawer';
import { Lead, CommentaryTarget, Conversation, leadsAPI } from '../services/leadsAPI';
import { apiRequest } from '../utils/authUtils';
import { useAuth } from '../contexts/AuthContext';

interface LeadsPageProps {
  // Set by App when a lead_message notification is clicked; consumed (and cleared)
  // here by opening that lead's "My Conversations" thread.
  openConversationLeadId?: number | null;
  onConversationOpened?: () => void;
  onNavigate?: (page: string) => void;
  onViewStoreelReport?: (propertyId?: number | string, propertyName?: string) => void;
}

// Leads — its own top-level page (previously the first tab of the Users page).
export default function LeadsPage({ openConversationLeadId, onConversationOpened, onNavigate, onViewStoreelReport }: LeadsPageProps = {}) {
  const { isAuthenticated } = useAuth();

  // Lead / group / conversation panel state
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [leadsRefreshTrigger, setLeadsRefreshTrigger] = useState(0);
  const [leadsStatusFilter, setLeadsStatusFilter] = useState('all');
  const [commentaryTarget, setCommentaryTarget] = useState<CommentaryTarget | null>(null);
  // Full breakdown from GET /leads/unread-count, threaded down to LeadsTab for the
  // Groups sub-tab's unread summary cards — avoids a second call for the same data.
  const [leadsUnreadBreakdown, setLeadsUnreadBreakdown] = useState<{ total_unread_messages: number; total_unread_comments: number; total_unread: number } | null>(null);

  // Same source as the Sidebar's Leads badge. Refreshes on the shared event so both
  // stay in sync when leads are read.
  const fetchLeadsUnreadCount = () => {
    if (!isAuthenticated) return;
    apiRequest('/leads/unread-count', { method: 'GET' }).then((data: any) => {
      const payload = data?.data ?? data ?? {};
      const unread = payload?.total_unread ?? 0;
      setLeadsUnreadBreakdown({
        total_unread_messages: typeof payload?.total_unread_messages === 'number' ? payload.total_unread_messages : 0,
        total_unread_comments: typeof payload?.total_unread_comments === 'number' ? payload.total_unread_comments : 0,
        total_unread: typeof unread === 'number' ? unread : 0,
      });
    }).catch(() => {});
  };

  useEffect(() => {
    fetchLeadsUnreadCount();
  }, [isAuthenticated]);

  useEffect(() => {
    window.addEventListener('leads-unread-count-refresh', fetchLeadsUnreadCount);
    return () => window.removeEventListener('leads-unread-count-refresh', fetchLeadsUnreadCount);
  }, [isAuthenticated]);

  // Deep-link from a lead_message notification: open the matching conversation
  // thread, then clear the pending id so it doesn't reopen.
  useEffect(() => {
    if (!openConversationLeadId) return;
    let cancelled = false;
    (async () => {
      setSelectedLead(null);
      setSelectedGroupId(null);
      try {
        const res = await leadsAPI.getMyConversations();
        if (!cancelled && res.success && res.data) {
          const match = (res.data.conversations ?? []).find((c) => c.lead_id === openConversationLeadId);
          if (match) setSelectedConversation(match);
        }
      } catch {
        // ignore — nothing to open
      } finally {
        onConversationOpened?.();
      }
    })();
    return () => { cancelled = true; };
  }, [openConversationLeadId]);

  const isPanelOpen = !!selectedLead || !!selectedGroupId || !!selectedConversation;
  // A selected lead takes over the whole page (Chris's full-view design);
  // group / conversation panels keep the 30% side panel.
  const isLeadFullView = !!selectedLead;

  return (
    // The app header is 5rem tall, so in full view the page is exactly the space
    // under it and only the thread scrolls (see LeadDetailDrawer).
    <div className={`flex bg-white ${isLeadFullView ? 'sm:h-[calc(100dvh-5rem)] sm:overflow-hidden' : 'min-h-[calc(100dvh-5rem)]'}`}>

      {/* LEFT: page content — shrinks when a group/conversation panel is open, hidden
          (but kept mounted, so filters/search/scroll survive) in lead full view */}
      <div className={`transition-all duration-300 min-w-0 ${isLeadFullView ? 'hidden' : isPanelOpen ? 'hidden sm:block sm:w-[70%]' : 'w-full'}`}>
        <div className="py-2 sm:p-3 md:p-4">
          <div className="w-full sm:px-3 bg-white">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
              <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900">Leads</h1>
              <p className="text-xs sm:text-sm md:text-base text-gray-600 mt-0.5 sm:mt-1">Follow up with the people engaging with your campaigns</p>
            </div>

            <LeadsTab
              selectedLead={selectedLead}
              onLeadSelect={(lead) => { setSelectedLead(lead); if (lead) { setSelectedGroupId(null); setSelectedConversation(null); } }}
              selectedGroupId={selectedGroupId}
              onGroupSelect={(id) => { setSelectedGroupId(id); if (id) { setSelectedLead(null); setSelectedConversation(null); } }}
              selectedConversationId={selectedConversation?.lead_id ?? null}
              onConversationSelect={(conv) => { setSelectedConversation(conv); if (conv) { setSelectedLead(null); setSelectedGroupId(null); } }}
              refreshTrigger={leadsRefreshTrigger}
              compact={isPanelOpen}
              unreadBreakdown={leadsUnreadBreakdown}
              onLeadsRefreshed={(leads) => {
                if (selectedLead) {
                  const updated = leads.find((l) => l.id === selectedLead.id);
                  if (updated) setSelectedLead(updated);
                }
              }}
              onFilterChange={setLeadsStatusFilter}
              onCommentaryJump={(lead, target) => {
                setSelectedLead(lead);
                setCommentaryTarget(target);
              }}
              onViewStoreelReport={onViewStoreelReport ? () => onViewStoreelReport() : undefined}
            />
          </div>
        </div>
      </div>

      {/* RIGHT: lead full view, or group / conversation side panel */}
      {isPanelOpen && (
        <div className={isLeadFullView
          ? 'fixed inset-0 z-[60] bg-white flex flex-col sm:static sm:inset-auto sm:z-auto sm:flex-1 sm:min-w-0 sm:h-full sm:overflow-hidden'
          : 'fixed inset-0 z-[60] bg-white flex flex-col sm:static sm:inset-auto sm:z-auto sm:w-[30%] sm:border-l sm:border-gray-200 sm:sticky sm:top-20 sm:h-[calc(100dvh-5rem)] sm:overflow-hidden'}>
          {selectedLead ? (
            <LeadDetailDrawer
              lead={selectedLead}
              open={true}
              highlightTarget={commentaryTarget}
              onTargetHandled={() => setCommentaryTarget(null)}
              onNavigate={onNavigate}
              onClose={() => {
                setSelectedLead(null);
                setCommentaryTarget(null);
                setLeadsRefreshTrigger((t) => t + 1);
                window.dispatchEvent(new CustomEvent('leads-unread-count-refresh'));
              }}
              onRefreshLead={async () => {
                setLeadsRefreshTrigger((t) => t + 1);
              }}
              isArchived={leadsStatusFilter === 'archived'}
            />
          ) : selectedGroupId ? (
            <GroupDetailDrawer
              groupId={selectedGroupId}
              open={true}
              onClose={() => setSelectedGroupId(null)}
            />
          ) : (
            <ConversationDrawer
              conversation={selectedConversation}
              open={true}
              onClose={() => setSelectedConversation(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
