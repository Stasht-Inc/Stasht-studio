import type { BlockType, NewsletterBlock } from '../../../services/newslettersAPI';
import ImageBlockEditor from './ImageBlockEditor';
import TitleBlockEditor from './TitleBlockEditor';
import TextBlockEditor from './TextBlockEditor';
import YoutubeBlockEditor from './YoutubeBlockEditor';
import ButtonBlockEditor from './ButtonBlockEditor';
import DividerBlockEditor from './DividerBlockEditor';

export const BLOCK_LABEL: Record<BlockType, string> = {
  image: 'Image', title: 'Title', text: 'Text', youtube: 'YouTube', button: 'Button', divider: 'Divider',
};

export default function BlockEditor({ block, selected, readOnly, onChange }: {
  block: NewsletterBlock;
  selected: boolean;
  readOnly: boolean;
  onChange(data: Record<string, unknown>): void;
}) {
  const common = { blockId: block.id, selected, readOnly, onChange };
  switch (block.type) {
    case 'image': return <ImageBlockEditor {...common} data={block.data} />;
    case 'title': return <TitleBlockEditor {...common} data={block.data} />;
    case 'text': return <TextBlockEditor {...common} data={block.data} />;
    case 'youtube': return <YoutubeBlockEditor {...common} data={block.data} />;
    case 'button': return <ButtonBlockEditor {...common} data={block.data} />;
    default: return <DividerBlockEditor {...common} data={block.data} />;
  }
}
