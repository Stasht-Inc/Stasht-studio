import { memo } from 'react';
import type { BlockType, CampaignItem, NewsletterBlock } from '../../../services/newslettersAPI';
import ImageBlockEditor from './ImageBlockEditor';
import TitleBlockEditor from './TitleBlockEditor';
import TextBlockEditor from './TextBlockEditor';
import YoutubeBlockEditor from './YoutubeBlockEditor';
import ButtonBlockEditor from './ButtonBlockEditor';
import DividerBlockEditor from './DividerBlockEditor';
import CampaignsBlockEditor from './CampaignsBlockEditor';

export const BLOCK_LABEL: Record<BlockType, string> = {
  image: 'Image', title: 'Title', text: 'Text', youtube: 'YouTube', button: 'Button', divider: 'Divider', campaigns: 'Campaigns',
};

function BlockEditor({ block, selected, readOnly, onChange, serverItems, accent, onPick, phone = false }: {
  block: NewsletterBlock;
  selected: boolean;
  readOnly: boolean;
  onChange(data: Record<string, unknown>): void;
  /** Campaigns: the saved copy's cards, the button colour and the picker. */
  serverItems?: CampaignItem[];
  accent?: string | null;
  onPick?(): void;
  /** The preview's phone view (a Campaigns section shows one column then). */
  phone?: boolean;
}) {
  const common = { blockId: block.id, selected, readOnly, onChange };
  switch (block.type) {
    case 'image': return <ImageBlockEditor {...common} data={block.data} />;
    case 'title': return <TitleBlockEditor {...common} data={block.data} />;
    case 'text': return <TextBlockEditor {...common} data={block.data} />;
    case 'youtube': return <YoutubeBlockEditor {...common} data={block.data} />;
    case 'button': return <ButtonBlockEditor {...common} data={block.data} />;
    case 'campaigns': return <CampaignsBlockEditor {...common} data={block.data} serverItems={serverItems} accent={accent} onPick={onPick} phone={phone} />;
    default: return <DividerBlockEditor {...common} data={block.data} />;
  }
}

export default memo(BlockEditor);
