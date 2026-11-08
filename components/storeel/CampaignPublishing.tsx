// The Storeel stepper's "Publishing" card body (Chris, 8 Nov 2026 (b), point 2): the campaign page's Publish button is
// now Send, and every publish option is here instead — nothing removed. Not published: Publish as View Only / Public /
// Private (the access-token link), the same three choices and descriptions as the old Publish menu. Published: the
// campaign page's own published box (link, Copy, Share, QR, share message) and Unpublish. Every action is the campaign
// page's handlePublish (same calls, toasts and "Published!" modal as before).
import type { ReactNode } from 'react';
import { Eye, Globe, Lock } from 'lucide-react';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { PUBLISH_CHOICES, publishStatus, type PublishRole } from './lib/publishing';

const ICONS: Record<PublishRole, ReactNode> = {
  2: <Eye className="w-6 h-6 text-gray-600 flex-shrink-0 mt-0.5" aria-hidden="true" />,
  1: <Globe className="w-6 h-6 text-[#6C60FF] flex-shrink-0 mt-0.5" aria-hidden="true" />,
  3: <Lock className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" aria-hidden="true" />,
};

export interface CampaignPublishingProps {
  /** memories.published: 0 / null not published, 1 public, 2 view only, 3 private. */
  published: unknown;
  /** Only the owner could publish before; the same here. */
  canPublish: boolean;
  isPublishing: boolean;
  publishProgress: number;
  onPublish(role: PublishRole): void;
  onUnpublish(): void;
  /** The published box (components/campaign/PublishedLinkPanel), shown once published. */
  linkPanel?: ReactNode;
}

export default function CampaignPublishing({ published, canPublish, isPublishing, publishProgress, onPublish, onUnpublish, linkPanel }: CampaignPublishingProps) {
  const status = publishStatus(published);
  return (
    <div className="space-y-3" data-testid="st-publishing">
      <p className="text-sm text-gray-600">
        {status.live ? <>Published · <span className="font-medium text-gray-900">{status.label}</span></> : 'Not published'}
      </p>

      {isPublishing ? (
        <div role="status" className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-900">{status.live ? 'Unpublishing…' : 'Publishing Campaign...'}</span>
            {status.live ? null : <span className="text-gray-500">{publishProgress}%</span>}
          </div>
          {status.live ? null : <Progress value={publishProgress} className="h-2" />}
        </div>
      ) : null}

      {status.live ? (
        <>
          {linkPanel}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onUnpublish}
            disabled={isPublishing || !canPublish}
            className="hover:bg-red-500 hover:text-white border-red-500 text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Globe className="w-4 h-4 mr-2" aria-hidden="true" />
            Unpublish
          </Button>
        </>
      ) : (
        <div className="space-y-1">
          {PUBLISH_CHOICES.map((choice) => (
            <button
              key={choice.key}
              type="button"
              onClick={() => onPublish(choice.role)}
              disabled={isPublishing || !canPublish}
              className="w-full p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="flex items-start gap-3">
                {ICONS[choice.role]}
                <span className="flex-1">
                  <span className="block font-semibold text-gray-900 mb-1">{choice.title}</span>
                  <span className="block text-sm text-gray-500">{choice.description}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
