import SegmentedSwitch from './SegmentedSwitch';
import type { CampaignType } from './lib/campaignType';

const OPTIONS = [
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'storeel', label: 'Storeel' },
] as const;

export default function CampaignTypeSwitch({ value, onChange }: { value: CampaignType; onChange(value: CampaignType): void }) {
  return <SegmentedSwitch label="Campaign type" options={OPTIONS} value={value} onChange={onChange} />;
}
