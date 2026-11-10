import { Building2 } from 'lucide-react';
import type { Lead } from '../../services/leadsAPI';

/**
 * Which business a lead is for, on leads of another account shown in your own Leads list (team leads, Chris 10 Nov
 * 2026: "she should have seen the lead in her account"). Same height/radius/type size as CampaignDeletedTag.
 * Renders nothing for your own account's leads.
 */
export default function LeadBusinessTag({ lead, className = '' }: { lead: Pick<Lead, 'account'>; className?: string }) {
  const name = lead.account?.name?.trim();
  if (!lead.account) return null;
  return (
    <span
      title={`Lead for ${name || 'another business'}`}
      data-lead-business
      className={`shrink-0 inline-flex items-center gap-1 h-5 max-w-[12rem] px-1.5 rounded border border-[#6C60FF]/20 bg-[#6C60FF]/10 text-[12px] font-medium text-[#4a40d4] whitespace-nowrap ${className}`}
    >
      <Building2 className="w-3 h-3 shrink-0" aria-hidden />
      <span className="truncate">{name || 'Another business'}</span>
    </span>
  );
}
