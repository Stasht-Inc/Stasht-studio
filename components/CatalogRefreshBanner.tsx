import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { catalogueAPI, type CampaignCatalogueStatus } from '../services/catalogueAPI';

interface CatalogRefreshBannerProps {
  memoryId: string;
  // Reload the campaign's posts and widgets after a refresh (MemoryDetailsPage.fetchMemoryDetails).
  onRefreshed: () => Promise<void> | void;
}

// "N items changed on your website since this campaign was made · Refresh from catalogue"
// (spec 2026-09-30 §9.4). Shown to the owner of a Website Catalogue campaign whose items changed or
// left the website; renders nothing for every other campaign. Refresh only runs when clicked.
export default function CatalogRefreshBanner({ memoryId, onRefreshed }: CatalogRefreshBannerProps) {
  const [status, setStatus] = useState<CampaignCatalogueStatus | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await catalogueAPI.getCampaignStatus(memoryId);
    setStatus(res.ok && res.data ? res.data : null);
  }, [memoryId]);

  useEffect(() => {
    setStatus(null);
    load();
  }, [load]);

  const pending = status ? status.changed + status.retired : 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    const res = await catalogueAPI.refreshCampaign(memoryId);
    setRefreshing(false);
    setConfirmOpen(false);
    if (!res.ok || !res.data) {
      toast.error(res.error || 'Could not refresh from your catalogue. Please try again.');
      return;
    }
    const updated = res.data.refreshed + res.data.retired;
    toast.success(`Updated ${updated} ${updated === 1 ? 'moment' : 'moments'} from your website`);
    await onRefreshed();
    await load();
  };

  if (!status || !status.can_refresh || pending === 0) return null;

  return (
    <>
      <div
        role="status"
        className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
      >
        <span className="flex items-center gap-2 min-w-0">
          <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{pending} {pending === 1 ? 'item' : 'items'} changed on your website since this campaign was made</span>
        </span>
        <span className="hidden sm:inline text-yellow-400" aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="self-start sm:self-auto font-semibold text-[#5A4FE5] hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]"
        >
          Refresh from catalogue
        </button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(next) => { if (!refreshing) setConfirmOpen(next); }}>
        <AlertDialogContent className="sm:max-w-md bg-white border-0 shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Refresh from catalogue?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 leading-relaxed">
              {pending} {pending === 1 ? 'moment' : 'moments'} will be updated with the latest photos, price and details from your
              website. Any changes you made to {pending === 1 ? "that moment's" : "those moments'"} descriptions will be overwritten.
              Items no longer on your website are marked "No longer available" and their "View on website" button is hidden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={refreshing} className="border-gray-200 hover:bg-gray-50">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleRefresh(); }}
              disabled={refreshing}
              className="bg-[#6C60FF] hover:bg-[#5B4FE8] text-white"
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
