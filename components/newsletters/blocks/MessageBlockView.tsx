import { useMemo } from 'react';
import type { TextBlockData } from '../../../services/newslettersAPI';
import { parseTextHtml } from '../lib/textHtml';
import { TEXT_CLASS, renderTextNodes } from './TextBlockEditor';

/**
 * The Message section (Chris, 31 Oct): the Message box's text at the top of the email. Not editable here, so it can't
 * get out of step with the box (the box rewrites it on every change); it is drawn again from its HTML each time.
 * It can still be moved or deleted from its frame.
 */
export default function MessageBlockView({ data, selected, readOnly }: { data: TextBlockData; selected: boolean; readOnly: boolean }) {
  const nodes = useMemo(() => renderTextNodes(parseTextHtml(data.html)), [data.html]);
  return (
    <div>
      {selected && !readOnly ? (
        <p className="mb-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">This is your Message — edit it in the Message box.</p>
      ) : null}
      <div className={`break-words ${TEXT_CLASS}`}>{nodes}</div>
    </div>
  );
}
