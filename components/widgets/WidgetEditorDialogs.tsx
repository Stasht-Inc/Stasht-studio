import { Download, ImageIcon, Sparkles, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Switch } from '../ui/switch';
import { IMAGE_ACCEPT } from '../../utils/uploadFiles';
import { sanitizeAiCreatorText } from '../../utils/memoryUtils';
import { CTA_DEFAULT_BUTTON_COLOR, CTA_DEFAULT_TEXT_COLOR, CTA_ICON_KEYS, CTA_ICONS, ctaIsValidUrl, ctaModalNoun, type CtaForm } from './ctaWidget';

/**
 * The widget editors of the campaign page's "+" (HTML, YouTube, Quote, AI Creator, Call to Action / Share Request a
 * Moment), moved here unchanged from pages/MemoryDetailsPage.tsx so Create Storeel opens the very same editors
 * (Deepak 24 Nov 2026, P1: "If it is a given option it needs to work here itself"). Display and fields only: the
 * fields are the caller's state, and Save / Generate are the caller's — the campaign page saves to the campaign at
 * once, Create Storeel keeps the widget in its preview until Save as Draft / Save & Send.
 * Closing (✕, Cancel, Escape, outside) is onOpenChange(false); the caller clears its fields there.
 */

interface EditorBase {
  open: boolean;
  onOpenChange(open: boolean): void;
  onSubmit(): void;
}

