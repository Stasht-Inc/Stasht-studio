import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiRequest } from '../../utils/authUtils';
import { HEIC_CONVERT_FAILED, prepareImageForUpload, UploadFileError } from '../../utils/uploadFiles';
import { AiCreatorWidgetDialog, CtaWidgetDialog, HtmlWidgetDialog, QuoteWidgetDialog, YoutubeWidgetDialog, type AiCreatorPreview } from '../widgets/WidgetEditorDialogs';
import { ctaWidgetData, emptyCtaForm, requestMomentCtaForm, youtubeVideoId, type CtaForm, type CtaMode } from '../widgets/ctaWidget';
import type { AddWidgetKind } from '../widgets/addWidgetOptions';
import ShopifyProductPicker from '../ShopifyProductPicker';
import { VoiceToTextModal } from '../VoiceToTextModal';
import type { PendingWidget } from './lib/pendingWidgets';

/**
 * Create Storeel's widget editors (Deepak 24 Nov 2026, P1: "If it is a given option it needs to work here itself"):
 * every "+" option opens the campaign page's own editor (components/widgets/WidgetEditorDialogs — the same dialogs),
 * Shopify's product picker, or Voice to Text, right over the Storeel page. Saving hands the widget back (`onSave`) for
 * the preview — nothing is sent to the server until Save as Draft / Save & Send. Voice to Text makes moments, so its
 * parts go back as moments (`onVoiceMoments`). AI Creator generates with POST /memories/ai-creator/generate (no
 * campaign yet), the same AI and credit as the campaign page's.
 */

export interface WidgetEditorRequest {
  kind: AddWidgetKind;
  /** The pending widget being edited (its ⋮ → Edit), else a new one. */
  editing?: PendingWidget;
}

/** A widget as an editor saves it: everything but its place (the caller knows the "+"). */
export type SavedWidget = Omit<PendingWidget, 'key' | 'anchor'>;

interface AiFields { prompt: string; pinToBottom: boolean; preview: AiCreatorPreview | null; referenceImagePreview: string | null }

const KIND_LABEL: Partial<Record<AddWidgetKind, string>> = {
  cta: 'Call to Action', request_moment: 'Share Request a Moment', html: 'HTML', youtube: 'YouTube video', quote: 'Quote', ai_creator: 'AI Creator',
};

/** The editor's fields kept with a pending widget, so Edit opens them as they were. */
type Fields =
  | { kind: 'html'; title: string; content: string }
  | { kind: 'youtube'; title: string; url: string }
  | { kind: 'quote'; text: string; author: string }
  | { kind: 'cta'; form: CtaForm; mode: CtaMode }
  | { kind: 'ai_creator'; ai: AiFields };

