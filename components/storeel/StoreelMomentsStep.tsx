import { ExternalLink } from 'lucide-react';
import StepCard from '../newsletters/StepCard';
import { BUTTON_SECONDARY } from '../newsletters/lib/ui';
import { momentsLabel } from './storeelPreview';
import { stepNumber, type StepStatus } from './lib/storeelFlow';

export const MOMENTS_STEP_ID = 'st-step-moments';

/**
 * Step 2 Moments (Chris, 4 Nov 2026, point 9; Deepak: a link, no moments editor in the flow): how many moments the
 * campaign has, and a button to the campaign page where they are added. Coming back resumes on step 3 Send.
 */
export default function StoreelMomentsStep({ status, moments, onOpenCampaign }: {
  status: StepStatus;
  /** The saved campaign's moments (null until Set up is saved). */
  moments: number | null;
  onOpenCampaign(): void;
}) {
  return (
    <StepCard number={stepNumber('moments')} title="Moments" id={MOMENTS_STEP_ID} aside={moments === null ? undefined : momentsLabel(moments)}>
      {status === 'locked' ? (
        <p className="text-sm text-gray-500">{moments === null ? 'Add more photos and videos on the campaign page once Set up is saved.' : 'Press Continue to save Set up, then add moments on the campaign page.'}</p>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600">Add photos and videos on the campaign page, then come back here to send it.</p>
          <button type="button" onClick={onOpenCampaign} className={`${BUTTON_SECONDARY} flex-shrink-0`}>
            <ExternalLink className="h-4 w-4" aria-hidden="true" />Add moments on the campaign page
          </button>
        </div>
      )}
    </StepCard>
  );
}