export function HtmlWidgetDialog({ open, onOpenChange, onSubmit, editing, title, onTitleChange, content, onContentChange }: EditorBase & {
  editing: boolean; title: string; onTitleChange(v: string): void; content: string; onContentChange(v: string): void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none md:max-w-[800px] w-full h-full md:h-auto md:w-[calc(100%-30px)] md:max-h-[90vh] bg-white p-0 md:p-6 border-0 shadow-xl md:rounded-lg rounded-none top-0 left-0 translate-x-0 translate-y-0 md:top-[50%] md:left-[50%] md:translate-x-[-50%] md:translate-y-[-50%] flex flex-col [&>button[data-slot=dialog-default-close]]:hidden md:[&>button[data-slot=dialog-default-close]]:flex">
        {/* Mobile Header with title + close */}
        <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <h4 className="font-semibold text-[18px] md:text-lg text-gray-900">{editing ? 'Edit HTML' : 'Add HTML'}</h4>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" className="h-10 w-10 p-0 hover:bg-gray-100 rounded-full">
              <X className="!w-[28px] !h-[28px] text-black" />
            </Button>
          </DialogClose>
        </div>
        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 md:px-0 md:pt-0 md:pb-0">
          <div className="space-y-5 md:space-y-4">
            <DialogHeader className="space-y-1 pb-2 text-left hidden md:block">
              <DialogTitle className="text-xl md:text-lg font-semibold text-gray-900">{editing ? 'Edit HTML' : 'Add HTML'}</DialogTitle>
            </DialogHeader>
            <div>
              <label className="text-[14px] md:text-sm font-medium text-gray-700">Title (Optional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Enter a title for this HTML block"
                className="mt-1.5 w-full h-12 md:h-10 px-4 md:px-3 border border-gray-300 rounded-lg text-[14px] md:text-sm focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]"
              />
            </div>
            <div>
              <label className="text-[14px] md:text-sm font-medium text-gray-700">HTML Content</label>
              <textarea
                value={content}
                onChange={(e) => onContentChange(e.target.value)}
                placeholder="Paste your HTML code here..."
                rows={10}
                className="mt-1.5 w-full px-4 md:px-3 py-3 md:py-2.5 border border-gray-300 rounded-lg text-[14px] md:text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]"
              />
              <p className="mt-2 text-sm text-gray-500">You can paste any valid HTML code including divs, images, iframes, and more.</p>
            </div>
            {content && (
              <div>
                <label className="text-[14px] md:text-sm font-medium text-gray-700">Preview</label>
                <div
                  className="mt-1.5 w-full px-4 py-3 border border-gray-300 rounded-lg min-h-[80px] bg-white overflow-auto [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:text-base [&_h4]:font-semibold [&_h5]:text-sm [&_h5]:font-semibold [&_h6]:text-xs [&_h6]:font-semibold [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_a]:text-[#6C60FF] [&_a]:underline [&_strong]:font-bold [&_em]:italic [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              </div>
            )}
          </div>
        </div>
        {/* Footer action buttons - pinned to bottom on mobile */}
        <div className="flex-shrink-0 flex justify-end md:justify-end gap-3 px-5 py-3 pb-[50px] md:px-0 md:py-0 md:pb-0 md:pt-4 border-t md:border-t-0 border-gray-100">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-12 md:h-10 px-6 text-[14px] md:text-sm border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            className="h-12 md:h-10 px-6 text-[14px] md:text-sm bg-[#6C60FF] hover:bg-[#5A52E6] text-white"
          >
            {editing ? 'Save Changes' : 'Add HTML'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function YoutubeWidgetDialog({ open, onOpenChange, onSubmit, editing, title, onTitleChange, url, onUrlChange }: EditorBase & {
  editing: boolean; title: string; onTitleChange(v: string): void; url: string; onUrlChange(v: string): void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none md:max-w-[480px] w-full h-full md:h-auto md:max-h-[90vh] bg-white p-0 md:p-6 border-0 shadow-xl md:rounded-lg rounded-none top-0 left-0 translate-x-0 translate-y-0 md:top-[50%] md:left-[50%] md:translate-x-[-50%] md:translate-y-[-50%] flex flex-col [&>button[data-slot=dialog-default-close]]:hidden md:[&>button[data-slot=dialog-default-close]]:flex">
        {/* Mobile Header with title + close */}
        <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <h4 className="font-semibold text-[18px] md:text-lg text-gray-900">{editing ? 'Edit YouTube Video' : 'Embed YouTube Video'}</h4>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" className="h-10 w-10 p-0 hover:bg-gray-100 rounded-full">
              <X className="!w-[28px] !h-[28px] text-black" />
            </Button>
          </DialogClose>
        </div>
        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 md:px-0 md:pt-0 md:pb-0">
          <div className="space-y-5 md:space-y-4">
            <DialogHeader className="space-y-1 pb-2 text-left hidden md:block">
              <DialogTitle className="text-xl md:text-lg font-semibold text-gray-900">{editing ? 'Edit YouTube Video' : 'Embed YouTube Video'}</DialogTitle>
              <p className="text-sm text-gray-500">Enter a YouTube URL to embed in your timeline</p>
            </DialogHeader>
            <label className="text-[14px] md:text-sm font-medium text-gray-700 md:hidden">Enter a YouTube URL to embed in your timeline</label>
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Video title (optional)"
              className="w-full h-12 px-4 border-2 border-gray-300 rounded-lg text-[14px] md:text-sm focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]"
            />
            <input
              type="text"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full h-12 px-4 border-2 border-gray-300 rounded-lg text-[14px] md:text-sm focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]"
            />
            {(() => {
              const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
              const videoId = match ? match[1] : null;
              return videoId ? (
                <div className="w-full rounded-lg overflow-hidden border border-gray-200">
                  <iframe
                    width="100%"
                    height="240"
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=0`}
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="block"
                  />
                </div>
              ) : null;
            })()}
          </div>
        </div>
        {/* Footer action buttons - pinned to bottom on mobile */}
        <div className="flex-shrink-0 flex justify-end md:justify-end gap-3 px-5 py-3 pb-[50px] md:px-0 md:py-0 md:pb-0 md:pt-4 border-t md:border-t-0 border-gray-100">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-12 md:h-10 px-6 text-[14px] md:text-sm border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            disabled={!url.trim()}
            onClick={onSubmit}
            className="h-12 md:h-10 px-6 text-[14px] md:text-sm bg-[#6C60FF] hover:bg-[#5A52E6] text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {editing ? 'Save Changes' : 'Add Video'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function QuoteWidgetDialog({ open, onOpenChange, onSubmit, editing, text, onTextChange, author, onAuthorChange }: EditorBase & {
  editing: boolean; text: string; onTextChange(v: string): void; author: string; onAuthorChange(v: string): void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none md:max-w-[480px] w-full h-full md:h-auto md:max-h-[90vh] bg-white p-0 md:p-6 border-0 shadow-xl md:rounded-lg rounded-none top-0 left-0 translate-x-0 translate-y-0 md:top-[50%] md:left-[50%] md:translate-x-[-50%] md:translate-y-[-50%] flex flex-col [&>button[data-slot=dialog-default-close]]:hidden md:[&>button[data-slot=dialog-default-close]]:flex">
        {/* Mobile Header with title + close */}
        <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <h4 className="font-semibold text-[18px] md:text-lg text-gray-900">{editing ? 'Edit Quote' : 'Add Quote'}</h4>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" className="h-10 w-10 p-0 hover:bg-gray-100 rounded-full">
              <X className="!w-[28px] !h-[28px] text-black" />
            </Button>
          </DialogClose>
        </div>
        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 md:px-0 md:pt-0 md:pb-0">
          <div className="space-y-5 md:space-y-4">
            <DialogHeader className="space-y-1 pb-2 text-left hidden md:block">
              <DialogTitle className="text-xl md:text-lg font-semibold text-gray-900">{editing ? 'Edit Quote' : 'Add Quote'}</DialogTitle>
              <p className="text-sm text-gray-500">Enter a quote and author to add to your timeline</p>
            </DialogHeader>
            <label className="text-[14px] md:text-sm font-medium text-gray-700 md:hidden">Enter a quote and author to add to your timeline</label>
            <textarea
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Enter your quote here..."
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-[14px] md:text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]"
            />
            <input
              type="text"
              value={author}
              onChange={(e) => onAuthorChange(e.target.value)}
              placeholder="Enter author name here..."
              className="w-full h-12 px-4 border border-gray-300 rounded-lg text-[14px] md:text-sm focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]"
            />
          </div>
        </div>
        {/* Footer action buttons - pinned to bottom on mobile */}
        <div className="flex-shrink-0 flex justify-end md:justify-end gap-3 px-5 py-3 pb-[50px] md:px-0 md:py-0 md:pb-0 md:pt-4 border-t md:border-t-0 border-gray-100">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-12 md:h-10 px-6 text-[14px] md:text-sm border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            disabled={!text.trim()}
            onClick={onSubmit}
            className="h-12 md:h-10 px-6 text-[14px] md:text-sm bg-[#6C60FF] hover:bg-[#5A52E6] text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {editing ? 'Save Changes' : 'Add Quote'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** AI Creator's generated content (its preview, and what Add to Timeline saves). */
export interface AiCreatorPreview { text: string; background: string; imageUrl?: string | null; isDark?: boolean | null }

export function AiCreatorWidgetDialog({ open, onOpenChange, onSubmit, prompt, onPromptChange, pinToBottom, onPinToBottomChange, referenceImagePreview, onPickImage, onClearImage, isGenerating, generatedPreview, onGenerate, isSaving }: EditorBase & {
  prompt: string; onPromptChange(v: string): void;
  pinToBottom: boolean; onPinToBottomChange(v: boolean): void;
  referenceImagePreview: string | null; onPickImage(file: File | undefined): void | Promise<void>; onClearImage(): void;
  isGenerating: boolean; generatedPreview: AiCreatorPreview | null; onGenerate(): void;
  isSaving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none md:max-w-[820px] w-full h-full md:h-auto md:max-h-[90vh] bg-white p-0 md:p-6 border-0 shadow-xl md:rounded-lg rounded-none top-0 left-0 translate-x-0 translate-y-0 md:top-[50%] md:left-[50%] md:translate-x-[-50%] md:translate-y-[-50%] flex flex-col [&>button[data-slot=dialog-default-close]]:hidden md:[&>button[data-slot=dialog-default-close]]:flex">
        {/* Mobile Header with title + close */}
        <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <h4 className="font-semibold text-[18px] md:text-lg text-gray-900">AI Creator</h4>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" className="h-10 w-10 p-0 hover:bg-gray-100 rounded-full">
              <X className="!w-[28px] !h-[28px] text-black" />
            </Button>
          </DialogClose>
        </div>
        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 md:px-0 md:pt-0 md:pb-0">
          <DialogHeader className="space-y-1 pb-4 text-left hidden md:flex md:flex-row md:items-center md:gap-3 md:space-y-0">
            <div className="w-10 h-10 rounded-lg bg-[#6C60FF]/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-[#6C60FF]" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-gray-900">AI Creator</DialogTitle>
              <p className="text-sm text-gray-500">Generate custom content with AI</p>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left column: Prompt + options */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => onPromptChange(e.target.value)}
                  placeholder={"Describe the content you want to create...\n\ne.g. A heartfelt thank you message with a soft purple background"}
                  rows={5}
                  className="mt-1.5 w-full px-4 py-3 border border-gray-300 rounded-lg text-[14px] md:text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]"
                />
                <p className="mt-1 text-xs text-gray-400">Be specific for better results</p>
              </div>

              {/* Pin to bottom */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[#6C60FF]/10 flex items-center justify-center flex-shrink-0">
                    <Download className="w-4 h-4 text-[#6C60FF]" />
                  </div>
                  <div>
                    <p className="text-[14px] md:text-sm font-medium text-gray-900">Pin to bottom</p>
                    <p className="text-xs text-gray-500">Fixed at end of campaign</p>
                  </div>
                </div>
                <Switch checked={pinToBottom} onCheckedChange={onPinToBottomChange} />
              </div>

              {/* Reference image (optional) */}
              <div>
                <label className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Reference Image <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <label className="mt-1.5 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-[#6C60FF]/50 hover:bg-[#6C60FF]/5 transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept={IMAGE_ACCEPT}
                    className="hidden"
                    onChange={(e) => { void onPickImage(e.target.files?.[0]); }}
                  />
                  {referenceImagePreview ? (
                    <div className="relative">
                      <img src={referenceImagePreview} alt="Reference" className="h-20 w-20 object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClearImage(); }}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      >
                        <X className="w-3 h-3 text-gray-600" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <ImageIcon className="w-5 h-5 text-gray-400" />
                      <span className="text-xs text-gray-500">Tap to add image or drag & drop</span>
                    </>
                  )}
                </label>
                <p className="mt-1 text-xs text-gray-400">Used as the background of the generated content — text color adapts to it</p>
              </div>

              {/* Generate button */}
              <button
                type="button"
                disabled={!prompt.trim() || isGenerating}
                onClick={onGenerate}
                className="w-full h-11 rounded-lg p-[1.5px] border-0 bg-gradient-to-r from-[#6C60FF] to-[#F6339A] transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="h-full rounded-[7px] bg-white flex items-center justify-center gap-2 text-sm font-medium">
                  <Sparkles className={`w-4 h-4 text-[#6C60FF] ${isGenerating ? 'animate-pulse' : ''}`} />
                  <span
                    style={{
                      background: 'linear-gradient(90deg, #6C60FF 0%, #F6339A 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {isGenerating ? 'Generating...' : generatedPreview ? 'Regenerate' : 'Generate • 1 credit'}
                  </span>
                </div>
              </button>
            </div>

            {/* Right column: Preview */}
            <div>
              <label className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Preview</label>
              <div className="mt-1.5 min-h-[280px] rounded-xl border border-gray-200 bg-gray-50 p-5 flex flex-col items-center justify-center text-center gap-2">
                {isGenerating ? (
                  <>
                    <Sparkles className="w-8 h-8 text-[#6C60FF] animate-pulse" />
                    <p className="text-sm font-medium text-gray-700">Generating...</p>
                  </>
                ) : generatedPreview ? (
                  <div
                    className="relative w-full min-h-[220px] rounded-xl p-6 flex items-center justify-center overflow-hidden bg-cover bg-center"
                    style={
                      generatedPreview.imageUrl
                        ? { backgroundImage: `url(${generatedPreview.imageUrl})` }
                        : { background: generatedPreview.background }
                    }
                  >
                    {/* Subtle scrim for legibility — darkens light images, lightens dark ones */}
                    {generatedPreview.imageUrl && (
                      <div
                        className="absolute inset-0"
                        style={{ background: generatedPreview.isDark === false ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' }}
                      />
                    )}
                    <p
                      className={`relative font-semibold text-center break-words ${
                        generatedPreview.imageUrl && generatedPreview.isDark === false
                          ? 'text-gray-900'
                          : 'text-white'
                      }`}
                      dangerouslySetInnerHTML={{ __html: sanitizeAiCreatorText(generatedPreview.text) }}
                    />
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-full bg-[#6C60FF]/10 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-[#6C60FF]" />
                    </div>
                    <p className="text-sm font-medium text-gray-700">Your content will appear here</p>
                    <p className="text-xs text-gray-400">Write a prompt and hit Generate</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Footer action buttons - pinned to bottom on mobile */}
        <div className="flex-shrink-0 flex justify-end md:justify-end gap-3 px-5 py-3 pb-[50px] md:px-0 md:py-0 md:pb-0 md:pt-4 border-t md:border-t-0 border-gray-100">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-12 md:h-10 px-6 text-[14px] md:text-sm border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            disabled={!generatedPreview || isSaving}
            onClick={onSubmit}
            className="h-12 md:h-10 px-6 text-[14px] md:text-sm bg-[#6C60FF] hover:bg-[#5A52E6] text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Adding...' : 'Add to Timeline'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CtaWidgetDialog({ open, onOpenChange, onSubmit, editing, isRequestMoment, form, onChange }: EditorBase & {
  editing: boolean; isRequestMoment: boolean; form: CtaForm; onChange(patch: Partial<CtaForm>): void;
}) {
  const setTitle = (title: string) => onChange({ title });
  const setButtonText = (buttonText: string) => onChange({ buttonText });
  const setButtonLink = (buttonLink: string) => onChange({ buttonLink });
  const setButtonColor = (buttonColor: string) => onChange({ buttonColor });
  const setTextColor = (textColor: string) => onChange({ textColor });
  const setIcon = (icon: string) => onChange({ icon });
  const setIconSize = (iconSize: number) => onChange({ iconSize });
  const setFontSize = (fontSize: number) => onChange({ fontSize });
  const setButtonWidth = (buttonWidth: number) => onChange({ buttonWidth });
  const setBorderRadius = (borderRadius: number) => onChange({ borderRadius });
  const setPinToBottom = (pinToBottom: boolean) => onChange({ pinToBottom });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none md:max-w-[480px] w-full h-full md:h-auto md:max-h-[90vh] bg-white p-0 md:p-6 border-0 shadow-xl md:rounded-lg rounded-none top-0 left-0 translate-x-0 translate-y-0 md:top-[50%] md:left-[50%] md:translate-x-[-50%] md:translate-y-[-50%] flex flex-col [&>button[data-slot=dialog-default-close]]:hidden md:[&>button[data-slot=dialog-default-close]]:flex">
        {/* Mobile Header */}
        <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <h4 className="font-semibold text-[18px] text-gray-900">{ctaModalNoun(isRequestMoment, editing)}</h4>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" className="h-10 w-10 p-0 hover:bg-gray-100 rounded-full">
              <X className="!w-[28px] !h-[28px] text-black" />
            </Button>
          </DialogClose>
        </div>
        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 md:px-0 md:pt-0 md:pb-0">
          <div className="space-y-5 md:space-y-4">
            <DialogHeader className="space-y-1 pb-2 text-left hidden md:block">
              <DialogTitle className="text-xl md:text-lg font-semibold text-gray-900">{ctaModalNoun(isRequestMoment, editing)}</DialogTitle>
              <p className="text-sm text-gray-500">{isRequestMoment ? 'Visitors tap this button to submit a photo and caption' : 'Add a title and a button that links somewhere'}</p>
            </DialogHeader>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-[14px] md:text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Ready to book your stay?"
                className="w-full h-12 px-4 border border-gray-300 rounded-lg text-[14px] md:text-sm focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]"
              />
            </div>

            {/* Button text */}
            <div className="space-y-1.5">
              <label className="text-[14px] md:text-sm font-medium text-gray-700">Button text</label>
              <input
                type="text"
                value={form.buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                placeholder="e.g. Book Now"
                className="w-full h-12 px-4 border border-gray-300 rounded-lg text-[14px] md:text-sm focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]"
              />
            </div>

            {/* Button link — hidden for Share Request a Moment, which opens a form
                rather than navigating anywhere. */}
            {!isRequestMoment && (
              <div className="space-y-1.5">
                <label className="text-[14px] md:text-sm font-medium text-gray-700">Button link (URL)</label>
                <input
                  type="text"
                  value={form.buttonLink}
                  onChange={(e) => setButtonLink(e.target.value)}
                  placeholder="https://example.com"
                  className={`w-full h-12 px-4 border rounded-lg text-[14px] md:text-sm focus:outline-none focus:ring-2 ${
                    form.buttonLink.trim() && !ctaIsValidUrl(form.buttonLink)
                      ? 'border-red-400 focus:ring-red-200 focus:border-red-400'
                      : 'border-gray-300 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]'
                  }`}
                />
                {form.buttonLink.trim() && !ctaIsValidUrl(form.buttonLink) && (
                  <p className="text-xs text-red-500">Please enter a valid URL (e.g. https://example.com)</p>
                )}
              </div>
            )}

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[14px] md:text-sm font-medium text-gray-700">Button color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="h-10 w-12 rounded border border-gray-300 cursor-pointer bg-white p-0.5" />
                  <input type="text" value={form.buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="flex-1 h-10 px-2 border border-gray-300 rounded-lg text-[14px] uppercase focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[14px] md:text-sm font-medium text-gray-700">Text color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.textColor} onChange={(e) => setTextColor(e.target.value)} className="h-10 w-12 rounded border border-gray-300 cursor-pointer bg-white p-0.5" />
                  <input type="text" value={form.textColor} onChange={(e) => setTextColor(e.target.value)} className="flex-1 h-10 px-2 border border-gray-300 rounded-lg text-[14px] uppercase focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]" />
                </div>
              </div>
            </div>

            {/* Icon picker — hidden for Share Request a Moment, whose icon is
                fixed to Upload. */}
            {!isRequestMoment && (
            <div className="space-y-1.5">
              <label className="text-[14px] md:text-sm font-medium text-gray-700">Icon</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIcon('')}
                  className={`h-10 w-10 rounded-lg border flex items-center justify-center text-[12px] text-gray-500 ${form.icon === '' ? 'border-[#6C60FF] bg-[#6C60FF]/10' : 'border-gray-300 hover:bg-gray-50'}`}
                  title="No icon"
                >
                  None
                </button>
                {CTA_ICON_KEYS.map((key) => {
                  const Icon = CTA_ICONS[key];
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setIcon(key)}
                      className={`h-10 w-10 rounded-lg border flex items-center justify-center ${form.icon === key ? 'border-[#6C60FF] bg-[#6C60FF]/10 text-[#6C60FF]' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                      title={key}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            {/* Icon size */}
            {form.icon && (
              <div className="space-y-1.5">
                <label className="text-[14px] md:text-sm font-medium text-gray-700">Icon size: {form.iconSize}px</label>
                <input
                  type="range"
                  min={12}
                  max={48}
                  value={form.iconSize}
                  onChange={(e) => setIconSize(Number(e.target.value))}
                  className="w-full accent-[#6C60FF]"
                />
              </div>
            )}

            {/* Button text size */}
            <div className="space-y-1.5">
              <label className="text-[14px] md:text-sm font-medium text-gray-700">Button text size: {form.fontSize}px</label>
              <input
                type="range"
                min={12}
                max={32}
                value={form.fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-[#6C60FF]"
              />
            </div>

            {/* Button width */}
            <div className="space-y-1.5">
              <label className="text-[14px] md:text-sm font-medium text-gray-700">Button width: {form.buttonWidth ? `${form.buttonWidth}px` : 'Full width'}</label>
              <input
                type="range"
                min={0}
                max={480}
                step={10}
                value={form.buttonWidth}
                onChange={(e) => setButtonWidth(Number(e.target.value))}
                className="w-full accent-[#6C60FF]"
              />
            </div>

            {/* Round corners */}
            <div className="space-y-1.5">
              <label className="text-[14px] md:text-sm font-medium text-gray-700">Round corners: {form.borderRadius}px</label>
              <input
                type="range"
                min={0}
                max={40}
                step={2}
                value={form.borderRadius}
                onChange={(e) => setBorderRadius(Number(e.target.value))}
                className="w-full accent-[#6C60FF]"
              />
            </div>

            {/* Pin to bottom — Share Request a Moment only. Keeps the button pinned
                after the current last item in the timeline, instead of the fixed
                spot it was inserted at. */}
            {isRequestMoment && (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[#6C60FF]/10 flex items-center justify-center flex-shrink-0">
                    <Download className="w-4 h-4 text-[#6C60FF]" />
                  </div>
                  <div>
                    <p className="text-[14px] md:text-sm font-medium text-gray-900">Pin to bottom</p>
                    <p className="text-xs text-gray-500">Fixed at end of campaign</p>
                  </div>
                </div>
                <Switch checked={form.pinToBottom} onCheckedChange={setPinToBottom} />
              </div>
            )}

            {/* Live preview */}
            <div className="space-y-1.5">
              <label className="text-[14px] md:text-sm font-medium text-gray-700">Preview</label>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 flex flex-col items-center text-center gap-3">
                {form.title && <p className="text-lg font-bold text-gray-900 break-words">{form.title}</p>}
                <span
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold"
                  style={{
                    backgroundColor: form.buttonColor || CTA_DEFAULT_BUTTON_COLOR,
                    color: form.textColor || CTA_DEFAULT_TEXT_COLOR,
                    fontSize: form.fontSize,
                    borderRadius: `${form.borderRadius}px`,
                    width: form.buttonWidth ? `${form.buttonWidth}px` : '100%',
                    maxWidth: '100%',
                  }}
                >
                  {form.icon && CTA_ICONS[form.icon] && (() => { const Ic = CTA_ICONS[form.icon]; return <Ic style={{ width: form.iconSize, height: form.iconSize }} />; })()}
                  <span>{form.buttonText || (isRequestMoment ? 'Share a Moment' : 'Learn More')}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="flex-shrink-0 flex justify-end gap-3 px-5 py-3 pb-[50px] md:px-0 md:py-0 md:pb-0 md:pt-4 border-t md:border-t-0 border-gray-100">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-12 md:h-10 px-6 text-[14px] md:text-sm border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            disabled={!form.buttonText.trim() || (!isRequestMoment && !ctaIsValidUrl(form.buttonLink))}
            onClick={onSubmit}
            className="h-12 md:h-10 px-6 text-[14px] md:text-sm bg-[#6C60FF] hover:bg-[#5A52E6] text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {editing ? 'Save Changes' : (isRequestMoment ? 'Save' : 'Add Call to Action')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
