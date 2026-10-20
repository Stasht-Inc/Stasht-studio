/** The "INBOX" line of the preview: sender avatar, from name, subject, preview text (prototype). */
export default function InboxRow({ fromName, subject, previewText, initial, photoUrl, color = null }: {
  fromName: string;
  subject: string;
  previewText: string;
  initial: string;
  photoUrl: string | null;
  /** The account's profile_color, if any, fills the initials circle. */
  color?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-gray-100 px-4 py-3">
      {photoUrl ? (
        <img src={photoUrl} alt="" className="h-7 w-7 flex-shrink-0 rounded-full object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${color ? 'text-white' : 'bg-[#6C60FF]/10 text-[#6C60FF]'}`}
          style={color ? { backgroundColor: color } : undefined}
        >
          {initial}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900">{fromName.trim() || 'Your Name'}</p>
        <p className="truncate text-sm font-semibold text-gray-900">{subject.trim() || 'Your subject line'}</p>
        <p className="truncate text-xs text-gray-500">{previewText.trim() || 'Preview text will appear here…'}</p>
      </div>
    </div>
  );
}
