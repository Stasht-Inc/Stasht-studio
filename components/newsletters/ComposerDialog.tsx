import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { LAYER } from './lib/ui';

/** Dialogs opened from inside Create Campaign (portal at z-index 99999) must sit above it: components/ui/dialog is z-50. */
export default function ComposerDialog({ open, onOpenChange, title, description, wide = false, footer, children }: {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description?: string;
  wide?: boolean;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" style={{ zIndex: LAYER.dialog }} />
        <Dialog.Content
          style={{ zIndex: LAYER.dialog }}
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={`fixed left-1/2 top-1/2 flex max-h-[90vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-white shadow-xl outline-none ${wide ? 'max-w-[760px]' : 'max-w-lg'}`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold text-gray-900">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-0.5 text-sm text-gray-500">{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close aria-label="Close" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div> : null}
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-5 py-4">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
