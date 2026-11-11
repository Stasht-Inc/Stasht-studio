import type { ComponentProps } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import LeadDetailsSidebar from '../LeadDetailsSidebar';

// Phone-only (< md) bottom sheet with everything the md+ "Contact Details" column
// shows (Chris 11 Nov: no split screen on phones — the thread fills the screen).
// Opened by tapping the lead's name in the drawer's top bar. Same look and z-order
// as LeadsFilterSheet so it sits above the drawer and the bottom nav.
type SidebarProps = Omit<ComponentProps<typeof LeadDetailsSidebar>, 'showTitle'>;

export default function LeadDetailsSheet({ open, onOpenChange, ...sidebar }: SidebarProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="md:hidden fixed inset-0 z-[10001] bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          data-testid="lead-details-sheet"
          className="md:hidden fixed inset-x-0 bottom-0 z-[10002] flex flex-col max-h-[85dvh] bg-white rounded-t-2xl shadow-2xl pb-[env(safe-area-inset-bottom)] focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=closed]:duration-200 data-[state=open]:duration-300"
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-gray-300" aria-hidden="true" />
          <div className="flex items-center justify-between px-5 pt-2">
            <DialogPrimitive.Title className="text-lg font-bold text-gray-900">Contact Details</DialogPrimitive.Title>
            <DialogPrimitive.Close aria-label="Close" className="h-9 w-9 -mr-1.5 inline-flex items-center justify-center rounded-full text-gray-500 active:bg-gray-100">
              <X className="w-5 h-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <LeadDetailsSidebar {...sidebar} showTitle={false} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
