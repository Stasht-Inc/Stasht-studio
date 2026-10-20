import * as Popover from '@radix-ui/react-popover';
import { Loader2, Send } from 'lucide-react';
import type { NewsletterChannel } from '../../services/newslettersAPI';
import { moveFocusWithArrows } from './arrowKeys';
import { LAYER, LINK_BUTTON } from './lib/ui';

/** Email only: one button. With Text on: a small menu, "Email me a test" / "Text me a test". */
export default function SendTestButton({ channels, busy, onSend }: { channels: NewsletterChannel[]; busy: boolean; onSend(channel: NewsletterChannel): void }) {
  const icon = busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />;
  if (!channels.includes('sms')) {
    return <button type="button" onClick={() => onSend('email')} disabled={busy} className={LINK_BUTTON}>{icon}Send a test to me</button>;
  }
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" disabled={busy} className={LINK_BUTTON}>{icon}Send a test to me</button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" align="start" sideOffset={6} style={{ zIndex: LAYER.popover }}
          className="w-56 rounded-xl border border-gray-200 bg-white p-1 shadow-lg outline-none">
          <div role="menu" aria-label="Send a test" onKeyDown={moveFocusWithArrows}>
            {(['email', 'sms'] as NewsletterChannel[]).map((channel) => (
              <Popover.Close asChild key={channel}>
                <button type="button" role="menuitem" onClick={() => onSend(channel)}
                  className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none">
                  {channel === 'email' ? 'Email me a test' : 'Text me a test'}
                </button>
              </Popover.Close>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
