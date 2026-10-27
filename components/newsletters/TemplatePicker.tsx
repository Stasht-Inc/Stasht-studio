import { forwardRef, type ButtonHTMLAttributes, type ReactElement } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { AlignJustify, CircleCheck, LayoutGrid, Menu, Sparkles } from 'lucide-react';
import type { NewsletterTemplate } from '../../services/newslettersAPI';
import { LAYER } from './lib/ui';

const TEMPLATES = [
  { id: 'basic', name: 'Basic', desc: 'Simple single-column layout', Icon: AlignJustify, ready: true },
  { id: 'featured', name: 'Featured', desc: 'Hero image + content blocks', Icon: LayoutGrid, ready: false },
  { id: 'minimal', name: 'Minimal', desc: 'Clean text-focused design', Icon: Menu, ready: false },
  { id: 'promotional', name: 'Promotional', desc: 'Bold CTAs and offers', Icon: Sparkles, ready: false },
] as const;

type CardProps = ButtonHTMLAttributes<HTMLButtonElement> & { name: string; desc: string; Icon: typeof AlignJustify; selected: boolean };

const TemplateCard = forwardRef<HTMLButtonElement, CardProps>(function TemplateCard({ name, desc, Icon, selected, ...rest }, ref) {
  return (
    <button ref={ref} type="button" aria-pressed={selected} {...rest}
      className={`relative flex w-full min-w-0 items-start gap-3 rounded-xl px-4 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40 disabled:cursor-default ${selected ? 'border-2 border-[#6C60FF] bg-[#6C60FF]/5' : 'border border-gray-200 bg-white hover:border-gray-300'}`}>
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-900" aria-hidden="true" />
      <span className="min-w-0 pr-5">
        <span className="block text-sm font-semibold text-gray-900">{name}</span>
        <span className="block text-sm text-gray-600">{desc}</span>
      </span>
      {selected ? <CircleCheck className="absolute right-3 top-3 h-4 w-4 fill-[#6C60FF] text-white" aria-hidden="true" /> : null}
    </button>
  );
});

function ComingSoon({ name, children }: { name: string; children: ReactElement }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" align="center" sideOffset={8} collisionPadding={12} style={{ zIndex: LAYER.popover }}
          className="w-[min(16rem,calc(100vw-1.5rem))] rounded-xl border border-gray-200 bg-white p-4 shadow-lg outline-none">
          <p className="text-sm font-semibold text-gray-900">Coming soon</p>
          <p className="mt-1 text-sm text-gray-600">{name} is on its way. Basic is ready to use now.</p>
          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Step 5 (prototype): Basic works; the other templates and "Design from scratch" say Coming soon. */
export default function TemplatePicker({ value, readOnly }: { value: NewsletterTemplate; readOnly: boolean }) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-gray-900">Choose a template</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {TEMPLATES.map((t) => (t.ready ? (
          <TemplateCard key={t.id} name={t.name} desc={t.desc} Icon={t.Icon} selected={value === t.id} disabled={readOnly} />
        ) : (
          <ComingSoon key={t.id} name={`The ${t.name} template`}>
            <TemplateCard name={t.name} desc={t.desc} Icon={t.Icon} selected={false} aria-haspopup="dialog" />
          </ComingSoon>
        )))}
      </div>
      <ComingSoon name="Design from scratch">
        <button type="button" aria-haspopup="dialog"
          className="mt-3 w-full rounded-xl border-2 border-dashed border-gray-200 py-4 text-sm font-medium text-[#6C60FF] hover:bg-[#6C60FF]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
          + Design from scratch
        </button>
      </ComingSoon>
      <p className="mt-3 text-xs text-gray-500">Edit your email in the preview: tap any part to change it, and tap + to add a section.</p>
    </div>
  );
}
