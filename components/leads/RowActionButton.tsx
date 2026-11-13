import { forwardRef, type ComponentType } from 'react';
import { Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

// Round icon button with a dark tooltip, for the Leads list's hover actions.
// forwardRef + prop spreading so it can sit inside a DropdownMenuTrigger asChild;
// the trigger's own data-state then wins, so an open menu keeps the button lit.

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: ComponentType<{ className?: string }>;
  busy?: boolean;
  // neutral: darker gray on hover / open instead of the brand purple (Chris: active states gray, 13 Nov 2026).
  tone?: 'brand' | 'neutral';
};

const TONE = {
  brand: 'hover:bg-[#6C60FF] hover:text-white focus-visible:ring-[#6C60FF] data-[state=open]:bg-[#6C60FF] data-[state=open]:text-white',
  neutral: 'hover:bg-gray-200 hover:text-gray-900 focus-visible:ring-gray-400 data-[state=open]:bg-gray-200 data-[state=open]:text-gray-900',
};

const RowActionButton = forwardRef<HTMLButtonElement, Props>(function RowActionButton(
  { label, icon: Icon, busy = false, tone = 'brand', className = '', ...rest },
  ref,
) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          type="button"
          aria-label={label}
          {...rest}
          className={`h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-full text-gray-500 transition-colors ${TONE[tone]} focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-gray-500 ${className}`}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className="bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-md">
        {label}
      </TooltipContent>
    </Tooltip>
  );
});

export default RowActionButton;
