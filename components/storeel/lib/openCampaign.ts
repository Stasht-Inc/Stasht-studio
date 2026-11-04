// Step 2 Moments' "Add moments on the campaign page" (Chris, 4 Nov 2026, point 9): App opens the campaign page.
// Create Campaign can be opened from the Campaigns page, the Sidebar or a campaign page, so it asks App by event.
export const OPEN_CAMPAIGN_EVENT = 'stasht-open-campaign';

export function requestOpenCampaign(memoryId: number): void {
  window.dispatchEvent(new CustomEvent(OPEN_CAMPAIGN_EVENT, { detail: { memoryId } }));
}
