import type { ReactNode } from 'react';
import { Clock, Code, FileText, MessageSquare, Mic, Pointer, ShoppingCart, Sparkles, Upload, Video } from 'lucide-react';
import { PopoverClose } from '../ui/popover';
import type { AddWidgetKind, AddWidgetOption } from './addWidgetOptions';

export type { AddWidgetKind, AddWidgetOption } from './addWidgetOptions';
export { addWidgetOptions } from './addWidgetOptions';

/** Each option's icon, as the campaign page's desktop chooser draws it. */
const ICONS: Record<AddWidgetKind, ReactNode> = {
  moment: <Clock className="w-5 h-5 text-[#009689]" />,
  cta: <Pointer className="w-5 h-5 text-[#6C60FF]" />,
  request_moment: <Upload className="w-5 h-5 text-[#6C60FF]" />,
  voice: <Mic className="w-5 h-5 text-[#6C60FF]" />,
  html: <Code className="w-5 h-5 text-[#6C60FF]" />,
  youtube: <Video className="w-5 h-5 text-[#FF4444]" />,
  quote: <MessageSquare className="w-5 h-5 text-[#F59E0B]" />,
  ai_creator: <Sparkles className="w-5 h-5 text-[#6C60FF]" />,
  shopify_product: (
    <span className="flex h-full w-full items-center justify-center rounded-[8px]" style={{ background: 'linear-gradient(145deg, #95BF47, #5E8E3E)' }}>
      <ShoppingCart className="w-5 h-5 text-white" />
    </span>
  ),
  docusign: <FileText className="w-5 h-5 text-[#1464A5]" />,
};

/**
 * The campaign page's "+" → "Add Widget" chooser body (images/198.jpg): "Add Widget", "Choose a widget to add to your
 * timeline", then the options. Put it inside a PopoverContent (`w-80 p-0 rounded-xl …`); picking an option closes the
 * popover and calls `onPick`. Chris, 8 Nov 2026 (point 1): the campaign page and the Storeel preview use this one.
 */
export function AddWidgetMenu({ options, onPick, headingClassName = 'text-base' }: {
  options: ReadonlyArray<AddWidgetOption>;
  onPick(kind: AddWidgetKind): void;
  headingClassName?: string;
}) {
  return (
    <div data-testid="add-widget-chooser">
      <div className="p-4 pb-2">
        <h4 className={`${headingClassName} font-semibold text-gray-900`}>Add Widget</h4>
        <p className="text-sm text-gray-500">Choose a widget to add to your timeline</p>
      </div>
      <div className="max-h-[320px] overflow-y-auto" role="menu" aria-label="Add Widget">
        {options.map((item) => (
          <PopoverClose asChild key={item.kind}>
            <button
              type="button"
              role="menuitem"
              data-widget-kind={item.kind}
              className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none cursor-pointer transition-colors"
              onClick={() => onPick(item.kind)}
            >
              <div className="w-10 h-10 flex-shrink-0 rounded-[8px] bg-gray-50 flex items-center justify-center">{ICONS[item.kind]}</div>
              <div>
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            </button>
          </PopoverClose>
        ))}
      </div>
    </div>
  );
}

/** The chooser's popover panel classes (the campaign page's). */
export const ADD_WIDGET_PANEL = 'w-80 p-0 rounded-xl shadow-lg border border-gray-200 bg-white';
