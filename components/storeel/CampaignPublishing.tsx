// The Storeel stepper's "Publishing" section (top of the Send card, Deepak 9 Nov 2026) (Chris, 8 Nov 2026 (b), point 2): the campaign page's Publish button is
// now Send, and every publish option is here instead — nothing removed. Not published: Publish as View Only / Public /
// Private (the access-token link), the same three choices and descriptions as the old Publish menu. Published: the
// campaign page's own published box (link, Copy, Share, QR, share message) and Unpublish. Every action is the campaign
// page's handlePublish (same calls, toasts and "Published!" modal as before).
// Chris 9 Nov 2026 (point 6): the three options are now ONE CHOICE (radio cards in the Send by Email / SMS card look),
// Public pre-selected when not published, the current mode when published. Tapping one publishes nothing: Save & Send
// applies it (PublishChoice → storeel-send publish_role). "Publish now" publishes (or switches a published campaign to)
// the chosen option without sending; Unpublish and the published box are as before.
import { useState, type ReactNode } from 'react';
import { Eye, Globe, Lock } from 'lucide-react';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { usePublishChoice } from './PublishChoice';
import {
  PUBLISH_CHOICES, PUBLISHING_SECTION_ID, canPublishNow, defaultPublishChoice, publishChoiceNote, publishStatus, publishingLine, rightAwayLine,
  type PublishRole,
} from './lib/publishing';

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
  /** Publish now: publish with this role, or switch a published campaign to it (never unpublishes). */
  onPublish(role: PublishRole): void;
  onUnpublish(): void;
  /** The published box (components/campaign/PublishedLinkPanel), shown once published. */
  linkPanel?: ReactNode;
}

export default function CampaignPublishing({ published, canPublish, isPublishing, publishProgress, onPublish, onUnpublish, linkPanel }: CampaignPublishingProps) {
  const status = publishStatus(published);
  // The shared choice (the Send step sends it); a local one if this card is ever shown outside the stepper.
  const shared = usePublishChoice();
  const [localRole, setLocalRole] = useState<PublishRole>(() => defaultPublishChoice(published));
  const choice = shared ? shared.role : localRole;
  const choose = shared ? shared.setRole : setLocalRole;
  // Which right-away action is running (a mode switch on a published campaign is a publish, not an unpublish).
  const [action, setAction] = useState<'publish' | 'unpublish'>('publish');
  const line = publishingLine(published);
  const note = publishChoiceNote(published, choice);
  const disabled = isPublishing || !canPublish;
  const publishNow = () => { setAction('publish'); onPublish(choice); };
  const unpublish = () => { setAction('unpublish'); onUnpublish(); };
  const unpublishing = action === 'unpublish' && status.live;

  return (
    <div className="space-y-3" data-testid="st-publishing">
      {status.live ? <p className="text-sm text-gray-600">Published · <span className="font-medium text-gray-900">{status.label}</span></p> : null}
      {line ? <p className="text-sm text-gray-600">{line}</p> : null}
      {/* Everything else here waits for Save Changes; these don't (review fix, 8 Nov 2026 (b)). */}
      <p className="text-xs text-gray-500">{rightAwayLine(published, choice)}</p>

      {/* One of three, in the Send by Email / SMS look (AudiencePicker channelBox): purple border + tint when chosen. */}
      <div role="radiogroup" aria-labelledby={`${PUBLISHING_SECTION_ID}-title`} className="space-y-2">
        {PUBLISH_CHOICES.map((option) => {
          const checked = choice === option.role;
          return (
            <label
              key={option.key}
              className={`flex items-start gap-3 rounded-lg border-2 p-3 transition-colors ${checked ? 'border-[#6C60FF] bg-[#6C60FF]/5' : 'border-gray-200 bg-white'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <input
                type="radio"
                name="st-publish-choice"
                value={option.role}
                checked={checked}
                disabled={disabled}
                onChange={() => choose(option.role)}
                className="mt-1 h-4 w-4 flex-shrink-0 accent-[#6C60FF]"
              />
              {ICONS[option.role]}
              <span className="flex-1">
                <span className="block font-semibold text-gray-900 mb-1">{option.title}</span>
                <span className="block text-sm text-gray-500">{option.description}</span>
              </span>
            </label>
          );
        })}
      </div>
      {note ? <p className="text-sm text-gray-600">{note}</p> : null}

      {isPublishing ? (
        <div role="status" className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-900">{unpublishing ? 'Unpublishing…' : 'Publishing Campaign...'}</span>
            {unpublishing ? null : <span className="text-gray-500">{publishProgress}%</span>}
          </div>
          {unpublishing ? null : <Progress value={publishProgress} className="h-2" />}
        </div>
      ) : null}

      {canPublishNow(published, choice) ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={publishNow}
          disabled={disabled}
          className="hover:bg-[#6C60FF] hover:text-white border-[#6C60FF] text-[#6C60FF] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Globe className="w-4 h-4 mr-2" aria-hidden="true" />
          Publish now
        </Button>
      ) : null}

      {status.live ? (
        <>
          {linkPanel}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={unpublish}
            disabled={disabled}
            className="hover:bg-red-500 hover:text-white border-red-500 text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Globe className="w-4 h-4 mr-2" aria-hidden="true" />
            Unpublish
          </Button>
        </>
      ) : null}
    </div>
  );
}