export default function StoreelWidgetEditors({ request, onClose, onSave, onVoiceMoments, userProfileImage }: {
  request: WidgetEditorRequest | null;
  onClose(): void;
  /** One widget (an editor) or several (Shopify products, in the order picked); `editingKey` when it was an Edit. */
  onSave(widgets: SavedWidget[], editingKey?: string): void;
  onVoiceMoments(moments: Array<{ text: string; file: File | null }>): Promise<boolean>;
  userProfileImage?: string;
}) {
  const kind = request?.kind ?? null;
  const editing = request?.editing;

  const [htmlTitle, setHtmlTitle] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [ytTitle, setYtTitle] = useState('');
  const [ytUrl, setYtUrl] = useState('');
  const [quoteText, setQuoteText] = useState('');
  const [quoteAuthor, setQuoteAuthor] = useState('');
  const [cta, setCta] = useState<CtaForm>(emptyCtaForm);
  const [ctaMode, setCtaMode] = useState<CtaMode>('link');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiPin, setAiPin] = useState(false);
  const [aiImage, setAiImage] = useState<File | null>(null);
  const [aiImagePreview, setAiImagePreview] = useState<string | null>(null);
  const [aiImageIsDark, setAiImageIsDark] = useState<boolean | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPreview, setAiPreview] = useState<AiCreatorPreview | null>(null);

  // Each opening starts from the widget's own fields (Edit) or the editor's defaults, as on the campaign page.
  useEffect(() => {
    if (!request) return;
    const f = request.editing?.fields as Fields | undefined;
    setHtmlTitle(f?.kind === 'html' ? f.title : ''); setHtmlContent(f?.kind === 'html' ? f.content : '');
    setYtTitle(f?.kind === 'youtube' ? f.title : ''); setYtUrl(f?.kind === 'youtube' ? f.url : '');
    setQuoteText(f?.kind === 'quote' ? f.text : ''); setQuoteAuthor(f?.kind === 'quote' ? f.author : '');
    if (f?.kind === 'cta') { setCta(f.form); setCtaMode(f.mode); }
    else if (request.kind === 'request_moment') { setCta(requestMomentCtaForm()); setCtaMode('request_moment'); }
    else { setCta(emptyCtaForm()); setCtaMode('link'); }
    setAiPrompt(f?.kind === 'ai_creator' ? f.ai.prompt : ''); setAiPin(f?.kind === 'ai_creator' ? f.ai.pinToBottom : false);
    setAiImage(null); setAiImagePreview(f?.kind === 'ai_creator' ? f.ai.referenceImagePreview : null); setAiImageIsDark(null);
    setAiGenerating(false); setAiPreview(f?.kind === 'ai_creator' ? f.ai.preview : null);
  }, [request]);

  const close = (open: boolean) => { if (!open) onClose(); };
  const save = (w: Omit<SavedWidget, 'kind'>) => { onSave([{ kind: kind!, ...w }], editing?.key); onClose(); };
  const label = (fallback: string) => fallback.trim() || KIND_LABEL[kind!] || 'Widget';

  // AI Creator's reference image: lighter or darker (the campaign page's analyzeAiCreatorImageBrightness).
  const analyzeBrightness = (url: string) => {
    const img = new Image();
    img.onload = () => {
      const sampleSize = 32;
      const canvas = document.createElement('canvas');
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) { setAiImageIsDark(null); return; }
      ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
      try {
        const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);
        let total = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) { total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; count++; }
        setAiImageIsDark(total / count < 140);
      } catch {
        setAiImageIsDark(null);
      }
    };
    img.src = url;
  };

  const generate = async () => {
    const isRegenerate = aiPreview !== null;
    setAiGenerating(true);
    setAiPreview(null);
    try {
      let referenceImageBase64: string | null = null;
      let referenceImageMime: string | null = null;
      if (aiImage) {
        referenceImageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(aiImage);
        });
        referenceImageMime = aiImage.type;
      }
      // No campaign yet: the web API's campaign-less route (same AI, same credit).
      const res = await apiRequest('/memories/ai-creator/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt: aiPrompt.trim(), reference_image_base64: referenceImageBase64, reference_image_mime: referenceImageMime, after_post_id: null, ai_credit: isRegenerate ? 0 : 1 }),
      });
      if (!res.success) { toast.error('Failed to generate content'); return; }
      const data = (res.data as any)?.data || res.data;
      setAiPreview({ text: data.text, background: data.background, imageUrl: aiImagePreview, isDark: typeof data.is_dark === 'boolean' ? data.is_dark : aiImageIsDark });
    } catch {
      toast.error('Failed to generate content');
    } finally {
      setAiGenerating(false);
    }
  };

  const plainText = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  return (
    <>
      <HtmlWidgetDialog
        open={kind === 'html'}
        onOpenChange={close}
        editing={Boolean(editing)}
        title={htmlTitle}
        onTitleChange={setHtmlTitle}
        content={htmlContent}
        onContentChange={setHtmlContent}
        onSubmit={() => save({ label: label(htmlTitle), widgetType: 'html', widgetData: { title: htmlTitle, content: htmlContent }, fields: { kind: 'html', title: htmlTitle, content: htmlContent } })}
      />
      <YoutubeWidgetDialog
        open={kind === 'youtube'}
        onOpenChange={close}
        editing={Boolean(editing)}
        title={ytTitle}
        onTitleChange={setYtTitle}
        url={ytUrl}
        onUrlChange={setYtUrl}
        onSubmit={() => {
          const videoId = youtubeVideoId(ytUrl);
          if (!videoId) { toast.error('Please enter a valid YouTube URL'); return; }
          save({ label: label(ytTitle), widgetType: 'youtube', widgetData: { title: ytTitle, url: ytUrl, videoId }, fields: { kind: 'youtube', title: ytTitle, url: ytUrl } });
        }}
      />
      <QuoteWidgetDialog
        open={kind === 'quote'}
        onOpenChange={close}
        editing={Boolean(editing)}
        text={quoteText}
        onTextChange={setQuoteText}
        author={quoteAuthor}
        onAuthorChange={setQuoteAuthor}
        onSubmit={() => save({ label: 'Quote', widgetType: 'quote', widgetData: { text: quoteText, author: quoteAuthor }, fields: { kind: 'quote', text: quoteText, author: quoteAuthor } })}
      />
      <AiCreatorWidgetDialog
        open={kind === 'ai_creator'}
        onOpenChange={close}
        prompt={aiPrompt}
        onPromptChange={setAiPrompt}
        pinToBottom={aiPin}
        onPinToBottomChange={setAiPin}
        referenceImagePreview={aiImagePreview}
        onPickImage={async (picked) => {
          if (!picked) return;
          let file: File;
          try {
            file = (await prepareImageForUpload(picked)) as File;
          } catch (error) {
            toast.error(error instanceof UploadFileError ? error.message : HEIC_CONVERT_FAILED);
            return;
          }
          const url = URL.createObjectURL(file);
          setAiImage(file);
          setAiImagePreview(url);
          setAiImageIsDark(null);
          analyzeBrightness(url);
        }}
        onClearImage={() => { setAiImage(null); setAiImagePreview(null); setAiImageIsDark(null); }}
        isGenerating={aiGenerating}
        generatedPreview={aiPreview}
        onGenerate={() => { void generate(); }}
        isSaving={false}
        onSubmit={() => {
          if (!aiPreview) return;
          save({
            label: label(plainText(aiPreview.text).slice(0, 40)),
            widgetType: 'ai_creator',
            // Exactly what the campaign page saves (its reference image is shown, not uploaded).
            widgetData: { prompt: aiPrompt.trim(), text: aiPreview.text, background: aiPreview.background, image_url: null, is_dark: aiPreview.isDark, pin_to_bottom: aiPin },
            extra: { imageUrl: aiPreview.imageUrl ?? null, isDark: aiPreview.isDark ?? null },
            fields: { kind: 'ai_creator', ai: { prompt: aiPrompt, pinToBottom: aiPin, preview: aiPreview, referenceImagePreview: aiImagePreview } },
          });
        }}
      />
      <CtaWidgetDialog
        open={kind === 'cta' || kind === 'request_moment'}
        onOpenChange={close}
        editing={Boolean(editing)}
        isRequestMoment={ctaMode === 'request_moment'}
        form={cta}
        onChange={(patch) => setCta((prev) => ({ ...prev, ...patch }))}
        onSubmit={() => save({
          label: label(cta.title || (ctaMode === 'request_moment' ? 'Share Request a Moment' : 'Call to Action')),
          widgetType: 'cta', widgetData: ctaWidgetData(cta, ctaMode), fields: { kind: 'cta', form: cta, mode: ctaMode },
        })}
      />
      {/* Shopify Product: the campaign page's picker; each product becomes a product widget at this "+", in order. */}
      <ShopifyProductPicker
        isOpen={kind === 'shopify_product'}
        onClose={onClose}
        onAdd={(products, shopDomain) => {
          onSave(products.map((p) => ({
            kind: 'shopify_product', label: p.title || 'Product', widgetType: 'product',
            widgetData: {
              product_id: p.id,
              title: p.title,
              description: p.description || '',
              price: p.price || '',
              currency: p.currency || '',
              image: p.image || (Array.isArray(p.images) ? p.images[0] : '') || '',
              handle: p.handle || '',
              shop_domain: shopDomain || '',
              product_url: shopDomain && p.handle ? `https://${shopDomain}/products/${p.handle}` : '',
              status: p.status || '',
              vendor: p.vendor || '',
            },
          })));
        }}
      />
      {/* Voice to Text makes moments: its parts come back to the form, where the "+" was. */}
      <VoiceToTextModal
        isOpen={kind === 'voice'}
        onClose={onClose}
        memoryId=""
        userProfileImage={userProfileImage}
        onCreateLocal={onVoiceMoments}
      />
    </>
  );
}
