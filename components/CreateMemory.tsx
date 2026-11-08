import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useReducer } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Calendar, MapPin, Tag, Plus, Camera, Image as ImageIcon, CheckCircle, Loader2, File as FileIcon, Search, Video, Pencil, ChevronRight, ArrowLeft, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useVisualViewportSheet } from '../hooks/useVisualViewportSheet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useIsStarterPlan } from '../hooks/usePlan';
import GooglePlacesInput from './ui/google-places-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import * as Popover from '@radix-ui/react-popover';
import { clearApiCache, dashboardAPI, getApiBaseUrl } from '../utils/authUtils';
import { dayOf, isoToApiDay, localDateISO } from '../utils/localDate';
import { loadCatalogueForBrowsing } from '../services/catalogueAPI';
import exifr from 'exifr';
import { getCategoryColor } from '../constants/mediaConstants';
import { SHOPIFY_COLOR } from '../utils/categoryColorManager';
import { useAuth } from '../contexts/AuthContext';
import { useProperty } from '../contexts/PropertyContext';
import { useMemoryLimit, recheckMemoryLimit } from '../hooks/useMemoryLimit';
import { triggerMemoryCountsRefresh } from '../hooks/useMemoryCounts';
import { ExifProgressModal } from "./ExifProgressModal";
import MediaLibrarySelectionModal from "./MediaLibrarySelectionModal";
import { AddMomentModal } from "./AddMomentModal";
import { VideoRecorderModal } from "./VideoRecorderModal";
import { useGoogleDrivePicker } from '../hooks/useGoogleDrivePicker';
import NewsletterComposer, { type NewsletterComposerHandle } from './newsletters/NewsletterComposer';
import CampaignTypeSwitch from './newsletters/CampaignTypeSwitch';
import { initialCampaignType, type CampaignType } from './newsletters/lib/campaignType';
import { announceNewslettersChanged, writeCampaignsView } from './newsletters/lib/campaignsView';
import { requestUpgrade } from '../utils/planEvents';
import StoreelLivePreview, { type PreviewControls } from './storeel/StoreelLivePreview';
import ComposerDialog from './newsletters/ComposerDialog';
import { apiDefaultOrder, focusAfterRemove, insertKeysAfter, isOrderable, momentMenu, moveKey, needsServerOrder, orderMoments, savedOrderPayload, savedRef, sentPostKeys, serverOrderAfterCreate } from './storeel/lib/momentOrder';
import { addedMessage, pickPayload, pickedPreviewMoments, type InventoryPick } from './storeel/lib/momentPicks';
import { accountModerationFrom, moderationPayload, moderationSwitchShown, shownModeration } from './storeel/lib/moderation';
import { Switch } from './ui/switch';
import type { MomentInventory } from './storeel/InventoryMomentPicker';
import { campaignMomentsAPI, type MomentPlace } from '../services/campaignMomentsAPI';
import { actionLines } from './storeel/lib/actionLines';
import { storeelBrandImage } from './storeel/storeelPreview';
import { createPreviewMoments, type PickKind, type PickerItem, type PreviewMoment } from './storeel/lib/previewMoments';
import { coverChoiceReducer, coverChoicePayload, coverPhotoFileError, EMPTY_COVER_CHOICE, COVER_PHOTO_ACCEPT, type CoverChoice, type CoverChoiceAction } from '../utils/coverChoice';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, BUTTON_SECONDARY, LINK_BUTTON } from './newsletters/lib/ui';
import StepCard from './newsletters/StepCard';
import StoreelSendStep, { SEND_STEP_ID } from './storeel/StoreelSendStep';
import StoreelMomentsCard, { MOMENTS_STEP_ID, type MomentRow } from './storeel/StoreelMomentsCard';
import {
  CURRENT_CATEGORY, coverFromSeed, createdToast, flowView, formFromSeed, saveBlockedReason, seedFromMemory, stepNumber, updatePayload,
  type CampaignSeed,
} from './storeel/lib/storeelFlow';
import { senderLabelFor } from './storeel/lib/storeelSms';
import { sentMessage, type StoreelSendSummary } from './storeel/lib/storeelSend';
import { requestOpenCampaign } from './storeel/lib/openCampaign';
import { addWidgetOptions, type AddWidgetKind, type AddWidgetOption } from './widgets/addWidgetOptions';
import { postIdsAfterCreate, saveWidgetIntent, widgetAnchorPostId, type PreviewWidget } from './storeel/lib/storeelWidgets';
import { campaignPreviewMoments, linkedCampaignsMessage, type CampaignPick } from './storeel/lib/momentCampaigns';
import { PUBLISHING_STEP_ID, opensAtTarget, publishingStepNumber, type StepperOpensAt } from './storeel/lib/publishing';
import { ACTION_TOAST_MS } from './newsletters/lib/blocks';
import { DOCUSIGN_ENABLED } from '../constants/features.ts';

const CAMPAIGN_STEP_ID = 'st-step-campaign';

interface CreateMemoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemoryCreated?: () => void;
  onOpenMediaLibrary?: () => void;
  selectedMediaLibraryImages?: any[];
  defaultCategory?: string; // Default category to pre-select when creating a memory
  categories?: any[]; // Pre-loaded categories from parent (avoids redundant fetch)
  newsletterId?: number | null; // Open this newsletter on the Newsletter tab (Campaigns > Newsletters)
  onNewsletterChanged?: () => void; // A newsletter was saved, sent or scheduled
  initialPhotos?: File[] | null; // Photos passed in (Scan Photo): opens on Storeel with them ready to add
  beforeStoreel?: () => boolean; // Asked before switching to the Storeel tab; false keeps the Newsletter tab
  opensOn?: CampaignType; // The tab to open on: the Campaigns page's Storeels | Newsletters view (Chris, 4 Nov 2026)
  // The Storeel flow (Chris, 4 Nov 2026, point 9; v2 4 Nov) on a saved campaign: the campaign page's Edit.
  campaignId?: number | null; // Open the flow on this campaign: step 1 prefilled, saved with PUT /memories/{id}
  campaignSeed?: CampaignSeed | null; // Its data when the caller has it (else GET /memories/{id})
  canSend?: boolean; // False when this account may not send it (only the owner / the property's admins may)
  onDeleteCampaign?: () => void; // Edit: Delete in Set up (the campaign page asks to confirm)
  onCampaignSaved?: (memoryId: number) => void; // Step 1 saved (PUT) or the Storeel sent: the page refreshes
  // Chris, 8 Nov 2026 (point 1): the preview's "+" opens the campaign page's Add Widget chooser. On the campaign page
  // (Edit) its editors open there: onAddWidget(kind, after this moment's id; null = the top).
  onAddWidget?: (kind: AddWidgetKind, afterPostId: string | null) => void;
  widgetOptions?: AddWidgetOption[]; // The chooser's options (default: every option but DocuSign, which needs the page)
  previewWidgets?: PreviewWidget[]; // A saved campaign's widgets, shown in the preview like the campaign page
  previewCardButtons?: ReadonlyMap<string, { buttonText: string }>; // Product moments' in-card buttons, by post id
  widgetEditorOpen?: boolean; // One of the campaign page's widget editors is open over this page
  // Chris, 8 Nov 2026 (b), point 2: the campaign page's Send opens this page at the Send card (Edit: at the top), and
  // the old Publish options are the "Publishing" card after Send (the campaign page renders its body).
  opensAt?: StepperOpensAt;
  publishing?: React.ReactNode;
}

export interface CreateMemoryHandle {
  focusTitle: () => void;
}

/** Step 2's photos get a key of their own when added (a removed photo never shifts another row's caption editor). */
let photoIdSeq = 0;
function withPhotoIds<T extends object>(photos: T[]): Array<T & { id: string }> {
  return photos.map((p) => ({ ...p, id: (p as { id?: string }).id || `p${Date.now().toString(36)}${(photoIdSeq += 1)}` }));
}

// Detect video URLs (same set the stories cards use)
const isCampaignVideoUrl = (url?: string): boolean => {
  if (!url) return false;
  const exts = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v'];
  const lower = url.toLowerCase();
  return exts.some(ext => lower.includes(ext));
};

// Shows a still frame of a video (no playback) — same approach as the stories cover cards
function CampaignVideoThumbnail({ src, className }: { src: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [frameReady, setFrameReady] = useState(false);

  useEffect(() => { setFrameReady(false); }, [src]);

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        src={`${src}#t=0.1`}
        className={`${className} ${frameReady ? 'opacity-100' : 'opacity-0'}`}
        preload="metadata"
        muted
        playsInline
        onLoadedData={() => {
          if (videoRef.current && videoRef.current.currentTime === 0) videoRef.current.currentTime = 0.1;
          setFrameReady(true);
        }}
        onSeeked={() => setFrameReady(true)}
      />
      {!frameReady && <div className="absolute inset-0 bg-gray-200" />}
    </div>
  );
}

const CreateMemory = forwardRef<CreateMemoryHandle, CreateMemoryProps>(function CreateMemory({ open, onOpenChange, onMemoryCreated, onOpenMediaLibrary, selectedMediaLibraryImages, defaultCategory, categories: categoriesProp, newsletterId = null, onNewsletterChanged, initialPhotos = null, beforeStoreel, opensOn, campaignId = null, campaignSeed = null, canSend = true, onDeleteCampaign, onCampaignSaved, onAddWidget, widgetOptions, previewWidgets, previewCardButtons, widgetEditorOpen = false, opensAt = 'campaign', publishing = null }, ref) {
  const { isAuthenticated, user } = useAuth();
  const { viewType, currentProperty } = useProperty();
  const { isLimitExceeded, limitData, checkLimit } = useMemoryLimit();
  // Newsletter | Storeel switch (spec 2026-10-13). Newsletter is the default; null = follow initialCampaignType.
  const [campaignTypeChoice, setCampaignTypeChoice] = useState<CampaignType | null>(null);
  const starterPlan = useIsStarterPlan();
  const campaignType: CampaignType = campaignId ? 'storeel' : campaignTypeChoice ?? initialCampaignType({
    newsletterId, defaultCategory, mediaCount: selectedMediaLibraryImages?.length ?? 0, photoCount: initialPhotos?.length ?? 0,
    isStarter: starterPlan.known && starterPlan.isStarter, preferred: opensOn,
  });
  // The category Set up opened with (or last saved): PUT gets category_id only when the person picks another one.
  const [seededCategory, setSeededCategory] = useState<string | null>(null);
  const campaignTypeRef = useRef<CampaignType>(campaignType);
  campaignTypeRef.current = campaignType;
  const newsletterComposerRef = useRef<NewsletterComposerHandle>(null);
  // The composer stays mounted (keeps its draft) while the Storeel tab is showing.
  const [composerMounted, setComposerMounted] = useState(false);
  useEffect(() => {
    if (!open) { setCampaignTypeChoice(null); setComposerMounted(false); return; }
    if (campaignType === 'newsletter') setComposerMounted(true);
  }, [open, campaignType]);
  // Switching tabs swaps the whole layer, so focus would fall to <body>: put it on the newly shown switch.
  const focusSwitchRef = useRef(false);
  const beforeStoreelRef = useRef(beforeStoreel);
  beforeStoreelRef.current = beforeStoreel;
  const chooseCampaignType = useCallback((type: CampaignType) => {
    if (type === 'storeel' && beforeStoreelRef.current && !beforeStoreelRef.current()) return;
    focusSwitchRef.current = true;
    setCampaignTypeChoice(type);
  }, []);
  useEffect(() => {
    if (!focusSwitchRef.current) return undefined;
    focusSwitchRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      const groups = Array.from(document.querySelectorAll<HTMLElement>('[role="radiogroup"][aria-label="Campaign type"]'));
      const shown = groups.find((g) => g.offsetParent !== null);
      shown?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [campaignType]);
  // The Storeel campaign limit only applies to the Storeel tab (alignment decision 6): it shows inline there,
  // because a z-50 dialog would sit under this z-99999 modal.
  const storeelLimitRef = useRef<HTMLDivElement>(null);
  // The API's own answer (403 memory_limit_reached on POST /memories) when the limit check above said yes,
  // e.g. a campaign was made in another tab meanwhile. Shown in the same notice, in the server's words.
  const [serverLimitMessage, setServerLimitMessage] = useState<string | null>(null);
  // Bumped on each refusal; the notice is focused once it has rendered.
  const [serverLimitTick, setServerLimitTick] = useState(0);
  useEffect(() => { if (!open) setServerLimitMessage(null); }, [open]);
  const showStoreelLimit = () => {
    window.requestAnimationFrame(() => {
      storeelLimitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      storeelLimitRef.current?.focus({ preventScroll: true });
    });
  };
  useEffect(() => { if (serverLimitTick) showStoreelLimit(); }, [serverLimitTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const { openDrivePicker, isPickerLoading: isDrivePickerLoading } = useGoogleDrivePicker();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const introVideoInputRef = useRef<HTMLInputElement>(null);
  const coverPhotoInputRef = useRef<HTMLInputElement>(null);
  // Cover photo OR intro video (Chris, 4 Nov 2026): both are saved as the campaign's last_update_img, so choosing
  // one replaces the other. utils/coverChoice.ts; coverSeqRef numbers each pick so a late upload can't win.
  const [coverChoice, dispatchCover] = useReducer(
    coverChoiceReducer as (s: CoverChoice<Blob>, a: CoverChoiceAction<Blob>) => CoverChoice<Blob>,
    EMPTY_COVER_CHOICE as CoverChoice<Blob>,
  );
  const coverSeqRef = useRef(0);
  // Stops the upload still running for a pick that was replaced or removed.
  const coverUploadAbortRef = useRef<(() => void) | null>(null);
  const isUploadingCover = coverChoice.uploading;
  // The picked file's local link is made with the pick (kept in the same state, so it never lags a render) and
  // freed when it leaves the state.
  useEffect(() => {
    const url = coverChoice.localUrl;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [coverChoice.localUrl]);
  const coverDisplayUrl = coverChoice.localUrl || coverChoice.url;
  /** A new pick or a removal: stop the old upload and number past it, so it can't save or toast. */
  const nextCoverSeq = () => {
    coverUploadAbortRef.current?.();
    coverUploadAbortRef.current = null;
    return ++coverSeqRef.current;
  };
  const clearCover = () => {
    nextCoverSeq();
    dispatchCover({ type: 'clear' });
  };
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [isAddMomentOpen, setIsAddMomentOpen] = useState(false);
  // Chris, 7 Nov 2026 (points 6, 7): the moments' order before the campaign exists (keys; [] = the API's own order),
  // the products / vehicles added with Add a Moment (beside step 1's picks), and where a preview "+" adds moments
  // (a moment's key, null = first; undefined = the Moments card's Add a Moment, at the end).
  const [momentOrder, setMomentOrder] = useState<string[]>([]);
  const [extraCatalog, setExtraCatalog] = useState<InventoryPick[]>([]);
  const [extraCars, setExtraCars] = useState<InventoryPick[]>([]);
  // Add a Moment's "Campaigns (optional)" before the campaign exists (Chris, 8 Nov 2026): sent as linked_memory_ids.
  const [extraCampaigns, setExtraCampaigns] = useState<CampaignPick[]>([]);
  // A non-Moment widget picked before the campaign exists: "Save as Draft first?" (Chris, 8 Nov 2026, point 1).
  const [widgetAsk, setWidgetAsk] = useState<{ kind: AddWidgetKind; label: string; anchor: string | null | undefined } | null>(null);
  const widgetAfterSaveRef = useRef<{ kind: AddWidgetKind; anchor: string | null | undefined } | null>(null);
  const addAnchorRef = useRef<string | null | undefined>(undefined);
  const [momentBusy, setMomentBusy] = useState(false);
  const [deleteAsk, setDeleteAsk] = useState<PreviewMoment | null>(null);
  const [captionRequest, setCaptionRequest] = useState<{ key: string; n: number } | null>(null);
  // See plans from inside this page (review I2): the plans open under it, so leaving is asked first — never silently.
  const [plansAsk, setPlansAsk] = useState<string | null>(null);
  // Moderation per campaign (Chris, 7 Nov 2026, point 12): the person's choice (null = untouched) and the account's
  // setting (the default for a new campaign, and for a saved one that never had its own value).
  const [moderationChoice, setModerationChoice] = useState<boolean | null>(null);
  const [accountModeration, setAccountModeration] = useState<boolean | null>(null);
  const [momentFiles, setMomentFiles] = useState<FileList | null>(null);
  const [isVideoRecorderOpen, setIsVideoRecorderOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    focusTitle: () => (campaignTypeRef.current === 'newsletter' ? newsletterComposerRef.current?.focusName() : titleInputRef.current?.focus()),
  }));

  const [currentTag, setCurrentTag] = useState('');
  // Labels + Tags sit behind an "Advanced filters" toggle. null = automatic: closed,
  // but it opens (and stays open) as soon as a label or tag is set, so nothing set is
  // ever hidden. A click on the toggle sets it explicitly.
  const [advancedFiltersOverride, setAdvancedFiltersOverride] = useState<boolean | null>(null);
  // The full-screen sheet follows window.visualViewport on phones (iOS keyboard).
  const modalOverlayRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Popover and Media Library states
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isMediaLibraryModalOpen, setIsMediaLibraryModalOpen] = useState(false);
  
  // Typing states for black outline
  const [isTypingTitle, setIsTypingTitle] = useState(false);
  const [highlightTitle, setHighlightTitle] = useState(false);
  const [isTypingLocation, setIsTypingLocation] = useState(false);
  const [isTypingTag, setIsTypingTag] = useState(false);
  const [isTypingCollaborator, setIsTypingCollaborator] = useState(false);
  const [isTypingDate, setIsTypingDate] = useState(false);
  const [isTypingEndDate, setIsTypingEndDate] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);

  // Error state
  const [titleError, setTitleError] = useState<string>('');
  
  // API data state
  const [apiCategories, setApiCategories] = useState<any[]>([]);
  const [apiLabels, setApiLabels] = useState<any[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [apiFrequentCollaborators, setApiFrequentCollaborators] = useState<any[]>([]);
  const [apiRecentCollaborators, setApiRecentCollaborators] = useState<any[]>([]);
  const [apiProperties, setApiProperties] = useState<any[]>([]);
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [propertySearch, setPropertySearch] = useState('');

  // Success dialog state
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdMemoryDetails, setCreatedMemoryDetails] = useState<{
    title: string;
    category: string;
    location?: string;
  } | null>(null);

  // Limit exceeded dialog state

  // Photos with metadata state
  const [photosWithMetadata, setPhotosWithMetadata] = useState<Array<{
    file: File;
    name: string;
    location?: string;
    capture_date?: string;
    capture_time?: string;
    fileUrl?: string;
    imageName?: string;
    originalSizeMB?: number;
    metadata_extracted: boolean;
  }>>([]);
  const [isExtractingMetadata, setIsExtractingMetadata] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFilesCount, setUploadedFilesCount] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<Array<{
    id: string; fileName: string; fileType: string; progress: number; status: 'uploading' | 'complete' | 'error';
  }>>([]);

  // EXIF extraction modal state
  const [showExifModal, setShowExifModal] = useState(false);
  const [exifExtractionResults, setExifExtractionResults] = useState<Array<{
    fileName: string;
    hasDate: boolean;
    hasLocation: boolean;
    isProcessing: boolean;
    isCompleted: boolean;
  }>>([]);

  // Main photos array to store all uploaded photos with metadata
  const [mainPhotosArray, setMainPhotosArray] = useState<Array<{
    /** A key of its own (step 2's rows, the preview): never its place in the list. */
    id?: string;
    name: string;
    location: string;
    capture_date: string;
    capture_time?: string;
    fileUrl?: string;
    imageName?: string;
    originalSizeMB?: number;
    title?: string;
    description?: string;
    tags?: string[];
  }>>([]);

  const [formData, setFormData] = useState({
    title: '',
    category: 'Personal', // Default to Personal
    label: '', // Label (sub_category) ID
    property: [] as string[], // Property IDs (multi-select)
    mediaFiles: [] as File[],
    date: localDateISO(),
    endDate: '',
    location: '',
    tags: [] as string[],
    collaborators: [] as string[]
  });

  const advancedFiltersCount = (formData.label ? 1 : 0) + formData.tags.length;
  const advancedFiltersOpen = advancedFiltersOverride ?? advancedFiltersCount > 0;
  // Latch the automatic open: once something is set, removing it inside the section
  // shouldn't collapse the section out from under the user.
  useEffect(() => {
    if (advancedFiltersOverride === null && advancedFiltersCount > 0) setAdvancedFiltersOverride(true);
  }, [advancedFiltersOverride, advancedFiltersCount]);
  // Every fresh open starts with Advanced filters in automatic (closed) mode.
  useEffect(() => {
    if (open) setAdvancedFiltersOverride(null);
  }, [open]);

  // Only the Storeel sheet follows the visual viewport; the Newsletter tab is its own full-window layer.
  useVisualViewportSheet(modalOverlayRef, open && campaignType === 'storeel');

  const [deviceLocation, setDeviceLocation] = useState<string>(''); // Store device location

  // Select from Existing Campaigns
  const [selectFromExisting, setSelectFromExisting] = useState(false);
  const [existingMemories, setExistingMemories] = useState<any[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memorySearch, setMemorySearch] = useState('');
  const [memoryCategoryFilter, setMemoryCategoryFilter] = useState('All Categories');
  // Controls the live suggestions dropdown under the "Search campaigns" box.
  const [isMemorySearchFocused, setIsMemorySearchFocused] = useState(false);
  const memorySearchBoxRef = useRef<HTMLDivElement>(null);
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<string[]>([]);
  // Shopify: when a store is connected we offer a synthetic "Shopify" category.
  // Choosing it turns the "existing campaigns" picker into a list of the store's
  // Shopify collections (from shopifyGetCatalog), all pre-selected.
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const { isStarter: isStarterPlan } = useIsStarterPlan();
  const [shopifyCollections, setShopifyCollections] = useState<any[]>([]);
  const [shopifyCollectionsLoading, setShopifyCollectionsLoading] = useState(false);
  const wasShopifyCategoryRef = useRef(false);
  // Cars: when the read-only /cars catalog has listings, we offer a synthetic
  // "Cars" category (same idea as Shopify) so a new campaign can be tagged under it.
  const [carsAvailable, setCarsAvailable] = useState(false);
  // Choosing the Cars category turns the "existing campaigns" picker into a list
  // of the /cars catalog listings, all pre-selected — mirrors shopifyCollections.
  const [carsForPicker, setCarsForPicker] = useState<any[]>([]);
  const [carsForPickerLoading, setCarsForPickerLoading] = useState(false);
  const wasCarsCategoryRef = useRef(false);
  // Website Catalogue (spec 2026-09-30 §9.2): offered as a category while the account can use the
  // catalogue and has items; picking it turns the picker into the catalogue (up to 50 items).
  const [catalogAvailable, setCatalogAvailable] = useState(false);
  const [catalogForPicker, setCatalogForPicker] = useState<any[]>([]);
  const [catalogNotice, setCatalogNotice] = useState('');
  const wasCatalogCategoryRef = useRef(false);
  // How many campaigns are rendered in the "Select from Existing Campaigns" list —
  // grows as the user scrolls near the bottom (infinite scroll) instead of paging.
  const CAMPAIGNS_LOAD_BATCH = 10;
  const [visibleCampaignsCount, setVisibleCampaignsCount] = useState(CAMPAIGNS_LOAD_BATCH);

  // Add custom scrollbar styles
  useEffect(() => {
    if (!document.getElementById('modal-scrollbar-styles')) {
      const style = document.createElement('style');
      style.id = 'modal-scrollbar-styles';
      style.textContent = `
        .modal-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #9CA3AF #F3F4F6;
        }
        .modal-scrollbar::-webkit-scrollbar {
          width: 8px !important;
        }
        .modal-scrollbar::-webkit-scrollbar-track {
          background: #F3F4F6 !important;
          border-radius: 4px;
        }
        .modal-scrollbar::-webkit-scrollbar-thumb {
          background: #9CA3AF !important;
          border-radius: 4px;
        }
        .modal-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #6B7280 !important;
        }
        .modal-scrollbar::-webkit-scrollbar-thumb:active {
          background: #4B5563 !important;
        }
        
        /* Date input calendar popup styling */
        input[type="date"]::-webkit-calendar-picker-indicator {
          cursor: pointer;
          border-radius: 4px;
          margin-left: 8px;
          opacity: 0.6;
          width: 16px;
          height: 16px;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3crect x='3' y='4' width='18' height='18' rx='2' ry='2'%3e%3c/rect%3e%3cline x1='16' y1='2' x2='16' y2='6'%3e%3c/line%3e%3cline x1='8' y1='2' x2='8' y2='6'%3e%3c/line%3e%3cline x1='3' y1='10' x2='21' y2='10'%3e%3c/line%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: center;
          background-size: contain;
        }
        
        input[type="date"]::-webkit-calendar-picker-indicator:hover {
          opacity: 1;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23374151' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3crect x='3' y='4' width='18' height='18' rx='2' ry='2'%3e%3c/rect%3e%3cline x1='16' y1='2' x2='16' y2='6'%3e%3c/line%3e%3cline x1='8' y1='2' x2='8' y2='6'%3e%3c/line%3e%3cline x1='3' y1='10' x2='21' y2='10'%3e%3c/line%3e%3c/svg%3e");
        }
        
        input[type="date"]::-webkit-datetime-edit {
          color: #374151;
        }
        input[type="date"]::-webkit-datetime-edit-text {
          color: #6B7280;
        }
        input[type="date"]::-webkit-datetime-edit-month-field,
        input[type="date"]::-webkit-datetime-edit-day-field,
        input[type="date"]::-webkit-datetime-edit-year-field {
          color: #374151;
        }
        
        /* Remove default focus ring from date inputs */
        input[type="date"]:focus {
          outline: none !important;
          box-shadow: none !important;
        }
        
        /* Set purple accent color for calendar popup selection */
        input[type="date"] {
          color-scheme: light;
          accent-color: #7C3AED !important;
        }

        /* Some mobile browsers (Android WebView / Samsung Internet) size the native
           date picker control by its own content instead of respecting the Tailwind
           width classes, so it can render wider than the box above it and overflow
           the screen. Force it to match its container like every other input. */
        input[type="date"] {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }

        /* Override select trigger focus styles */
        .create-memory-select [data-slot="select-trigger"]:focus-visible {
          border-color: #d1d5db !important;
          box-shadow: 0 0 0 2px rgba(209, 213, 219, 0.5) !important;
        }

        .create-memory-select [data-slot="select-trigger"]:focus {
          border-color: #d1d5db !important;
          box-shadow: 0 0 0 2px rgba(209, 213, 219, 0.5) !important;
        }

        /* Override select content dropdown styles - remove black border */
        .create-memory-select [data-slot="select-content"],
        .create-memory-select [data-radix-select-content],
        .create-memory-select [role="listbox"],
        [data-radix-popper-content-wrapper] [data-slot="select-content"],
        [data-radix-select-content] {
          border: 1px solid #e5e7eb !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
          outline: none !important;
        }

        /* Additional targeting for Radix UI select content */
        [data-radix-popper-content-wrapper] {
          border: 1px solid #e5e7eb !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
          outline: none !important;
        }
        
        /* Additional styling for webkit browsers to ensure purple selection */
        input[type="date"]::-webkit-inner-spin-button,
        input[type="date"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        
        /* Force purple selection in calendar popup */
        input[type="date"]:focus,
        input[type="date"]:active {
          accent-color: #7C3AED !important;
        }
      `;
      document.head.appendChild(style);
    }
    
    return () => {
      const existingStyle = document.getElementById('modal-scrollbar-styles');
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, [open]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  const opensAtRef = useRef(opensAt);
  opensAtRef.current = opensAt;

  // Detect device location when modal opens
  useEffect(() => {
    if (open && !deviceLocation) {
      console.log('🌍 Detecting device location...');

      // Check if geolocation is available
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            console.log('📍 Device coordinates:', { latitude, longitude });

            try {
              // Reverse geocode to get location name
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`
              );
              const data = await response.json();

              // Extract city and country
              const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county;
              const country = data.address?.country;

              let locationString = '';
              if (city && country) {
                locationString = `${city}, ${country}`;
              } else if (city) {
                locationString = city;
              } else if (country) {
                locationString = country;
              } else {
                locationString = data.display_name?.split(',').slice(0, 2).join(',').trim() || '';
              }

              console.log('✅ Device location detected:', locationString);
              setDeviceLocation(locationString);

              // Set as default location only if location field is empty
              if (locationString && !formData.location) {
                setFormData(prev => ({ ...prev, location: locationString }));
                console.log('✅ Set default location:', locationString);
              }
            } catch (error) {
              console.error('❌ Error reverse geocoding:', error);
            }

            // Re-focus title input after permission popup closes (keyboard restore) — not when opened at the Send card
            // (the campaign page's Send, Chris 8 Nov 2026 (b)): focusing the title would scroll back to step 1.
            setTimeout(() => { if (!opensAtTarget(opensAtRef.current)) titleInputRef.current?.focus(); }, 300);
          },
          (error) => {
            console.log('⚠️ Geolocation error:', error.message);
            // Re-focus title input after permission popup closes (keyboard restore) — not when opened at the Send card
            // (the campaign page's Send, Chris 8 Nov 2026 (b)): focusing the title would scroll back to step 1.
            setTimeout(() => { if (!opensAtTarget(opensAtRef.current)) titleInputRef.current?.focus(); }, 300);
          },
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 0
          }
        );
      } else {
        console.log('⚠️ Geolocation not available in this browser');
      }
    }
  }, [open, deviceLocation]);

  // ── Shopify category ──────────────────────────────────────────────────────
  // Sentinel id sent to the backend as category_id when the user picks Shopify.
  // (The backend resolves it; it is not a real category row.) Match on backend.
  const SHOPIFY_CATEGORY_NAME = 'Shopify';
  const SHOPIFY_CATEGORY_ID = 'shopify';
  const isShopifyCategory = formData.category === SHOPIFY_CATEGORY_NAME;
  // Sentinel id sent to the backend as category_id when the user picks Cars.
  // (Mirrors the Shopify sentinel above — not a real category row.)
  const CARS_CATEGORY_NAME = 'Cars';
  const CARS_CATEGORY_ID = 'cars';
  const isCarsCategory = formData.category === CARS_CATEGORY_NAME;
  // Sentinel id sent as category_id for a Website Catalogue campaign; the backend files the
  // campaign under the account's real "Website Catalogue" category (created on first use).
  const CATALOG_CATEGORY_NAME = 'Website Catalogue';
  const CATALOG_CATEGORY_ID = 'website_catalogue';
  const CATALOG_MAX_ITEMS = 50;
  const isCatalogCategory = catalogAvailable && formData.category === CATALOG_CATEGORY_NAME;
  // The synthetic Shopify/Cars entries are appended only while available, so they
  // appear in the dropdown and are findable at submit for their category_id.
  const categoriesForDropdown = [
    // While the catalogue is available, the synthetic entry replaces the account's real
    // "Website Catalogue" category (same name): picking it builds a catalogue campaign, which the
    // backend files under that real category anyway.
    ...(catalogAvailable
      ? apiCategories.filter((c: any) => (c.name || '').trim().toLowerCase() !== CATALOG_CATEGORY_NAME.toLowerCase())
      : apiCategories),
    ...(shopifyConnected ? [{ id: SHOPIFY_CATEGORY_ID, name: SHOPIFY_CATEGORY_NAME, __isShopify: true }] : []),
    ...(carsAvailable ? [{ id: CARS_CATEGORY_ID, name: CARS_CATEGORY_NAME }] : []),
    ...(catalogAvailable ? [{ id: CATALOG_CATEGORY_ID, name: CATALOG_CATEGORY_NAME }] : []),
  ];
  // A saved campaign's own category is always offered as it is (Shopify / Cars / a property's category / "Current
  // category"), so Set up never falls back to another one; keeping it sends no category_id (review, 4 Nov).
  if (seededCategory && !categoriesForDropdown.some((c: any) => c.name === seededCategory)) {
    categoriesForDropdown.push({ id: '__seeded', name: seededCategory });
  }

  // Shared by the "Select from Existing Campaigns" list and its search-suggestions dropdown.
  // "All Categories" merges every source (real campaigns + Cars + Shopify) since those two
  // are pulled from separate catalog APIs, not from the regular campaigns list — without this
  // they'd never show up unless the user filters specifically to "Cars"/picks it as the category.
  const existingCampaignsPickerSource = isCatalogCategory
    ? catalogForPicker
    : isShopifyCategory
    ? shopifyCollections
    : (isCarsCategory || memoryCategoryFilter === CARS_CATEGORY_NAME)
    ? carsForPicker
    : memoryCategoryFilter === 'All Categories'
    ? [...existingMemories, ...carsForPicker, ...shopifyCollections]
    : existingMemories;
  const memorySearchSuggestions = memorySearch.trim()
    ? existingCampaignsPickerSource.filter((m: any) => {
        const locStr = typeof m.location === 'string' ? m.location : (m.location?.formatted || m.location?.address || '');
        const matchSearch = (m.title || '').toLowerCase().includes(memorySearch.toLowerCase()) || locStr.toLowerCase().includes(memorySearch.toLowerCase());
        const matchCat = memoryCategoryFilter === 'All Categories' || (m.category?.name || m.category || '') === memoryCategoryFilter;
        return matchSearch && matchCat;
      }).slice(0, 20)
    : [];

  // Website Catalogue campaigns take at most CATALOG_MAX_ITEMS items (spec §10); other pickers are unlimited.
  const catalogCapMessage = `You can add up to ${CATALOG_MAX_ITEMS} items to one campaign.`;
  const toggleSelectedId = (id: string) => {
    if (selectedMemoryIds.includes(id)) {
      setSelectedMemoryIds(prev => prev.filter(x => x !== id));
      setCatalogNotice('');
      return;
    }
    if (isCatalogCategory && selectedMemoryIds.length >= CATALOG_MAX_ITEMS) {
      setCatalogNotice(catalogCapMessage);
      return;
    }
    setSelectedMemoryIds(prev => (prev.includes(id) ? prev : [...prev, id]));
    setCatalogNotice('');
  };
  const selectAllIds = (ids: string[]) => {
    if (isCatalogCategory && ids.length > CATALOG_MAX_ITEMS) {
      setSelectedMemoryIds(ids.slice(0, CATALOG_MAX_ITEMS));
      setCatalogNotice(`${catalogCapMessage} The first ${CATALOG_MAX_ITEMS} are selected.`);
      return;
    }
    setSelectedMemoryIds(ids);
    setCatalogNotice('');
  };

  // Detect a connected store when the modal opens, to gate the Shopify option.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await dashboardAPI.shopifyGetStatus();
        // Shopify is switched off on the free plan (e.g. after a downgrade).
        if (!cancelled) setShopifyConnected(res?.data?.connected === true && !isStarterPlan);
      } catch { if (!cancelled) setShopifyConnected(false); }
    })();
    return () => { cancelled = true; };
  }, [open, isStarterPlan]);

  // Detect whether the Cars catalog has any listings, to gate the Cars option.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await dashboardAPI.carsGetCatalog();
        const list = res?.data?.data?.cars || (res?.data as any)?.cars || [];
        if (!cancelled) setCarsAvailable(res?.success === true && Array.isArray(list) && list.length > 0);
      } catch { if (!cancelled) setCarsAvailable(false); }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Detect whether the account can use the Website Catalogue and has items, to gate its option.
  // loadCatalogueForBrowsing asks GET /website-catalogue first, so accounts without the feature
  // never call the Business-only items route (whose 403 would open the upgrade modal).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadCatalogueForBrowsing().then((list) => {
      if (cancelled) return;
      setCatalogForPicker(list.map((item) => ({
        id: item.id,
        title: item.title || 'Untitled item',
        location: [item.price_label, item.category].filter(Boolean).join(' · ') || CATALOG_CATEGORY_NAME,
        category: { name: CATALOG_CATEGORY_NAME },
        last_update_img: item.main_image || '',
        posts_count: item.images_count || 0,
        // The live preview's product moment: its price and whether it gets a "View on website" button.
        price_label: item.price_label || '',
        url: item.url || null,
      })));
      setCatalogAvailable(list.length > 0);
    });
    return () => { cancelled = true; };
  }, [open]);

  // Pull the user's existing campaigns for the "Select from Existing Campaigns" picker.
  const loadExistingMemories = async () => {
    setMemoriesLoading(true);
    try {
      const res = await dashboardAPI.getMemories();
      const actualData = res?.data?.data || res?.data || {};
      const list =
        actualData?.all_memories?.data ||
        (Array.isArray(actualData?.all_memories) ? actualData.all_memories : null) ||
        actualData?.memories ||
        actualData?.user_memories ||
        [];
      setExistingMemories(Array.isArray(list) ? list : []);
    } catch {}
    setMemoriesLoading(false);
  };

  // "Select from Existing Campaigns" starts unchecked whenever the modal opens —
  // still preloads the list in the background so it's ready the moment the user checks it.
  useEffect(() => {
    if (!open) return;
    setSelectFromExisting(false);
    if (existingMemories.length === 0) loadExistingMemories();
  }, [open]);

  // Pull the store's collections. Normalised into the same shape the existing-campaigns
  // picker already renders (id/title/count/thumb). Pre-ticks them all only when explicitly
  // switching into Shopify as the category — a background load for the "All Categories"
  // merge (see existingCampaignsPickerSource) must NOT silently select everything.
  const loadShopifyCollections = async (autoSelectAll = true) => {
    setShopifyCollectionsLoading(true);
    try {
      const res = await dashboardAPI.shopifyGetCatalog();
      const data: any = (res?.data as any)?.data || res?.data || {};
      const raw = data.collections || data.catalog?.collections || [];
      const list = (Array.isArray(raw) ? raw : [])
        .filter((c: any) => c?.id != null)
        .map((c: any) => ({
          id: c.id,
          title: c.title || 'Untitled collection',
          location: '',
          category: { name: SHOPIFY_CATEGORY_NAME },
          last_update_img: c.cover?.image || c.cover?.images?.[0] || c.image || (Array.isArray(c.products) ? c.products[0]?.image : '') || '',
          posts_count: c.products_count ?? (Array.isArray(c.products) ? c.products.length : 0),
        }));
      setShopifyCollections(list);
      if (autoSelectAll) setSelectedMemoryIds(list.map((c: any) => String(c.id)));
    } catch { /* leave list empty */ }
    setShopifyCollectionsLoading(false);
  };

  // React to the Shopify category being chosen / deselected.
  useEffect(() => {
    if (!open) return;
    if (isShopifyCategory) {
      setSelectFromExisting(true);
      if (shopifyCollections.length === 0) loadShopifyCollections();
      else setSelectedMemoryIds(shopifyCollections.map((c: any) => String(c.id)));
    } else if (wasShopifyCategoryRef.current) {
      // Leaving Shopify: the selection held collection ids, not memory ids — drop it.
      setSelectedMemoryIds([]);
      setSelectFromExisting(false);
    }
    wasShopifyCategoryRef.current = isShopifyCategory;
  }, [isShopifyCategory, open]);

  // Pull the /cars catalog. Normalised into the same shape the existing-campaigns picker
  // already renders (id/title/count/thumb). Pre-ticks all listings only when explicitly
  // switching into Cars as the category — a background load for the "All Categories" merge
  // (see existingCampaignsPickerSource) must NOT silently select everything.
  const loadCarsForPicker = async (autoSelectAll = true) => {
    setCarsForPickerLoading(true);
    try {
      const res = await dashboardAPI.carsGetCatalog();
      const raw = res?.data?.data?.cars || (res?.data as any)?.cars || [];
      const list = (Array.isArray(raw) ? raw : [])
        .filter((c: any) => c?.id != null)
        .map((c: any) => ({
          id: c.id,
          title: c.title || 'Untitled car',
          location: c.location || '',
          category: { name: CARS_CATEGORY_NAME },
          last_update_img: c.main_image || '',
          posts_count: c.images_count || 0,
          // The live preview's vehicle moment, as car moments show on the campaign page.
          price: c.price ?? null,
          mileage: c.mileage ?? null,
          stock_number: c.stock_number ?? null,
        }));
      setCarsForPicker(list);
      if (autoSelectAll) setSelectedMemoryIds(list.map((c: any) => String(c.id)));
    } catch { /* leave list empty */ }
    setCarsForPickerLoading(false);
  };

  // React to the Cars category being chosen / deselected. Picking Cars just switches the
  // picker to show the Cars catalog — it doesn't pre-select any of them anymore.
  useEffect(() => {
    if (!open) return;
    if (isCarsCategory) {
      setSelectFromExisting(true);
      if (carsForPicker.length === 0) loadCarsForPicker(false);
    } else if (wasCarsCategoryRef.current) {
      // Leaving Cars: the selection held car ids, not memory ids — drop it.
      setSelectedMemoryIds([]);
      setSelectFromExisting(false);
    }
    wasCarsCategoryRef.current = isCarsCategory;
  }, [isCarsCategory, open]);

  // React to the Website Catalogue category being chosen / left. Entering starts a clean selection
  // (it held memory, car or collection ids) and opens the picker on the catalogue.
  useEffect(() => {
    if (!open) return;
    if (isCatalogCategory) {
      if (!wasCatalogCategoryRef.current) {
        setSelectedMemoryIds([]);
        setMemoryCategoryFilter('All Categories');
        setMemorySearch('');
        setCatalogNotice('');
      }
      setSelectFromExisting(true);
    } else if (wasCatalogCategoryRef.current) {
      setSelectedMemoryIds([]);
      setSelectFromExisting(false);
      setCatalogNotice('');
    }
    wasCatalogCategoryRef.current = isCatalogCategory;
  }, [isCatalogCategory, open]);

  // Also load the Cars catalog when picked from the existing-campaigns filter
  // (not just the main Category field) so the picker has something to show.
  useEffect(() => {
    if (!open) return;
    if (memoryCategoryFilter === CARS_CATEGORY_NAME && carsForPicker.length === 0 && !carsForPickerLoading) {
      loadCarsForPicker(false);
    }
  }, [memoryCategoryFilter, open]);

  // Background-load Cars/Shopify (without pre-selecting them) as soon as the
  // existing-campaigns picker is open, so the "All Categories" merge has them ready
  // without waiting for the user to specifically switch into either category.
  useEffect(() => {
    if (!open || !selectFromExisting) return;
    if (carsAvailable && carsForPicker.length === 0 && !carsForPickerLoading) loadCarsForPicker(false);
    if (shopifyConnected && shopifyCollections.length === 0 && !shopifyCollectionsLoading) loadShopifyCollections(false);
  }, [open, selectFromExisting, carsAvailable, shopifyConnected]);

  // Fetch categories, labels and collaborators from API
  const fetchCategoriesLabels = async (skipCategories = false) => {
    try {
      setIsLoading(true);

      // On property account use the property memories endpoint so we get property-specific categories
      const response = (viewType === 'property' && currentProperty)
        ? await dashboardAPI.getPropertyMemories(currentProperty.id)
        : await dashboardAPI.getCategoriesLabels();

      if (response.success && response.data) {
        // Same unwrapping as App.tsx fetchMemoriesData
        const actualData = response.data?.data || response.data;

        // Try every known path to find the categories array
        let categoriesArray: any[] = [];

        const candidates = [
          actualData?.sidebar?.categories?.items,
          actualData?.data?.sidebar?.categories?.items,
          actualData?.data?.categories?.items,
          actualData?.categories?.items,
          Array.isArray(actualData?.categories) ? actualData.categories : null,
          Array.isArray(actualData?.data?.categories) ? actualData.data.categories : null,
          Array.isArray(actualData) ? actualData : null,
        ];

        for (const candidate of candidates) {
          if (Array.isArray(candidate) && candidate.length > 0 && candidate[0]?.name) {
            categoriesArray = candidate;
            break;
          }
        }

        if (categoriesArray.length > 0 && !skipCategories) {
          const uniqueCategories = categoriesArray
            .filter(cat => {
              const name = (cat.name || '').toLowerCase().trim();
              return !['shared with', 'published', 'shared', 'invites'].includes(name) && !name.includes('shared');
            })
            .filter(cat => cat.is_owner !== false && cat.can_add_story !== false)
            .filter((cat, i, self) => self.findIndex(c => c.name === cat.name) === i);

          setApiCategories(uniqueCategories);
        }

        // Extract labels/tags — use direct labels path first, NOT sidebar (sidebar has historical/stale labels)
        const labelCandidates = [
          actualData?.data?.labels?.items,
          actualData?.labels?.items,
          Array.isArray(actualData?.data?.labels) ? actualData.data.labels : null,
          Array.isArray(actualData?.labels) ? actualData.labels : null,
        ];
        let labelsSet = false;
        for (const candidate of labelCandidates) {
          if (Array.isArray(candidate) && candidate.length > 0) {
            setApiLabels(candidate);
            console.log('Labels loaded:', candidate);
            labelsSet = true;
            break;
          }
        }
        if (!labelsSet) setApiLabels([]);
        
        // Extract collaborators - check multiple possible structures
        console.log('Full actualData structure:', actualData);
        console.log('actualData.data structure:', actualData.data);
        
        // Try different possible paths for collaborators
        // Path 1: actualData.data.frequent_collaborators and actualData.data.recent_collaborators
        if (actualData.data?.frequent_collaborators) {
          const frequentCollab = Array.isArray(actualData.data.frequent_collaborators) 
            ? actualData.data.frequent_collaborators 
            : actualData.data.frequent_collaborators.items || [];
          setApiFrequentCollaborators(frequentCollab);
          console.log('Frequent collaborators loaded (path 1):', frequentCollab);
        }
        
        if (actualData.data?.recent_collaborators) {
          const recentCollab = Array.isArray(actualData.data.recent_collaborators)
            ? actualData.data.recent_collaborators
            : actualData.data.recent_collaborators.items || [];
          setApiRecentCollaborators(recentCollab);
          console.log('Recent collaborators loaded (path 1):', recentCollab);
        }
        
        // Path 2: actualData.data.collaborators as single array
        if (actualData.data?.collaborators && Array.isArray(actualData.data.collaborators)) {
          // If collaborators is a single array, use it for both recent and frequent
          setApiRecentCollaborators(actualData.data.collaborators);
          setApiFrequentCollaborators(actualData.data.collaborators);
          console.log('Collaborators loaded (path 2):', actualData.data.collaborators);
        }
        
        // Path 3: Original nested structure (kept as fallback)
        if (actualData.data?.collaborators && !Array.isArray(actualData.data.collaborators)) {
          if (actualData.data.collaborators.frequent?.items) {
            setApiFrequentCollaborators(actualData.data.collaborators.frequent.items);
            console.log('Frequent collaborators loaded (path 3):', actualData.data.collaborators.frequent.items);
          }
          
          if (actualData.data.collaborators.recent?.items) {
            setApiRecentCollaborators(actualData.data.collaborators.recent.items);
            console.log('Recent collaborators loaded (path 3):', actualData.data.collaborators.recent.items);
          }
        }
      } else {
        console.error('Failed to fetch categories and labels:', response);
      }
    } catch (error) {
      console.error('Error fetching categories and labels:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch properties owned by the user
  const fetchProperties = async () => {
    try {
      console.log('🏠 Fetching properties for create memory...');
      const response = await dashboardAPI.getProperties();

      if (response.success || response.status === 'success') {
        const responseData = response.data || response;
        const properties = responseData.properties || responseData.data?.properties || [];

        // Filter to only show properties where user is creator/owner
        const ownedProperties = properties.filter((prop: any) => prop.is_creator === true);

        setApiProperties(ownedProperties);
        console.log('🏠 Owned properties loaded:', ownedProperties);

        // Leave property unselected — user picks it optionally
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  // ── The Storeel flow v2 (Deepak, 4 Nov 2026; Chris the same day: "flow just like newsletter"): ONE page, cards all
  // open — 1 Campaign · 2 Moments · 3 Send (optional) — and the actions at the bottom of the list: Save as Draft /
  // Save & Send (edit: Save Changes / Save & Send). Nothing is created or saved before one of them is pressed.
  // Editing a saved campaign (campaignId): no pickers or property here (PUT doesn't change them); its moments are
  // shown in step 2, where the original Add a Moment UI works on the campaign directly.
  const flowEditing = Boolean(campaignId);
  // The saved campaign: the one being edited, or the one Save & Send just made.
  const [flowCampaign, setFlowCampaignState] = useState<CampaignSeed | null>(null);
  const flowCampaignRef = useRef<CampaignSeed | null>(null);
  const setFlowCampaign = (seed: CampaignSeed | null) => { flowCampaignRef.current = seed; setFlowCampaignState(seed); };
  // Save & Send made the campaign in this flow (its send not confirmed yet): saving again is a PUT.
  const [flowCreated, setFlowCreated] = useState(false);
  // A caption or moment saved straight to the saved campaign (step 2), and Edit's Save & Send left at the confirm.
  const [savedNow, setSavedNow] = useState(false);
  const [changesSaved, setChangesSaved] = useState(false);
  const view = flowView({ editing: flowEditing, created: flowCreated, savedNow, changesSaved });
  // A save refused (missing title, no catalogue item, the API's answer): one line above the actions, and the field
  // it is about is scrolled to and focused (the actions are at the end of the page, far from it).
  const [actionError, setActionError] = useState<string | null>(null);
  const showActionError = (text: string, target: 'title' | string) => {
    setActionError(text);
    window.requestAnimationFrame(() => {
      const el = target === 'title' ? titleInputRef.current : document.getElementById(target);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el as HTMLElement | null)?.focus?.({ preventScroll: true });
    });
  };
  // The refusal is about what was there then: it goes once the title, the category or the picked items change.
  useEffect(() => { setActionError(null); }, [formData.title, formData.category, selectedMemoryIds]);
  // The Send card is filled in (someone to send to, or a message): Save as Draft then says it was not sent.
  const [sendFilled, setSendFilled] = useState(false);
  // Add a Moment's "Add from Media Library": the library opens over it (the files chosen in it stay), and on a saved
  // campaign its picks go back into it, as on the campaign page.
  const [libraryForMoment, setLibraryForMoment] = useState(false);
  const [momentLibraryImages, setMomentLibraryImages] = useState<Array<{ id: string; image: string; title: string; category: string; date?: string; location?: string }>>([]);
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowLoadError, setFlowLoadError] = useState<string | null>(null);
  // Step 1's own refusal (PUT /memories/{id}), shown on its card; a title problem shows under the title.
  const [setupError, setSetupError] = useState<string | null>(null);
  // The cover the campaign had when it was opened or last saved: last_update_img is sent only when it changes.
  const initialCoverUrlRef = useRef<string | null>(null);
  // Save & Send: each new number asks the Send card to confirm, once the campaign is saved.
  const [sendRequest, setSendRequest] = useState(0);
  // What still stops a send (the Send card says), shown at the bottom Save & Send button.
  const [sendBlocker, setSendBlocker] = useState<string | null>(null);
  // Which bottom button is working (its spinner).
  const [savingAction, setSavingAction] = useState<'save' | 'send' | null>(null);
  // The API said this account may not send the campaign (403 on the count).
  const [sendForbidden, setSendForbidden] = useState(false);
  // Who the Storeel's texts say they came from (StoreelSendService::senderLabel).
  const flowSender = senderLabelFor(user?.name, viewType === 'property' ? currentProperty?.name : null);

  /** Step 1 shows the saved campaign: its fields and its cover (photo or intro video). */
  const applySeed = (seed: CampaignSeed) => {
    const f = formFromSeed(seed);
    // A campaign with no dates keeps none (no date_range is sent); its category is kept as it is (review, 4 Nov).
    setSeededCategory(f.category);
    setFormData(prev => ({
      ...prev, title: f.title, category: f.category, label: f.label, date: f.date, endDate: f.endDate,
      location: f.location, tags: f.tags, property: [], mediaFiles: [], collaborators: [],
    }));
    setShowEndDate(Boolean(f.endDate));
    setTitleError('');
    const cover = coverFromSeed(seed);
    initialCoverUrlRef.current = cover?.url ?? null;
    if (cover) dispatchCover({ type: 'ready', seq: nextCoverSeq(), kind: cover.kind, file: null, name: cover.kind === 'video' ? 'Intro video' : 'Cover photo', url: cover.url });
    else clearCover();
  };

  // Fetch data when modal opens
  useEffect(() => {
    if (open && isAuthenticated) {
      // Use categories from prop if available, otherwise fetch from API
      let resolvedCategories: any[] = [];
      if (categoriesProp && categoriesProp.length > 0) {
        const filtered = categoriesProp.filter((cat: any) => {
          const name = (cat.name || '').toLowerCase().trim();
          return !['shared with', 'published', 'shared', 'invites'].includes(name) && !name.includes('shared') && cat.is_owner !== false && cat.can_add_story !== false;
        });
        if (filtered.length > 0) {
          setApiCategories(filtered);
          resolvedCategories = filtered;
          // Still fetch labels even though categories come from prop
          fetchCategoriesLabels(true);
        } else {
          // Prop had only system categories after filtering — fetch from correct endpoint
          fetchCategoriesLabels();
        }
      } else {
        fetchCategoriesLabels();
      }
      fetchProperties();
      // The flow on a saved campaign (Edit, back from its page, or just created): the form shows that campaign.
      if (campaignId || flowCampaignRef.current) return undefined;

      // Pick default category: prefer a specific defaultCategory when supplied (the
      // sidebar's per-category "+" button). The generic "Create a Campaign" button
      // passes no defaultCategory — it falls back to "Personal" (every account's
      // standard category) so users aren't forced to pick one for the common case,
      // unless a pinned preference from Profile Settings > Categories is loaded below.
      const categoryExists = resolvedCategories.some((c: any) => c.name === defaultCategory);
      const personalCategory = resolvedCategories.find((c: any) => c.name === 'Personal')?.name || '';
      const resolvedCategory = categoryExists ? defaultCategory! : (defaultCategory && resolvedCategories.length === 0 ? defaultCategory : personalCategory);

      // Reset all states when modal opens fresh
      setFormData({
        title: '',
        category: resolvedCategory,
        label: '',
        property: [] as string[],
        mediaFiles: [],
        date: localDateISO(),
        endDate: '',
        location: '',
        tags: [],
        collaborators: []
      });
      setLabelInput('');
      setShowPropertyDropdown(false);
      setPropertySearch('');
      setMainPhotosArray([]);
      setMomentOrder([]);
      setExtraCatalog([]);
      setExtraCars([]);
      addAnchorRef.current = undefined;
      setModerationChoice(null);
      setPhotosWithMetadata([]);
      setExifExtractionResults([]);
      setShowExifModal(false);
      setShowEndDate(false);
      setCurrentTag('');
      clearCover();

      // Default the new-campaign category (and the existing-campaigns filter) to whatever
      // category the user pinned in Profile Settings > Categories, overriding the reset
      // above — but only when a preference is actually set; if the user hasn't pinned one,
      // the defaultCategory/first-category logic above stands. Fetched here (inside the
      // same effect as the reset, instead of a separate effect keyed only on [open,
      // isAuthenticated]) so a mid-session `user` object change — which re-runs this whole
      // effect — can't re-apply the plain reset without also re-applying this override.
      let cancelled = false;
      (async () => {
        try {
          const res = await dashboardAPI.getNotificationPreferences();
          // The same answer gives the Moderation switch its default (Chris, 7 Nov 2026; review M3: one request).
          if (!cancelled) setAccountModeration(accountModerationFrom(res));
          if (cancelled || !res?.success || !res.data) return;

          // apiRequest returns the whole server payload as `data` (i.e. { status, data: {...} }),
          // it doesn't unwrap the inner `data` — so the real fields are one level deeper.
          const prefsData = (res.data as any)?.data || res.data;

          const rawCategoryId = prefsData.category_id;
          let preferredName: string | null = null;
          if (rawCategoryId === 'shopify') preferredName = SHOPIFY_CATEGORY_NAME;
          else if (rawCategoryId === 'cars') preferredName = CARS_CATEGORY_NAME;
          else if (prefsData.category?.name) preferredName = prefsData.category.name;

          if (preferredName) {
            setFormData(prev => ({ ...prev, category: preferredName as string }));
            setMemoryCategoryFilter(preferredName);
            // Per the "Add from Campaigns Selector" spec: pinning a category as
            // "always visible" in Profile Settings should also turn on "Select
            // from Existing Campaigns" here, pre-filtered to that category.
            setSelectFromExisting(true);
          }
        } catch { if (!cancelled) setAccountModeration(true); /* keep the existing default */ }
      })();
      return () => { cancelled = true; };
    }
  }, [open, isAuthenticated, defaultCategory, categoriesProp, user]);

  // Open on a saved campaign (the campaign page's Edit): its data (passed in, or GET /memories/{id}), step 1 open.
  // Closing forgets the flow.
  useEffect(() => {
    if (!open) {
      setFlowCreated(false);
      setSavedNow(false);
      setChangesSaved(false);
      setActionError(null);
      setSendFilled(false);
      setLibraryForMoment(false);
      setMomentLibraryImages([]);
      setSendRequest(0);
      setSendBlocker(null);
      setSavingAction(null);
      setFlowCampaign(null);
      setFlowLoading(false);
      setFlowLoadError(null);
      setSetupError(null);
      setSendForbidden(false);
      setSeededCategory(null);
      initialCoverUrlRef.current = null;
      return undefined;
    }
    if (!campaignId) return undefined;
    let cancelled = false;
    const begin = (seed: CampaignSeed) => {
      if (cancelled) return;
      setFlowCampaign(seed);
      applySeed(seed);
      setFlowLoading(false);
      setFlowLoadError(null);
    };
    if (campaignSeed && campaignSeed.id === campaignId) {
      begin(campaignSeed);
    } else {
      setFlowLoading(true);
      setFlowLoadError(null);
      const failed = (message?: string) => {
        if (cancelled) return;
        setFlowLoading(false);
        setFlowLoadError(message || "This campaign couldn't be opened. Check your connection and try again.");
      };
      dashboardAPI.getMemoryDetails(String(campaignId)).then((res) => {
        const seed = res?.success ? seedFromMemory(res.data, categoriesProp?.length ? categoriesProp : apiCategories) : null;
        if (seed) begin(seed);
        else failed(res?.error);
      }).catch(() => failed());
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campaignId]);

  // The campaign page's Send (Chris, 8 Nov 2026 (b), point 2): once the saved campaign is shown, bring the Send card to
  // the top, once per opening. Edit opens at the top (step 1) as before.
  const openedAtRef = useRef(false);
  useEffect(() => {
    if (!open) { openedAtRef.current = false; return undefined; }
    const target = opensAtTarget(opensAt);
    if (!target || openedAtRef.current || !flowCampaign || flowLoading) return undefined;
    // Marked done only once it has scrolled (a cancelled frame — StrictMode's re-run — tries again).
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => {
        const el = document.getElementById(target);
        if (!el) return;
        openedAtRef.current = true;
        el.scrollIntoView({ block: 'start' });
        el.focus?.({ preventScroll: true });
      });
    });
    return () => { window.cancelAnimationFrame(outer); window.cancelAnimationFrame(inner); };
  }, [open, opensAt, flowCampaign, flowLoading]);

  // Published / unpublished from the Publishing card: the Send card's checks (a private link can't be sent; view-only
  // texts) follow the campaign page's state.
  useEffect(() => {
    const cur = flowCampaignRef.current;
    if (!open || !campaignSeed || !cur || campaignSeed.id !== cur.id) return;
    if (campaignSeed.published !== cur.published || campaignSeed.slug !== cur.slug) {
      setFlowCampaign({ ...cur, published: campaignSeed.published, slug: campaignSeed.slug ?? cur.slug });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campaignSeed?.id, campaignSeed?.published, campaignSeed?.slug]);

  // Completes the category resolution once apiCategories loads asynchronously — the
  // synchronous pass above only sees categories already available via categoriesProp,
  // so when that prop is empty (categories come from fetchCategoriesLabels() instead,
  // which resolves after this effect runs), formData.category is still '' at that
  // point and needs to be filled in here once the fetch actually completes.
  useEffect(() => {
    if (open && !campaignId && !flowCampaignRef.current && apiCategories.length > 0 && !formData.category) {
      const matchName = defaultCategory || 'Personal';
      const matched = apiCategories.find((c: any) => c.name === matchName);
      if (matched) {
        setFormData(prev => ({ ...prev, category: matched.name }));
      }
    }
  }, [apiCategories, open, defaultCategory]);

  // Removed the complex useEffect - now completing upload directly

  // Effect to monitor photosWithMetadata changes
  useEffect(() => {
    console.log('📸 PHOTOS WITH METADATA CHANGED:', {
      length: photosWithMetadata.length,
      data: photosWithMetadata,
      trigger: 'useEffect dependency change'
    });

    // If this change happened after modal opened and we have data, it might be the restoration
    if (open && photosWithMetadata.length > 0) {
      console.log('🎉 PHOTOS WITH METADATA RESTORED IN MODAL:', {
        length: photosWithMetadata.length,
        photos: photosWithMetadata.map(p => ({
          name: p.name,
          location: p.location,
          date: p.capture_date,
          metadata_extracted: p.metadata_extracted
        }))
      });
    }
  }, [photosWithMetadata, open]);

  // Handle selected media library images
  useEffect(() => {
    if (selectedMediaLibraryImages && selectedMediaLibraryImages.length > 0 && open) {
      console.log('📚 PROCESSING SELECTED MEDIA LIBRARY IMAGES:', selectedMediaLibraryImages);

      // Convert selected media library images to the format used by mainPhotosArray
      const libraryPhotos = selectedMediaLibraryImages.map(img => ({
        name: img.name || 'Untitled',
        location: img.location || '',
        capture_date: img.capture_date || img.captureDate || '',
        capture_time: img.capture_time || img.captureTime || '',
        fileUrl: img.image || img.url || img.fileUrl || '',
        imageName: img.imageName || img.name || '',
        originalSizeMB: img.originalSizeMB || 0
      }));

      // Add to mainPhotosArray
      setMainPhotosArray(prev => [...prev, ...withPhotoIds(libraryPhotos)]);

      console.log('✅ Added media library images to mainPhotosArray:', libraryPhotos);
    }
  }, [selectedMediaLibraryImages, open]);

  // Click outside the "Search campaigns" box closes its suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (memorySearchBoxRef.current && !memorySearchBoxRef.current.contains(event.target as Node)) {
        setIsMemorySearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Don't return null if we have a success dialog to show
  // Scan Photo: the photo taken arrives with the request; offer it like one picked in the form's own photo button.
  const handledPhotosRef = useRef<File[] | null>(null);
  useEffect(() => {
    if (!open) { handledPhotosRef.current = null; return; }
    if (!initialPhotos?.length || handledPhotosRef.current === initialPhotos) return;
    handledPhotosRef.current = initialPhotos;
    const valid = initialPhotos.filter((f) => ['image/jpeg', 'image/jpg', 'image/png'].includes(f.type.toLowerCase()));
    if (!valid.length) {
      toast.error('That photo type can’t be added here. Use a JPG or PNG photo.');
      return;
    }
    const dt = new DataTransfer();
    valid.forEach((f) => dt.items.add(f));
    setMomentFiles(dt.files);
    setIsAddMomentOpen(true);
  }, [open, initialPhotos]);

  // A campaign-page widget editor (or Voice to Text) just closed over this page (Chris, 8 Nov 2026): show the campaign
  // as it now is. (Above the early return: hooks run on every render.)
  // DocuSign connected? Asked when the Storeel page opens without the campaign page's options (Create).
  const [docuSignOn, setDocuSignOn] = useState(false);
  useEffect(() => {
    if (!DOCUSIGN_ENABLED || !open || widgetOptions) return undefined; // DocuSign hidden: status not called (constants/features.ts)
    let cancelled = false;
    dashboardAPI.docuSignGetStatus().then((res: any) => { if (!cancelled) setDocuSignOn(Boolean(res?.data?.connected ?? res?.data?.data?.connected ?? res?.connected)); }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, Boolean(widgetOptions)]);
  const editorWasOpenRef = useRef(false);
  const refreshSavedRef = useRef<((id: number) => void) | null>(null);
  useEffect(() => {
    if (editorWasOpenRef.current && !widgetEditorOpen && flowCampaignRef.current) refreshSavedRef.current?.(flowCampaignRef.current.id);
    editorWasOpenRef.current = widgetEditorOpen;
  }, [widgetEditorOpen]);

  if (!open && !showSuccessDialog) return null;

  // Debug current state when modal is open
  if (open) {
    console.log('🖼️ MODAL IS OPEN - Current state:', {
      formDataMediaFilesLength: formData.mediaFiles.length,
      photosWithMetadataLength: photosWithMetadata.length,
      mainPhotosArrayLength: mainPhotosArray.length,
      photosWithMetadataData: photosWithMetadata,
      formDataDetail: formData
    });
  }

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleModalClose();
    }
  };

  // Handle backdrop click
  const handleModalClose = () => {
    setTitleError('');
    setDeviceLocation('');
    setSelectFromExisting(false);
    setExistingMemories([]);
    setMemorySearch('');
    setMemoryCategoryFilter('All Categories');
    setSelectedMemoryIds([]);
    setShopifyCollections([]);
    wasShopifyCategoryRef.current = false;
    setCarsForPicker([]);
    wasCarsCategoryRef.current = false;
    setCatalogNotice('');
    wasCatalogCategoryRef.current = false;
    setVisibleCampaignsCount(CAMPAIGNS_LOAD_BATCH);
    setMomentOrder([]);
    setExtraCatalog([]);
    setExtraCars([]);
    setExtraCampaigns([]);
    setWidgetAsk(null);
    setDeleteAsk(null);
    setModerationChoice(null);
    onOpenChange(false);
  };

  // Cover photo: uploaded like the Media photos (same endpoint), sent as last_update_img. Replaces an intro video.
  const handleCoverPhotoPicked = async (file: File) => {
    const problem = coverPhotoFileError(file);
    if (problem) { toast.error(problem); return; }
    const seq = nextCoverSeq();
    const controller = new AbortController();
    coverUploadAbortRef.current = () => controller.abort();
    dispatchCover({ type: 'pick', seq, kind: 'photo', file, name: file.name, localUrl: URL.createObjectURL(file) });
    try {
      const fileNameForAPI = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9\-_]/g, '');
      const exif = await exifr.parse(file, ['Orientation']).catch(() => null);
      const response = await dashboardAPI.uploadImageWithMetadata(file, fileNameForAPI || 'cover', exif?.Orientation ?? 1, controller.signal);
      const fileUrl = (response.data?.data || response.data)?.fileUrl;
      if (!response.success || !fileUrl) throw new Error(response.error || 'Upload failed');
      dispatchCover({ type: 'uploaded', seq, url: fileUrl });
    } catch (err) {
      console.error('Cover photo upload failed:', err);
      dispatchCover({ type: 'failed', seq });
      if (seq === coverSeqRef.current) toast.error('The cover photo could not be uploaded. Please try again.');
    }
  };

  // Intro video: uploaded to /memories/upload-video, sent as last_update_img. Replaces a cover photo.
  const handleIntroVideoPicked = async (file: File) => {
    const seq = nextCoverSeq();
    dispatchCover({ type: 'pick', seq, kind: 'video', file, name: file.name, localUrl: URL.createObjectURL(file) });
    // Tick 1% per second up to 90%, wait for server to reach 100%
    let currentProgress = 0;
    const timer = setInterval(() => {
      currentProgress = Math.min(90, currentProgress + 1);
      dispatchCover({ type: 'progress', seq, progress: currentProgress });
    }, 1000);
    try {
      const token = localStorage.getItem('stasht_token');
      const uploadFormData = new FormData();
      uploadFormData.append('video', file);
      const fileUrl = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        coverUploadAbortRef.current = () => xhr.abort();
        xhr.onabort = () => reject(new Error('Upload replaced'));
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data?.fileUrl) resolve(data.fileUrl); else reject(new Error('No fileUrl'));
          } catch { reject(new Error('Invalid response')); }
        };
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.open('POST', `${getApiBaseUrl()}/memories/upload-video`);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(uploadFormData);
      });
      dispatchCover({ type: 'uploaded', seq, url: fileUrl });
    } catch (err) {
      console.error('Intro video upload failed:', err);
      dispatchCover({ type: 'failed', seq });
      if (seq === coverSeqRef.current) toast.error('The intro video could not be uploaded. Please try again.');
    } finally {
      clearInterval(timer);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    console.log(`🔄 FILE INPUT CHANGE:`, {
      totalFilesSelected: files.length,
      fileNames: files.map(f => `${f.name} (${(f.size / 1024).toFixed(2)}KB)`)
    });

    const validFiles = files.filter(file => {
      const fileType = file.type.toLowerCase();
      const isValid = fileType === 'image/jpeg' || fileType === 'image/jpg' || fileType === 'image/png';
      if (!isValid) {
        console.log(`❌ Invalid file type: ${file.name} (${fileType})`);
      }
      return isValid;
    });

    console.log(`✅ VALID FILES:`, {
      validCount: validFiles.length,
      invalidCount: files.length - validFiles.length,
      validFileNames: validFiles.map(f => f.name)
    });

    if (validFiles.length !== files.length) {
      alert('Please select only JPG, JPEG, or PNG files.');
    }

    if (validFiles.length > 0) {
      const dt = new DataTransfer();
      validFiles.forEach(f => dt.items.add(f));
      setMomentFiles(dt.files);
      setIsAddMomentOpen(true);
    }

    // Reset the input to allow selecting the same files again if needed
    event.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => {
      const fileType = file.type.toLowerCase();
      return fileType === 'image/jpeg' || fileType === 'image/jpg' || fileType === 'image/png';
    });

    if (validFiles.length !== files.length) {
      alert('Please select only JPG, JPEG, or PNG files.');
    }

    if (validFiles.length > 0) {
      const dt = new DataTransfer();
      validFiles.forEach(f => dt.items.add(f));
      setMomentFiles(dt.files);
      setIsAddMomentOpen(true);
    }
  };

  // Process files and extract metadata ONE BY ONE
  const processFilesWithMetadata = async (files: File[]) => {
    console.log(`🚀 PROCESSING FILES WITH METADATA:`, {
      incomingFilesCount: files.length,
      currentMediaFilesCount: formData.mediaFiles.length,
      incomingFileNames: files.map(f => f.name)
    });
    setIsExtractingMetadata(true);
    setIsUploading(true);
    setUploadedFilesCount(0);
    const uploadItems = files.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      fileName: file.name,
      fileType: file.type,
      progress: 0,
      status: 'uploading' as const
    }));
    setUploadProgress(uploadItems);

    // DON'T clear arrays if we're adding more photos to existing batch
    // Only clear if this is the first upload in the session
    if (formData.mediaFiles.length === 0) {
      setMainPhotosArray([]);
      setPhotosWithMetadata([]);
      console.log(`🧹 CLEARED ARRAYS - Starting fresh upload session`);
    } else {
      console.log(`➕ ADDING MORE PHOTOS - Current array has ${mainPhotosArray.length} photos`);
    }

    // Initialize extraction results for modal
    const initialResults = files.map(file => ({
      fileName: file.name,
      hasDate: false,
      hasLocation: false,
      isProcessing: false,
      isCompleted: false
    }));
    setExifExtractionResults(initialResults);

    const newPhotosWithMetadata: Array<{
      file: File;
      name: string;
      location?: string;
      capture_date?: string;
      capture_time?: string;
      fileUrl?: string;
      imageName?: string;
      originalSizeMB?: number;
      metadata_extracted: boolean;
    }> = [];

    // Track successfully processed files - ADD ALL FILES IMMEDIATELY
    const successfullyProcessedFiles: File[] = [...files]; // Copy all files immediately
    console.log(`🔒 GUARANTEED FILE LIST: ${successfullyProcessedFiles.length} files locked in`);

    // Small concurrent batches, not all at once — the backend's PHP-FPM pool runs in
    // "ondemand" mode (no pre-warmed workers), so a burst of simultaneous uploads
    // forces several cold worker forks at once; whichever request draws the short
    // straw can exceed the connection timeout and fail with a raw network error
    // before any response comes back. A small batch size keeps bursts short.
    const BATCH_SIZE = 2;

    try {
      // Process files in batches of 2 — each batch uploads in parallel
      for (let batchStart = 0; batchStart < files.length; batchStart += BATCH_SIZE) {
        const batch = files.slice(batchStart, batchStart + BATCH_SIZE);
        console.log(`🚀 Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: files ${batchStart + 1}–${batchStart + batch.length} of ${files.length}`);

        // Mark all files in this batch as processing
        setExifExtractionResults(prev =>
          prev.map((result, index) =>
            index >= batchStart && index < batchStart + batch.length
              ? { ...result, isProcessing: true }
              : result
          )
        );
        setUploadProgress(prev => prev.map((item, index) =>
          index >= batchStart && index < batchStart + batch.length
            ? { ...item, progress: 10, status: 'uploading' }
            : item
        ));

        // Upload all 5 in parallel
        const batchResults = await Promise.all(
          batch.map(async (file, batchIndex) => {
            const globalIndex = batchStart + batchIndex;
            const fileName = file.name;
            let metadataExtracted = false;
            let location = '';
            let capture_date = '';
            let capture_time = '';
            let fileUrl = '';
            let imageName = '';
            let originalSizeMB = 0;

            try {
              const fileNameForAPI = file.name
                .replace(/\.[^/.]+$/, '')   // remove extension
                .replace(/\s+/g, '_')       // spaces → underscores
                .replace(/[^a-zA-Z0-9\-_]/g, ''); // remove all other special chars
              const exif = await exifr.parse(file, ['Orientation']).catch(() => null);
              const orientation = exif?.Orientation ?? 1;
              const response = await dashboardAPI.uploadImageWithMetadata(file, fileNameForAPI, orientation);

              if (response.success && response.data) {
                const apiData = response.data.data || response.data;
                location = apiData.location || '';
                capture_date = apiData.capture_date || '';
                capture_time = apiData.capture_time || '';
                fileUrl = apiData.fileUrl || '';
                imageName = apiData.imageName || '';
                originalSizeMB = apiData.originalSizeMB || 0;
                metadataExtracted = true;
                console.log(`✅ Metadata extracted for file ${globalIndex + 1}: ${file.name}`);
              } else {
                console.log(`⚠️ No metadata for file ${globalIndex + 1}: ${file.name} - continuing anyway`);
              }
              setUploadProgress(prev => prev.map((item, i) =>
                i === globalIndex ? { ...item, progress: 100, status: 'complete' } : item
              ));
              setUploadedFilesCount(prev => prev + 1);
            } catch (metadataError) {
              console.log(`⚠️ Metadata extraction failed for file ${globalIndex + 1}: ${file.name} - file still included`, metadataError);
              setUploadProgress(prev => prev.map((item, i) =>
                i === globalIndex ? { ...item, status: 'error' } : item
              ));
            }

            return { file, fileName, globalIndex, metadataExtracted, location, capture_date, capture_time, fileUrl, imageName, originalSizeMB };
          })
        );

        // Apply results for all files in the batch
        for (const result of batchResults) {
          const { file, fileName, globalIndex, metadataExtracted, location, capture_date, capture_time, fileUrl, imageName, originalSizeMB } = result;
          const hasValidDate = !!(capture_date && capture_date.trim() !== '');
          const hasValidLocation = !!(location && location.trim() !== '');

          const photoData = {
            file,
            name: fileName,
            location,
            capture_date,
            capture_time,
            fileUrl,
            imageName,
            originalSizeMB,
            metadata_extracted: metadataExtracted
          };
          newPhotosWithMetadata.push(photoData);

          setMainPhotosArray(prev => {
            const updated = [...prev, { name: fileName, location, capture_date, capture_time, fileUrl, imageName, originalSizeMB }];
            console.log(`📸 Added photo ${globalIndex + 1}/${files.length}: ${fileName} (metadata: ${metadataExtracted})`);
            return updated;
          });

          setExifExtractionResults(prev =>
            prev.map((r, index) =>
              index === globalIndex ? { ...r, hasDate: hasValidDate, hasLocation: hasValidLocation, isProcessing: false, isCompleted: true } : r
            )
          );
        }

        console.log(`✅ Batch ${Math.floor(batchStart / BATCH_SIZE) + 1} complete`);
      }

      console.log(`🏁 LOOP COMPLETED: Processed ${successfullyProcessedFiles.length} out of ${files.length} files`);
      console.log(`📋 SUCCESS LIST:`, successfullyProcessedFiles.map(f => f.name));

      // Check if all files made it
      if (successfullyProcessedFiles.length !== files.length) {
        const missingFiles = files.filter(f => !successfullyProcessedFiles.includes(f)).map(f => f.name);
        console.error(`❌ MISSING FILES FROM SUCCESS LIST:`, missingFiles);
      }

      // Update all states after processing - USE successfullyProcessedFiles NOT original files
      setPhotosWithMetadata(prev => [...prev, ...newPhotosWithMetadata]);
      setFormData(prev => {
        const updatedFiles = [...prev.mediaFiles, ...successfullyProcessedFiles];
        console.log(`📎 UPDATING MEDIA FILES WITH SUCCESSFULLY PROCESSED FILES:`, {
          previousCount: prev.mediaFiles.length,
          originalFilesCount: files.length,
          successfullyProcessedCount: successfullyProcessedFiles.length,
          totalFiles: updatedFiles.length,
          processedFileNames: successfullyProcessedFiles.map(f => f.name),
          missingFiles: files.filter(f => !successfullyProcessedFiles.includes(f)).map(f => f.name)
        });

        if (successfullyProcessedFiles.length !== files.length) {
          console.warn(`⚠️ WARNING: Only ${successfullyProcessedFiles.length} of ${files.length} files were successfully processed!`);
        }

        return {
          ...prev,
          mediaFiles: updatedFiles
        };
      });

      // Auto-fill form from metadata
      autoFillFromMetadata(newPhotosWithMetadata);

      // Auto-close modal after completion
      setTimeout(() => {
        setShowExifModal(false);
      }, 2000);

      console.log(`🎉 Completed processing all ${files.length} files`);

      // Complete upload with the data we know is current
      const finalFormData = {
        ...formData,
        mediaFiles: [...formData.mediaFiles, ...successfullyProcessedFiles]
      };

      const finalPhotosArray = [...mainPhotosArray, ...newPhotosWithMetadata.map(p => ({
        name: p.name,
        location: p.location || '',
        capture_date: p.capture_date || '',
        capture_time: p.capture_time || '',
        fileUrl: p.fileUrl || '',
        imageName: p.imageName || '',
        originalSizeMB: p.originalSizeMB || 0
      }))];

      const finalPhotosWithMetadata = [...photosWithMetadata, ...newPhotosWithMetadata];

      console.log('🔍 DETAILED DATA CHECK:', {
        originalPhotosWithMetadata: photosWithMetadata,
        newPhotosWithMetadata: newPhotosWithMetadata,
        finalPhotosWithMetadata: finalPhotosWithMetadata,
        originalMainPhotosArray: mainPhotosArray,
        newPhotosForMainArray: newPhotosWithMetadata.map(p => ({
          name: p.name,
          location: p.location || '',
          capture_date: p.capture_date || '',
          capture_time: p.capture_time || '',
          fileUrl: p.fileUrl || '',
          imageName: p.imageName || '',
          originalSizeMB: p.originalSizeMB || 0
        })),
        finalPhotosArray: finalPhotosArray
      });

      console.log('🔄 COMPLETING UPLOAD WITH KNOWN CURRENT DATA');
      console.log('📊 Upload completion data:', {
        finalFormDataFiles: finalFormData.mediaFiles.length,
        finalPhotosArrayLength: finalPhotosArray.length,
        finalPhotosWithMetadataLength: finalPhotosWithMetadata.length,
        actualData: {
          finalFormData,
          finalPhotosArray,
          finalPhotosWithMetadata
        }
      });


      // Final summary of photos array - use current state
      setTimeout(() => {
        setMainPhotosArray(currentArray => {
          console.log(`🏁 FINAL PHOTOS ARRAY SUMMARY:`);
          console.log(`📊 Photos processed in this batch: ${files.length}`);
          console.log(`📸 Total photos in array: ${currentArray.length}`);
          console.log(`🎯 FINAL COMPLETE PHOTOS ARRAY:`, currentArray);
          console.table(currentArray);

          return currentArray; // Don't change the array, just log it
        });
      }, 100);

    } catch (error) {
      console.error('❌ CRITICAL ERROR processing files:', error);

      // FALLBACK: If processing completely fails, still add all files to ensure they're not lost
      console.log(`🔄 FALLBACK: Adding all ${files.length} files without metadata`);

      // Ensure successfullyProcessedFiles has all files
      if (successfullyProcessedFiles.length !== files.length) {
        console.log(`🔧 FIXING successfullyProcessedFiles: had ${successfullyProcessedFiles.length}, adding missing files`);
        successfullyProcessedFiles.length = 0; // Clear it
        successfullyProcessedFiles.push(...files); // Add all files
      }

      const fallbackPhotosWithMetadata = files.map(file => ({
        file,
        name: file.name,
        location: '',
        capture_date: '',
        capture_time: '',
        fileUrl: '',
        imageName: '',
        originalSizeMB: 0,
        metadata_extracted: false
      }));

      setPhotosWithMetadata(prev => [...prev, ...fallbackPhotosWithMetadata]);
      setFormData(prev => {
        const updatedFiles = [...prev.mediaFiles, ...successfullyProcessedFiles];
        console.log(`📎 FALLBACK - UPDATING MEDIA FILES:`, {
          previousCount: prev.mediaFiles.length,
          newFilesCount: successfullyProcessedFiles.length,
          totalFiles: updatedFiles.length,
          allFileNames: successfullyProcessedFiles.map(f => f.name)
        });
        return {
          ...prev,
          mediaFiles: updatedFiles
        };
      });
    } finally {
      setIsExtractingMetadata(false);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress([]);
        // Scroll to title input and focus it
        titleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => titleInputRef.current?.focus(), 300);
      }, 1500);
    }
  };

  // Auto-fill form fields from extracted metadata
  const autoFillFromMetadata = (photos: Array<{
    file: File;
    name: string;
    location?: string;
    capture_date?: string;
    capture_time?: string;
    fileUrl?: string;
    imageName?: string;
    originalSizeMB?: number;
    metadata_extracted: boolean;
  }>) => {
    console.log('🔍 AUTO-FILL METADATA - Processing photos:', photos);

    // Auto-fill location from photos with valid location metadata
    const photosWithLocation = photos.filter(photo =>
      photo.location &&
      photo.location.trim() !== '' &&
      photo.metadata_extracted
    );

    console.log('📍 Photos with location:', photosWithLocation);

    // Set location from first photo that has location metadata
    // This will override device location or any existing location
    if (photosWithLocation.length > 0) {
      const location = photosWithLocation[0].location;
      if (location && location.trim() !== '') {
        setFormData(prev => {
          console.log('🔄 Updating location from image metadata:', {
            oldLocation: prev.location,
            newLocation: location
          });
          return { ...prev, location };
        });
        console.log('✅ Auto-filled location from image metadata:', location);
      }
    } else {
      console.log('ℹ️ No location in uploaded images - keeping existing location');
    }

    // Auto-fill dates from current batch of photos
    const photosWithDates = photos.filter(photo =>
      photo.capture_date &&
      photo.capture_date.trim() !== '' &&
      photo.metadata_extracted
    );

    console.log('📅 Photos with valid dates:', photosWithDates);

    if (photosWithDates.length > 0) {
      // Get all valid dates from photos with metadata
      const validDates = photosWithDates.map(photo => {
        return dayOf(photo.capture_date) || null;
      }).filter(date => date !== null) as string[];

      if (validDates.length > 0) {
        // Remove duplicates and sort
        const uniqueDates = [...new Set(validDates)].sort();
        const minDate = uniqueDates[0];
        const maxDate = uniqueDates[uniqueDates.length - 1];

        console.log('📅 Date analysis from current batch:', {
          photosWithDates: photosWithDates.length,
          validDates: validDates,
          uniqueDates: uniqueDates,
          minDate,
          maxDate,
          differentDates: minDate !== maxDate
        });

        // Update form with dates from photos
        setFormData(prev => ({
          ...prev,
          date: minDate,
          endDate: minDate !== maxDate ? maxDate : ''
        }));

        // Show end date checkbox if we have different dates
        setShowEndDate(minDate !== maxDate);

        console.log('✅ Auto-filled dates from images:', {
          startDate: minDate,
          endDate: minDate !== maxDate ? maxDate : 'Same date - no end date',
          endDateCheckboxVisible: minDate !== maxDate
        });
      }
    }

  };

  const handleAddTag = () => {
    if (currentTag.trim()) {
      const newTags = currentTag
        .split(',')
        .map(t => t.trim())
        .filter(t => t && !formData.tags.includes(t));
      if (newTags.length > 0) {
        setFormData(prev => ({
          ...prev,
          tags: [...prev.tags, ...newTags]
        }));
      }
      setCurrentTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleRemoveMediaFile = (indexToRemove: number) => {
    // Remove from all three arrays to keep them in sync
    setFormData(prev => ({
      ...prev,
      mediaFiles: prev.mediaFiles.filter((_, index) => index !== indexToRemove)
    }));

    setPhotosWithMetadata(prev =>
      prev.filter((_, index) => index !== indexToRemove)
    );

    setMainPhotosArray(prev =>
      prev.filter((_, index) => index !== indexToRemove)
    );
  };

  // Typing handlers for black outline
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, title: e.target.value }));
    setIsTypingTitle(true);
    // Clear error when user starts typing
    if (titleError) {
      setTitleError('');
    }
    // Clear typing state after a brief delay
    setTimeout(() => setIsTypingTitle(false), 500);
  };

  const handleLocationChange = (value: string) => {
    setFormData(prev => ({ ...prev, location: value }));
    setIsTypingLocation(true);
    setTimeout(() => setIsTypingLocation(false), 500);
  };

  const handleTagChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTag(e.target.value);
    setIsTypingTag(true);
    setTimeout(() => setIsTypingTag(false), 500);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, date: e.target.value }));
    setIsTypingDate(true);
    setTimeout(() => setIsTypingDate(false), 500);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, endDate: e.target.value }));
    setIsTypingEndDate(true);
    setTimeout(() => setIsTypingEndDate(false), 500);
  };


  // ── The live preview's moments (Storeel flow v2): what "Save as Draft" will make, in the order the API makes them
  // (lib/previewMoments.ts) — the picked items the form sends (selectedMemoryIds), then the uploaded photos it sends
  // (mainPhotosArray). Once saved — Edit, or just created — the campaign's own moments (PUT can't add any, and a later
  // category change in step 1 must not take the made moments off the preview).
  const todayDate = localDateISO();
  const previewPick: PickKind = isCatalogCategory ? 'catalog' : isShopifyCategory ? 'shopify' : isCarsCategory ? 'cars' : selectedMemoryIds.length ? 'campaigns' : null;
  const previewPicked: PickerItem[] = previewPick === 'catalog' ? catalogForPicker
    : previewPick === 'shopify' ? shopifyCollections
    : previewPick === 'cars' ? carsForPicker
    : previewPick === 'campaigns' ? [...existingMemories, ...carsForPicker.map((c: any) => ({ ...c, kind: 'cars' as const })), ...shopifyCollections.map((c: any) => ({ ...c, kind: 'shopify' as const }))]
    : [];
  // With the products / vehicles added in Add a Moment (Chris, 7 Nov 2026), in the order the API makes them on its own.
  const extraCatalogShown = previewPick === 'catalog' ? [] : extraCatalog;
  const extraCarsShown = previewPick === 'cars' ? [] : extraCars.filter((c) => !selectedMemoryIds.includes(String(c.id)));
  const extraCampaignsShown = extraCampaigns.filter((c) => !(previewPick === 'campaigns' && selectedMemoryIds.includes(c.id)));
  const createMoments = apiDefaultOrder([
    ...createPreviewMoments({
      pick: previewPick, picked: previewPicked, selectedIds: selectedMemoryIds, photos: mainPhotosArray, location: formData.location, today: todayDate,
    }),
    ...pickedPreviewMoments('catalog', extraCatalogShown, formData.location, todayDate),
    ...pickedPreviewMoments('cars', extraCarsShown, formData.location, todayDate),
    ...campaignPreviewMoments(extraCampaignsShown),
  ]);
  const savedMomentsList = flowEditing || flowCampaign;
  // What the Moments card and the phone show, in order: before the campaign exists, the order given with the preview's
  // "+" / Move (momentOrder); once saved, the campaign's own. Vehicles / Shopify collections always last.
  const previewMoments = savedMomentsList ? orderMoments(flowCampaign?.previewMoments ?? [], []) : orderMoments(createMoments, momentOrder);
  const shownPlacedKeys = previewMoments.filter(isOrderable).map((m) => m.key);

  /** The Moderation switch's value: the person's choice, else the campaign's, else the account's (on by default). */
  const moderationOn = shownModeration({ choice: moderationChoice, campaign: flowCampaign?.moderation ?? null, account: accountModeration });

  /** Just created: give its moments the shown order (GET it, match its moments to the form's, PUT the order). */
  const orderNewCampaign = async (id: number, shown: PreviewMoment[]) => {
    const failed = () => toast.error("Campaign saved. The moments' order couldn't be saved — reorder them on the campaign page.");
    try {
      clearApiCache();
      const res = await dashboardAPI.getMemoryDetails(String(id));
      const fresh = res?.success ? (seedFromMemory(res.data)?.previewMoments ?? []) : [];
      const order = serverOrderAfterCreate(shown, sentPostKeys(createMoments), fresh);
      if (!order) { failed(); return; }
      const put = await campaignMomentsAPI.setOrder(id, order);
      if (!put.ok) failed();
    } catch {
      failed();
    }
  };

  /**
   * A widget picked before its editor could open (Chris, 8 Nov 2026, point 1): remember it for the campaign page, after
   * the moment its "+" followed — just created: the new moments' ids matched to the form's (products then photos, as
   * sent); already saved: the moments' own ids. The page then opens Edit Storeel with that editor.
   */
  const handOffWidget = async (id: number, w: { kind: AddWidgetKind; anchor: string | null | undefined }, justCreated: boolean) => {
    let after: number | null = null;
    if (justCreated) {
      if (w.anchor !== null) {
        try {
          clearApiCache();
          const res = await dashboardAPI.getMemoryDetails(String(id));
          const fresh = res?.success ? (seedFromMemory(res.data)?.previewMoments ?? []) : [];
          const ids = postIdsAfterCreate(sentPostKeys(createMoments), fresh);
          after = widgetAnchorPostId(previewMoments, w.anchor, (m) => ids.get(m.key));
          // Not matched (the API skipped a product): after the campaign's last moment.
          if (after === null && ids.size === 0) after = widgetAnchorPostId(fresh, undefined, (m) => (m.kind === 'photo' ? m.postId : undefined));
        } catch { /* top */ }
      }
    } else {
      after = widgetAnchorPostId(previewMoments, w.anchor, (m) => (m.kind === 'photo' ? m.postId : undefined));
    }
    saveWidgetIntent({ memoryId: id, kind: w.kind, afterPostId: after });
  };

  /**
   * Save as Draft (andSend false) or Save & Send: POST /memories with every moment of step 2 — its photos and
   * videos in order with their titles and captions, and the picked items — in one request, as Save as Draft always
   * sent them (so a moment can't half-fail). Save as Draft then closes on the Campaigns list; Save & Send asks the
   * Send card to confirm. A failed create sends nothing.
   */
  const handleSubmit = async (andSend = false, publish = false, publishType: 1 | 2 | 3 = 1) => {
    setActionError(null);
    // Validate required fields
    if (!formData.title.trim()) {
      setTitleError('Title is required');
      showActionError('Add a campaign title.', 'title');
      return;
    }

    // A Website Catalogue campaign is built from the picked items, so it needs at least one.
    if (isCatalogCategory && selectedMemoryIds.length === 0) {
      setSelectFromExisting(true);
      setCatalogNotice('Pick at least one item from your Website Catalogue.');
      showActionError('Pick at least one item from your Website Catalogue.', 'st-pick-items');
      return;
    }

    // Log current state before submission
    console.log(`🚀 SUBMIT BUTTON CLICKED - Current state:`, {
      mediaFilesCount: formData.mediaFiles.length,
      mainPhotosArrayCount: mainPhotosArray.length,
      photosWithMetadataCount: photosWithMetadata.length,
      isExtractingMetadata: isExtractingMetadata
    });

    // Wait if metadata extraction is still in progress
    if (isExtractingMetadata) {
      console.warn('⏳ Metadata extraction still in progress, waiting...');
      alert('Please wait for file processing to complete before submitting.');
      return;
    }

    // Check latest memory limit before creating. checkLimit returns the fresh status; the hook's
    // isLimitExceeded in this closure is from the last render, so it is only the fallback.
    const latestLimit = await checkLimit();
    const limitReached = latestLimit ? latestLimit.status === 'limit_exceeded' : isLimitExceeded;

    if (limitReached) {
      // Shown inline at the top of the Storeel form (the dialog would be hidden under this modal).
      showStoreelLimit();
      return;
    }

    setIsSubmitting(true);
    setSavingAction(andSend ? 'send' : 'save');
    
    try {
      // Find the selected category data
      const selectedCategoryData = categoriesForDropdown.find((cat: any) => cat.name === formData.category);
      
      if (!selectedCategoryData) {
        console.error('Selected category not found in API categories');
        showActionError('Pick a category again, then try again.', CAMPAIGN_STEP_ID);
        return;
      }
      
      // Helper function to format date to "MMM dd, yyyy" format
      // "Nov 04, 2026" from the picked day's own parts: new Date('2026-11-04') is UTC midnight, which became Nov 3 in
      // Toronto (review, 5 Nov — it hid the UTC "today" bug: tomorrow's date, sent as one day earlier).
      const formatDateForAPI = (dateString: string) => isoToApiDay(dateString);

      // Prepare photos array with proper date handling
      // Only uploaded photos are sent (one with no link would be a moment with no picture).
      const photosArray = mainPhotosArray.filter((photo) => Boolean(photo.fileUrl && String(photo.fileUrl).trim())).map((photo) => {
        const todayDate = localDateISO();

        // Use capture_date if available, otherwise use today's date
        const photoDate = dayOf(photo.capture_date) || todayDate;

        return {
          name: photo.name,
          title: photo.title || '',
          description: photo.description || '',
          location: photo.location || '',
          capture_date: photoDate,
          capture_time: photo.capture_time || '',
          fileUrl: photo.fileUrl || '',
          imageName: photo.imageName || '',
          originalSizeMB: photo.originalSizeMB || 0,
          tags: photo.tags || []
        };
      });

      // Prepare the memory data for API
      const memoryData: any = {
        title: formData.title.trim(),
        category_id: selectedCategoryData.id,
        min_uploaded_img_date: formatDateForAPI(formData.date),
        max_uploaded_img_date: formatDateForAPI(formData.endDate || formData.date),
        location: formData.location || '',
        tags: formData.tags,
        photos_count: photosArray.length,
        photos: photosArray,
        ...coverChoicePayload(coverChoice),
        // Moderation per campaign (Chris, 7 Nov 2026): only when the switch was touched (review I1); untouched, the
        // campaign follows the account's setting (NULL).
        ...moderationPayload(moderationChoice),
      };

      // Publish immediately if requested
      if (publish) {
        memoryData.published = publishType;
      }

      // Selected items: Website Catalogue item ids / Shopify collection ids / Cars listing ids go
      // to their own field (they are not real memory rows); normal campaigns stay on linked_memory_ids. The products /
      // vehicles added with Add a Moment go beside them (Chris, 7 Nov 2026; lib/momentPicks pickPayload).
      Object.assign(memoryData, pickPayload({
        pick: isCatalogCategory ? 'catalog' : isShopifyCategory ? 'shopify' : isCarsCategory ? 'cars' : selectedMemoryIds.length ? 'campaigns' : null,
        selectedIds: selectedMemoryIds,
        extraCatalog: extraCatalog.map((p) => String(p.id)),
        extraCars: extraCars.map((c) => String(c.id)),
        extraCampaigns: extraCampaigns.map((c) => c.id),
      }));

      // Add sub_category as array of label names
      if (formData.label) {
        memoryData.sub_category = [formData.label];
      }

      // Add property_id when in property account view, or when user selected a property on personal account
      if (viewType === 'property' && currentProperty) {
        memoryData.property_id = currentProperty.id;
        console.log(`🏠 Creating memory for property: ${currentProperty.name} (ID: ${currentProperty.id})`);
      } else if (viewType !== 'property' && formData.property.length > 0) {
        memoryData.property_id = formData.property.map(id => parseInt(id, 10));
        console.log(`🏠 Creating memory for selected property IDs: ${formData.property.join(', ')}`);
      }

      console.log('Creating memory with data:', memoryData);
      console.log('Photos array:', photosArray);

      let response;

      console.log('Creating memory with JSON data (no media files):', memoryData);
      console.log('Photos array with metadata:', photosArray);

      // Call the regular API to create the memory with just the JSON data (no files)
      response = await dashboardAPI.createMemory(memoryData);
      
      if (response.success) {
        const created = seedFromMemory(response.data);
        // The order given with the preview's "+" / Move (Chris, 7 Nov 2026): the API made the moments in its own
        // order, so put them in the shown one. The campaign is made either way.
        if (created && needsServerOrder(previewMoments, createMoments)) await orderNewCampaign(created.id, previewMoments);
        await recheckMemoryLimit();
        void triggerMemoryCountsRefresh();
        if (created) {
          const cover = coverChoice.kind && coverChoice.url ? { kind: coverChoice.kind, url: coverChoice.url } : null;
          initialCoverUrlRef.current = cover?.url ?? null;
          setFlowCampaign({
            ...created,
            title: memoryData.title, category: formData.category, categoryId: selectedCategoryData.id ?? null,
            categoryKind: isShopifyCategory ? 'shopify' : isCarsCategory ? 'car' : 'regular', label: formData.label,
            date: formData.date, endDate: showEndDate ? formData.endDate : '', location: formData.location || '', tags: [...formData.tags], cover,
            published: Number(memoryData.published) || 0, isCar: isCarsCategory,
            // The moments the preview showed are the ones just made (the API answers only the campaign's id).
            moments: previewMoments.length, previewMoments,
          });
          // Saving again (after Save & Send's confirm was left) is a PUT, which keeps this category.
          setSeededCategory(formData.category);
        }
        // The Campaigns page shows Storeels with the new campaign (the Sidebar's Create goes there too).
        writeCampaignsView('storeels');
        if (onMemoryCreated) await onMemoryCreated();
        const widgetNext = widgetAfterSaveRef.current;
        widgetAfterSaveRef.current = null;
        if (created && widgetNext && !andSend) {
          // A widget was picked before the Storeel existed (Chris, 8 Nov 2026): open the campaign page's Edit Storeel
          // with that widget's editor, after the moment its "+" followed (the new moments' ids, matched to the form's).
          await handOffWidget(created.id, widgetNext, true);
          toast.success(createdToast(sendFilled));
          handleModalClose();
          requestOpenCampaign(created.id);
        } else if (!andSend || !created) {
          // Save as Draft: done — the Campaigns list shows it (a filled-in Send card was not sent).
          toast.success(createdToast(sendFilled));
          handleModalClose();
        } else {
          // Save & Send: the campaign is made; step 2 now shows its real moments (ids, for their captions), and the
          // Send card asks to confirm.
          setFlowCreated(true);
          setSendRequest((n) => n + 1);
          // The moments' controls wait for the campaign's real moments (ids): a Move before them would leave some out.
          setMomentBusy(true);
          void refreshSavedMoments(created.id).finally(() => setMomentBusy(false));
        }
      } else {
        widgetAfterSaveRef.current = null;
        console.error('Failed to create memory:', response);

        if ((response as { code?: string }).code === 'memory_limit_reached') {
          // The plan's campaign limit, checked again by the API: the inline notice, not an alert.
          setServerLimitMessage(response.message || response.error || "You've reached your plan's campaign limit.");
          setServerLimitTick((t) => t + 1);
          setActionError("You've reached your plan's campaign limit. See the note at the top.");
          void checkLimit();
        } else if (response.errors && response.errors.title) {
          // Check if the error is about title validation
          // Display title-specific error
          setTitleError(response.errors.title[0] || 'This title is already taken.');
          showActionError(response.errors.title[0] || 'This title is already taken.', 'title');
        } else if (response.message && response.message.toLowerCase().includes('title')) {
          // Fallback for different error response format
          setTitleError(response.message);
          showActionError(response.message, 'title');
        } else {
          // Generic error - use alert for non-title errors
          setActionError(`The campaign couldn't be created: ${response.error || response.message || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error creating memory:', error);
      setActionError("The campaign couldn't be created. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
      setSavingAction(null);
    }
  };


  const storeelSubmitDisabled = !formData.title.trim() || !formData.category || isSubmitting || isUploadingCover;

  /**
   * Save Changes (andSend false) or Save & Send on a saved campaign: PUT /memories/{id} (its fields; the cover only
   * when it changed). Save Changes then closes (the campaign page refreshes); Save & Send asks the Send card to confirm.
   */
  const saveSetup = async (andSend = false) => {
    const c = flowCampaignRef.current;
    if (!c) return;
    setActionError(null);
    if (!formData.title.trim()) { setTitleError('Title is required'); showActionError('Add a campaign title.', 'title'); return; }
    setIsSubmitting(true);
    setSavingAction(andSend ? 'send' : 'save');
    setSetupError(null);
    const coverUrl = coverChoice.kind && coverChoice.url ? coverChoice.url : null;
    const form = { ...formData, endDate: showEndDate ? formData.endDate : '' };
    // Moderation: only when the switch was touched (review I1); untouched, the campaign's value is left alone.
    const body: Record<string, unknown> = { ...updatePayload(form, categoriesForDropdown, { changed: coverUrl !== initialCoverUrlRef.current, url: coverUrl }, seededCategory ?? formData.category), ...moderationPayload(moderationChoice) };
    try {
      const res = await dashboardAPI.updateMemory(String(c.id), body);
      if (res.success) {
        initialCoverUrlRef.current = coverUrl;
        setFlowCampaign({
          ...c, title: String(body.title), category: formData.category, label: formData.label.trim(), date: form.date, endDate: form.endDate,
          location: formData.location, tags: [...formData.tags], cover: coverChoice.kind && coverUrl ? { kind: coverChoice.kind, url: coverUrl } : null,
          moderation: moderationChoice ?? c.moderation,
        });
        setSeededCategory(formData.category);
        onCampaignSaved?.(c.id);
        void triggerMemoryCountsRefresh();
        if (andSend) { setSendRequest((n) => n + 1); if (flowEditing) setChangesSaved(true); }
        else {
          const widgetNext = widgetAfterSaveRef.current;
          widgetAfterSaveRef.current = null;
          if (widgetNext) await handOffWidget(c.id, widgetNext, false);
          toast.success(view.savedToast);
          handleModalClose();
          if (widgetNext) requestOpenCampaign(c.id);
        }
        return;
      }
      const errors = (res as { errors?: Record<string, string[] | string> }).errors;
      const titleProblem = errors?.title;
      if (titleProblem) {
        const text = Array.isArray(titleProblem) ? titleProblem[0] : String(titleProblem);
        setTitleError(text);
        showActionError(text, 'title');
      } else {
        const text = res.message || res.error || "Your changes couldn't be saved. Try again.";
        setSetupError(text);
        showActionError(text, CAMPAIGN_STEP_ID);
      }
    } catch {
      setSetupError("Your changes couldn't be saved. Check your connection and try again.");
      showActionError("Your changes couldn't be saved. Check your connection and try again.", CAMPAIGN_STEP_ID);
    } finally {
      setIsSubmitting(false);
      setSavingAction(null);
    }
  };

  /** The bottom actions: Save as Draft / Save Changes (save only), Save & Send (save, then confirm). */
  const saveFlow = (andSend: boolean) => {
    if ((andSend ? view.saveAndSend : view.save).action === 'create') void handleSubmit(andSend);
    else void saveSetup(andSend);
  };
  /** Back / Cancel: closes; a campaign Save & Send already made is kept (and the toast says so). */
  const closeFlow = () => {
    if (view.closeToast) toast.success(view.closeToast);
    handleModalClose();
  };
  const saveDisabled = storeelSubmitDisabled || flowLoading || Boolean(flowLoadError);
  // Why the save button is off, said above the actions (not while it is just busy).
  const saveReason = isSubmitting || flowLoading || flowLoadError ? null
    : saveBlockedReason({ title: formData.title, category: formData.category, coverUploading: isUploadingCover });
  const sendDisabledReason = !canSend || sendForbidden ? "Only the campaign's owner or its business's admins can send it." : sendBlocker;
  // What is said above the actions (Chris, 6 Nov 2026: each as "*Reason", red, left): a refused save, then why a button is off.
  const actionMessages = actionLines({ actionError, saveReason, sendReason: sendDisabledReason });

  /** A saved campaign's real moments (GET /memories/{id}): step 2 and the preview show them, with their ids. */
  const refreshSavedMoments = async (id: number): Promise<PreviewMoment[] | null> => {
    try {
      // Add a Moment uploads with its own fetch (not apiRequest), which doesn't clear apiRequest's 15 s GET cache:
      // without this the campaign would come back as it was before the moment was added.
      clearApiCache();
      const res = await dashboardAPI.getMemoryDetails(String(id));
      const fresh = res?.success ? seedFromMemory(res.data, categoriesProp?.length ? categoriesProp : apiCategories) : null;
      const c = flowCampaignRef.current;
      if (fresh && c && c.id === id) setFlowCampaign({ ...c, previewMoments: fresh.previewMoments, moments: fresh.moments, slug: fresh.slug ?? c.slug });
      return fresh ? fresh.previewMoments : null;
    } catch {
      // Keep the moments shown so far.
      return null;
    }
  };

  // ── The preview's controls and Add a Moment's products / vehicles (Chris, 7 Nov 2026, points 6, 7) ──────────────
  // Before the campaign exists, everything stays here until Save as Draft. On a saved campaign (Edit, or after Save &
  // Send made it) moments save straight to it, as step 2 Moments already does there.

  /** Open the original Add a Moment: from a preview "+" (`anchor`: the moment it follows, null = first), or the card. */
  const openAddMoment = (anchor: string | null | undefined) => {
    addAnchorRef.current = anchor;
    setEditingPhotoIndex(null);
    setMomentFiles(null);
    setIsAddMomentOpen(true);
  };

  /** Before the campaign exists: put just-added moments where the "+" was (the card's Add a Moment: at the end). */
  const placeAdded = (keys: string[]) => {
    const anchor = addAnchorRef.current;
    if (anchor === undefined || !keys.length) return;
    setMomentOrder(insertKeysAfter(shownPlacedKeys, anchor, keys));
  };

  /** Where a "+" on a saved campaign adds: after a moment / linked campaign, first, or (the card, a vehicle's +) last. */
  const savedPlace = (anchor: string | null | undefined): MomentPlace => {
    if (anchor === undefined) return null;
    if (anchor === null) return { start: true };
    const m = previewMoments.find((x) => x.key === anchor);
    const ref = m ? savedRef(m) : null;
    return ref && ref.type !== 'car' ? { after: ref } : null;
  };

  /** A saved campaign: after an upload from a "+", move its new moments to that place (PUT moment-order). */
  const placeSavedUploads = async (id: number, before: string[], anchor: string | null | undefined) => {
    // Busy until placed (review I3): no Move / Delete in between.
    setMomentBusy(true);
    try {
      await placeSavedUploadsNow(id, before, anchor);
    } finally {
      setMomentBusy(false);
    }
  };
  const placeSavedUploadsNow = async (id: number, before: string[], anchor: string | null | undefined) => {
    const fresh = await refreshSavedMoments(id);
    if (!fresh || anchor === undefined) return;
    const shown = orderMoments(fresh, []);
    const added = shown.filter((m) => isOrderable(m) && !before.includes(m.key)).map((m) => m.key);
    if (!added.length) return;
    const keys = insertKeysAfter(shown.filter((m) => isOrderable(m) && !added.includes(m.key)).map((m) => m.key), anchor, added);
    const byKey = new Map(shown.map((m) => [m.key, m]));
    const res = await campaignMomentsAPI.setOrder(id, savedOrderPayload(keys.map((k) => byKey.get(k)!).filter(Boolean)));
    if (!res.ok) toast.error(res.error || "The moment was added, but not at that place. Move it with its ⋮ menu.");
    await refreshSavedMoments(id);
  };

  /** Add a Moment's products / vehicles. */
  const momentInventory: MomentInventory = {
    alreadyAdded: {
      products: previewMoments.filter((m) => m.kind === 'product').map((m) => (m as { sourceId: string }).sourceId),
      vehicles: previewMoments.filter((m) => m.kind === 'vehicle').map((m) => (m as { sourceId: string }).sourceId),
      campaigns: previewMoments.filter((m) => m.kind === 'campaign' && !m.key.startsWith('shopify-')).map((m) => (m as { sourceId: string }).sourceId),
    },
    // Media's "Campaigns (optional)" (Chris, 8 Nov 2026, point 2): never the campaign itself.
    campaigns: { exclude: flowCampaign?.id ?? campaignId ?? null },
    // The plans open under this page: ask before leaving it (review I2).
    onSeePlans: () => setPlansAsk('Adding Website Catalogue products is available on the Business plan.'),
    onAdd: async ({ products, vehicles, campaigns = [] }) => {
      const anchor = addAnchorRef.current;
      const c = flowCampaignRef.current;
      if (c) {
        setMomentBusy(true);
        let added = { products: 0, vehicles: 0, already: 0 };
        try {
          // Campaigns: linked at the "+" (as Create links them), straight away like the other moments here.
          if (campaigns.length) {
            const res = await campaignMomentsAPI.addLinkedCampaigns(c.id, campaigns.map((x) => x.id), savedPlace(anchor));
            if (!res.ok) { toast.error(res.error || "The campaigns couldn't be linked. Try again."); return false; }
            toast.success(linkedCampaignsMessage(res.data?.linked ?? campaigns.length, res.data?.already_linked_ids?.length ?? 0));
            if (!products.length && !vehicles.length) {
              setSavedNow(true);
              onCampaignSaved?.(c.id);
              await refreshSavedMoments(c.id);
              return true;
            }
          }
          if (products.length) {
            const res = await campaignMomentsAPI.addProducts(c.id, products.map((p) => p.id), savedPlace(anchor));
            if (!res.ok) { toast.error(res.error || "The products couldn't be added. Try again."); return false; }
            added = { ...added, products: res.data?.moments ?? 0, already: res.data?.already_added_item_ids?.length ?? 0 };
          }
          if (vehicles.length) {
            const res = await campaignMomentsAPI.addVehicles(c.id, vehicles.map((v) => v.id));
            if (!res.ok) {
              // The products went in: show them; a retry skips them (the API answers "already in it") and adds the vehicles.
              toast.error(res.error || "The vehicles couldn't be added. Try again.");
              if (added.products) await refreshSavedMoments(c.id);
              return false;
            }
            added = { ...added, vehicles: res.data?.linked ?? vehicles.length, already: added.already + Math.max(0, vehicles.length - (res.data?.linked ?? vehicles.length)) };
          }
          setSavedNow(true);
          onCampaignSaved?.(c.id);
          toast.success(addedMessage(added));
          await refreshSavedMoments(c.id);
          return true;
        } finally {
          setMomentBusy(false);
        }
      }
      // Before the campaign exists: with step 1's picks when the category is the same kind, else beside them.
      const keys: string[] = [];
      if (products.length) {
        const ids = products.map((p) => String(p.id));
        if (isCatalogCategory) {
          setSelectedMemoryIds((prev) => {
            const next = [...prev, ...ids.filter((id) => !prev.includes(id))];
            if (next.length > CATALOG_MAX_ITEMS) toast.error(`${catalogCapMessage} The first ${CATALOG_MAX_ITEMS} are kept.`);
            return next.slice(0, CATALOG_MAX_ITEMS);
          });
        } else {
          setExtraCatalog((prev) => [...prev, ...products.filter((p) => !prev.some((x) => String(x.id) === String(p.id)))]);
        }
        keys.push(...ids.map((id) => `catalog-${id}`));
      }
      if (vehicles.length) {
        if (isCarsCategory) {
          setSelectedMemoryIds((prev) => [...prev, ...vehicles.map((v) => String(v.id)).filter((id) => !prev.includes(id))]);
        } else {
          setExtraCars((prev) => [...prev, ...vehicles.filter((v) => !prev.some((x) => String(x.id) === String(v.id)) && !selectedMemoryIds.includes(String(v.id)))]);
        }
      }
      if (campaigns.length) {
        setExtraCampaigns((prev) => [...prev, ...campaigns.filter((x) => !prev.some((p) => p.id === x.id))]);
        keys.push(...campaigns.map((x) => `campaign-${x.id}`));
      }
      placeAdded(keys);
      return true;
    },
  };

  /** Move a moment up / down: here before the campaign exists, on the campaign once saved. */
  const moveMoment = async (key: string, direction: 'up' | 'down') => {
    const keys = moveKey(shownPlacedKeys, key, direction);
    const c = flowCampaignRef.current;
    if (!c) { setMomentOrder(keys); return; }
    const byKey = new Map(previewMoments.map((m) => [m.key, m]));
    const reordered = [...keys.map((k) => byKey.get(k)!).filter(Boolean), ...previewMoments.filter((m) => !isOrderable(m))];
    const before = c.previewMoments;
    setFlowCampaign({ ...c, previewMoments: reordered });
    setMomentBusy(true);
    const res = await campaignMomentsAPI.setOrder(c.id, savedOrderPayload(reordered));
    setMomentBusy(false);
    if (!res.ok) {
      toast.error(res.error || "The new order couldn't be saved. Try again.");
      const now = flowCampaignRef.current;
      if (now && now.id === c.id) setFlowCampaign({ ...now, previewMoments: before });
      return;
    }
    setSavedNow(true);
    onCampaignSaved?.(c.id);
    // Edit saves moments at once, the title / cover with Save Changes: say so (review minor 6).
    // One toast for a burst of moves (re-review nit): the same id updates it instead of stacking.
    toast.success('Order saved.', { id: 'storeel-order-saved' });
  };

  /** After a moment is taken off: focus the next moment's ⋮ (else the one before, else the "+" under the cover). */
  const focusAfter = (removedKey: string) => {
    const target = focusAfterRemove(previewMoments.map((x) => x.key), removedKey);
    window.setTimeout(() => {
      const root = document.querySelector('[data-testid="storeel-preview-moments"]');
      const menu = target ? root?.querySelector<HTMLElement>(`li[data-moment-key="${CSS.escape(target)}"] [data-testid="storeel-preview-moment-menu"]`) : null;
      (menu ?? document.querySelector<HTMLElement>('[data-testid="storeel-preview-add"]'))?.focus();
    }, 350);
  };

  /** Take a moment off: before the campaign exists, out of the form (a step 1 pick is unticked); saved: asks first. */
  const removeMoment = (m: PreviewMoment) => {
    if (flowCampaignRef.current) { setDeleteAsk(m); return; }
    focusAfter(m.key);
    if (m.kind === 'photo' && m.index !== undefined) { handleRemoveMediaFile(m.index); return; }
    if (m.kind === 'product' && extraCatalog.some((p) => String(p.id) === m.sourceId) && !isCatalogCategory) {
      setExtraCatalog((prev) => prev.filter((p) => String(p.id) !== m.sourceId));
      return;
    }
    if (m.kind === 'vehicle' && extraCars.some((v) => String(v.id) === m.sourceId) && !selectedMemoryIds.includes(m.sourceId)) {
      setExtraCars((prev) => prev.filter((v) => String(v.id) !== m.sourceId));
      return;
    }
    if (m.kind === 'campaign' && extraCampaigns.some((x) => x.id === m.sourceId)) {
      setExtraCampaigns((prev) => prev.filter((x) => x.id !== m.sourceId));
      if (!selectedMemoryIds.includes(m.sourceId)) return;
    }
    if (m.kind !== 'photo') toggleSelectedId(m.sourceId);
  };

  /** Saved: delete the asked-about moment from the campaign (as the campaign page does), then show it as it is now. */
  const confirmDelete = async () => {
    const m = deleteAsk;
    const c = flowCampaignRef.current;
    if (!m || !c) return;
    const ref = savedRef(m);
    setMomentBusy(true);
    try {
      const res = !ref ? { ok: false } as { ok: boolean; error?: string }
        : ref.type === 'post' ? await dashboardAPI.deletePost(String(ref.id)).then((r) => ({ ok: Boolean(r?.success), error: r?.message || r?.error }))
        : ref.type === 'linked_memory' ? await dashboardAPI.removeLinkedMemory(String(c.id), String(ref.id)).then((r) => ({ ok: Boolean(r?.success), error: r?.message || r?.error }))
        : await campaignMomentsAPI.removeVehicle(c.id, ref.id);
      if (!res.ok) { toast.error(res.error || "The moment couldn't be deleted. Try again."); return; }
      setDeleteAsk(null);
      setSavedNow(true);
      onCampaignSaved?.(c.id);
      void triggerMemoryCountsRefresh();
      toast.success('Moment deleted.');
      focusAfter(m.key);
      await refreshSavedMoments(c.id);
    } finally {
      setMomentBusy(false);
    }
  };

  /** Edit Moment: a photo's original editor before the campaign exists; once saved, its caption in step 2. */
  const editMoment = (m: PreviewMoment) => {
    if (m.kind !== 'photo') return;
    if (!flowCampaignRef.current && m.index !== undefined) { addAnchorRef.current = undefined; setEditingPhotoIndex(m.index); setIsAddMomentOpen(true); return; }
    setCaptionRequest((prev) => ({ key: m.key, n: (prev?.n ?? 0) + 1 }));
  };

  // ── The Add Widget chooser (Chris, 8 Nov 2026, point 1): every "+" and the Moments card's Add a Moment ──────────
  // Create (no campaign page): DocuSign when connected (review I3), through the same save-first path. Edit still loading
  // or not loaded: the editors need the campaign, so only Moment can be picked (review M6).
  const editNotReady = flowEditing && (flowLoading || Boolean(flowLoadError) || !flowCampaign);
  const chooserOptions = (widgetOptions ?? addWidgetOptions({ docuSign: docuSignOn, shopifyProduct: true })).map((o) => (
    editNotReady && o.kind !== 'moment' ? { ...o, disabled: true, disabledReason: flowLoadError ? 'Reload the Storeel to add this' : 'Available once the Storeel has loaded' } : o
  ));
  /** An option picked at a place (`anchor` as for Add a Moment). Moment: Add a Moment. The rest: their own editors. */
  const pickWidget = (kind: AddWidgetKind, anchor: string | null | undefined) => {
    if (kind === 'moment') { openAddMoment(anchor); return; }
    if (flowCampaignRef.current && onAddWidget) {
      // On the campaign page (Edit): its own editor, saved there at once, after the moment the "+" followed.
      const after = widgetAnchorPostId(previewMoments, anchor, (m) => (m.kind === 'photo' ? m.postId : undefined));
      onAddWidget(kind, after === null ? null : String(after));
      return;
    }
    // Before the campaign exists (or after Save & Send, away from the campaign page): its editor needs the saved
    // campaign and lives on its page, so save first — asked, never silently.
    setWidgetAsk({ kind, label: chooserOptions.find((o) => o.kind === kind)?.label ?? 'This widget', anchor });
  };
  const confirmWidgetAsk = async () => {
    const ask = widgetAsk;
    if (!ask) return;
    setWidgetAsk(null);
    widgetAfterSaveRef.current = { kind: ask.kind, anchor: ask.anchor };
    try {
      if (view.save.action === 'create') await handleSubmit(false);
      else await saveSetup(false);
    } finally {
      // A refused save (a missing title…) leaves the page as it was; the next Save as Draft is an ordinary one.
      widgetAfterSaveRef.current = null;
    }
  };

  refreshSavedRef.current = (id: number) => { void refreshSavedMoments(id); };

  const previewControls: PreviewControls = {
    onAddAfter: (key) => openAddMoment(key),
    widgetOptions: chooserOptions,
    onAddWidget: (kind, key) => pickWidget(kind, key),
    menuFor: (key, index) => {
      const m = previewMoments[index];
      if (!m || m.key !== key) return null;
      const can = momentMenu(previewMoments, index, { saved: Boolean(flowCampaign) });
      const label = m.title || (m.kind === 'photo' ? (m.caption.split('\n')[0] || (m.video ? 'Video' : 'Photo')) : 'Moment');
      return {
        label,
        edit: can.edit ? () => editMoment(m) : undefined,
        up: can.up ? () => { void moveMoment(key, 'up'); } : undefined,
        down: can.down ? () => { void moveMoment(key, 'down'); } : undefined,
        remove: can.remove ? () => removeMoment(m) : undefined,
      };
    },
    cover: {
      onPhoto: () => coverPhotoInputRef.current?.click(),
      onVideo: () => {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
        if (isMobile) setIsVideoRecorderOpen(true); else introVideoInputRef.current?.click();
      },
      onRemove: coverChoice.kind ? clearCover : undefined,
    },
    onEditTitle: () => {
      titleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => titleInputRef.current?.focus(), 300);
    },
    busy: momentBusy || isSubmitting,
  };

  /** Step 2's rows: what can be done to each moment here (see StoreelMomentsCard). */
  const savedMoments = Boolean(flowCampaign);
  const momentRows: MomentRow[] = previewMoments.map((m): MomentRow => {
    if (m.kind === 'photo') {
      if (!savedMoments && m.index !== undefined) {
        const index = m.index;
        return {
          moment: m,
          // Before the campaign exists: the caption is kept here and sent with the photo.
          onSaveCaption: (caption) => { setMainPhotosArray((prev) => prev.map((p, i) => (i === index ? { ...p, description: caption } : p))); return true; },
          onEdit: () => { setEditingPhotoIndex(index); setIsAddMomentOpen(true); },
          onRemove: () => handleRemoveMediaFile(index),
        };
      }
      const postId = m.postId;
      return {
        moment: m,
        // A saved moment: the caption is saved on the campaign, as the campaign page does (PUT /memory-images/{id}).
        onSaveCaption: postId ? async (caption) => {
          const res = await dashboardAPI.updateMemoryImages(String(postId), { description: caption });
          if (!res.success) { toast.error(res.error || "The caption couldn't be saved. Try again."); return false; }
          setSavedNow(true);
          const c = flowCampaignRef.current;
          if (c) setFlowCampaign({ ...c, previewMoments: c.previewMoments.map((x) => (x.key === m.key && x.kind === 'photo' ? { ...x, caption } : x)) });
          return true;
        } : undefined,
      };
    }
    if (savedMoments) return { moment: m };
    // A picked item: its caption is made from the website / listing by the API; taking it out unticks it in step 1
    // (or takes it off Add a Moment's picks).
    return {
      moment: m,
      note: m.kind === 'product' ? 'Its caption comes from your website.' : undefined,
      onRemove: () => removeMoment(m),
    };
  });

  /** Sent: say what went (and where the Storeel's stats are), and close. */
  const onStoreelSent = (summary: StoreelSendSummary) => {
    toast.success(sentMessage(summary), {
      duration: ACTION_TOAST_MS,
      // The Storeel report opens in a new tab (App's handleViewStoreelReport).
      action: { label: 'View stats', onClick: () => { window.open('/leads-report', '_blank', 'noopener'); } },
    });
    const id = flowCampaignRef.current?.id;
    if (id) onCampaignSaved?.(id);
    handleModalClose();
  };

  // [wdy2xh2t3z] The Storeel tab in the same full-window frame as the Newsletter tab (NewsletterComposer): the top
  // bar (Back, Create / Edit Campaign, Newsletter | Storeel, Cancel / Create Campaign — Done / Send Now), no app sidebar, the form
  // in one white card on the left and the live preview on the right (below the form on smaller screens).
  const modalContent = (
    <div
      ref={modalOverlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="storeel-create-title"
      // Phones: top/height follow window.visualViewport (useVisualViewportSheet) so the
      // footer stays above the iOS keyboard; wider screens fill the window.
      className="fixed inset-x-0 top-[var(--vv-top,0px)] h-[var(--vv-height,100%)] md:inset-0 md:h-auto flex flex-col bg-[#F8F8FA]"
      // While a campaign-page widget editor is open over it (Chris, 8 Nov 2026), it drops to the app's top bar's level:
      // above the bar (later in the page), under the editor and its dimming (portalled after it) — review M7.
      style={{ zIndex: widgetEditorOpen ? 50 : 99999 }}
    >
      <header className="flex flex-shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-200 bg-white px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={closeFlow} aria-label="Back" className="-ml-1.5 rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 id="storeel-create-title" className="truncate text-lg font-semibold text-gray-900">{view.title}</h2>
        </div>
        {/* Newsletter | Storeel only while nothing is saved: a saved campaign is a Storeel. */}
        {flowEditing || flowCampaign ? <div className="hidden md:block md:flex-1" /> : (
          <div className="order-3 flex w-full justify-center md:order-none md:w-auto md:flex-1">
            <CampaignTypeSwitch value="storeel" onChange={chooseCampaignType} />
          </div>
        )}
        {/* Like the newsletter composer's top bar, minus its actions: those are at the end of the list (Chris, 4 Nov). */}
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <button type="button" onClick={closeFlow} className={BUTTON_OUTLINE}>{view.closeLabel}</button>
        </div>
      </header>

      {/* Scrollable content: the form card, then (or beside it) the live preview */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden modal-scrollbar">
        <div className="mx-auto grid max-w-[1040px] gap-6 px-4 py-6 md:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
          <div className="min-w-0 space-y-4">
            {!flowCampaign && !flowEditing && (isLimitExceeded || serverLimitMessage) && (
              <div
                ref={storeelLimitRef}
                tabIndex={-1}
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 outline-none"
              >
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
                  <svg className="h-4 w-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-900">Campaign Limit Reached</p>
                  <p className="mt-0.5 text-sm text-amber-800">
                    {isLimitExceeded ? (
                      <>
                        Your plan limit has been reached. You have reached your campaign limit of <strong>{limitData.memory_limit || 0} campaigns</strong>.
                        Go to account to upgrade your plan or delete some campaigns.
                      </>
                    ) : serverLimitMessage}{' '}Newsletters are not affected.
                  </p>
                  {/* The upgrade plans (z-[60]) would open under this modal, so close it first. */}
                  <button
                    type="button"
                    onClick={() => setPlansAsk('Upgrade your plan for more campaigns.')}
                    className="mt-2 inline-flex h-8 items-center rounded-lg bg-[#6C60FF] px-3 text-sm font-medium text-white hover:bg-[#5B50E6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40"
                  >
                    Upgrade
                  </button>
                </div>
              </div>
            )}

            {flowLoading ? (
              <StepCard number={stepNumber('campaign')} title="Campaign" id={CAMPAIGN_STEP_ID}>
                <p className="flex items-center gap-2 text-sm text-gray-600"><Loader2 className="h-4 w-4 animate-spin text-[#6C60FF]" aria-hidden="true" />Opening your campaign…</p>
              </StepCard>
            ) : flowLoadError ? (
              <StepCard number={stepNumber('campaign')} title="Campaign" id={CAMPAIGN_STEP_ID} error={flowLoadError}>
                <button type="button" onClick={handleModalClose} className={BUTTON_OUTLINE}>Close</button>
              </StepCard>
            ) : (
            <StepCard number={stepNumber('campaign')} title="Campaign" id={CAMPAIGN_STEP_ID} error={setupError ?? undefined}>
          <div className="space-y-3">

            {/* Memory Title */}
            <div>
              <label className="block text-base md:text-sm font-medium text-gray-700 mb-1">
                Campaign Title *
              </label>
              <Input
                ref={titleInputRef}
                type="text"
                autoFocus
                value={formData.title}
                onChange={handleTitleChange}
                placeholder="Give your campaign a meaningful title"
                className="w-full h-12 md:h-10 text-base md:text-sm bg-gray-50 outline-none focus:outline-none focus-visible:outline-none transition-all duration-300"
                style={
                  titleError
                    ? { borderColor: 'rgb(239,68,68)', boxShadow: '0 0 0 3px rgba(239,68,68,0.2)', ['--tw-ring-shadow' as any]: '0 0 #0000', ['--tw-ring-offset-shadow' as any]: '0 0 #0000' }
                    : !formData.title
                    ? { borderColor: '#7B68EE', boxShadow: '0 0 0 4px rgba(123,104,238,0.2)', ['--tw-ring-shadow' as any]: '0 0 #0000', ['--tw-ring-offset-shadow' as any]: '0 0 #0000' }
                    : { borderColor: '#e5e7eb', ['--tw-ring-shadow' as any]: '0 0 #0000', ['--tw-ring-offset-shadow' as any]: '0 0 #0000' }
                }
                required
              />
              {titleError && (
                <p className="mt-1 text-sm text-red-600">
                  {titleError}
                </p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-base md:text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <div className="create-memory-select">
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                  disabled={isLoading}
                >
                <SelectTrigger className="w-full h-12 md:h-10 text-base md:text-sm bg-gray-50 border-gray-200 outline-none transition-colors [&:focus-visible]:!border-gray-300 [&:focus-visible]:!ring-gray-300/50 [&:focus-visible]:!ring-2 [&:focus]:!border-gray-300 [&:focus]:!ring-gray-300/50 [&:focus]:!ring-2">
                  <SelectValue placeholder={isLoading ? "Loading categories..." : "Select category"} />
                </SelectTrigger>
                <SelectContent
                  style={{
                    zIndex: 100001,
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    outline: 'none'
                  }}
                  className="!border-gray-200 !shadow-md"
                >
                  {isLoading ? (
                    <SelectItem value="loading" disabled>Loading categories...</SelectItem>
                  ) : categoriesForDropdown.length > 0 ? (
                    categoriesForDropdown.map((category: any) => (
                      <SelectItem key={category.id || category.name} value={category.name}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: category.__isShopify ? SHOPIFY_COLOR : getCategoryColor(category.name) }}
                          />
                          {category.name}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    // No categories of your own — don't show fake placeholders
                    <SelectItem value="__no_category__" disabled>No categories — create one first</SelectItem>
                  )}
                </SelectContent>
                </Select>
              </div>
            </div>

            {!flowEditing && !flowCampaign && (<>
            {/* Select from Existing Campaigns */}
            <div id="st-pick-items" className="!mt-6 !mb-6 scroll-mt-6">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectFromExisting}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSelectFromExisting(checked);
                    setVisibleCampaignsCount(CAMPAIGNS_LOAD_BATCH);
                    if (checked && existingMemories.length === 0) loadExistingMemories();
                  }}
                  className="w-5 h-5 md:w-4 md:h-4 bg-gray-100 border-gray-300 rounded focus:ring-2 focus:ring-[#6C60FF] accent-[#6C60FF]"
                />
                <span className="text-base md:text-sm font-medium text-gray-700">{isCatalogCategory ? 'Pick items from your Website Catalogue' : 'Select from Existing Campaigns'}</span>
              </label>

              {selectFromExisting && (
                <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden">
                  {/* Search + Category filter */}
                  <div className="flex gap-2 p-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex-1 min-w-0 relative" ref={memorySearchBoxRef}>
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder={isCatalogCategory ? 'Search items...' : 'Search campaigns...'}
                        value={memorySearch}
                        onChange={(e) => { setMemorySearch(e.target.value); setVisibleCampaignsCount(CAMPAIGNS_LOAD_BATCH); }}
                        onFocus={() => setIsMemorySearchFocused(true)}
                        className="w-full h-12 pl-10 pr-3 text-base border border-gray-200 rounded-lg bg-white outline-none focus:border-[#6C60FF]"
                      />
                      {isMemorySearchFocused && memorySearch.trim() && (
                        <div
                          className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 md:max-h-72 overflow-y-auto modal-scrollbar"
                          style={{ zIndex: 100002 }}
                        >
                          {memorySearchSuggestions.length === 0 ? (
                            <div className="px-3 py-3 text-sm text-gray-400">{isCatalogCategory ? 'No items found' : 'No campaigns found'}</div>
                          ) : (
                            memorySearchSuggestions.map((m: any) => {
                              const id = String(m.id);
                              const isChecked = selectedMemoryIds.includes(id);
                              const loc = typeof m.location === 'string' ? m.location : (m.location?.formatted || m.location?.address || '');
                              const thumb = m.image_link || m.last_update_img || m.thumbnail || '';
                              // No campaign image → fall back to the author's profile, same as the list below.
                              const profile = m.author || m.user || user || {};
                              const profileImg = profile.profile_image || profile.avatar || '';
                              const rawColor = profile.profile_color;
                              const profileColor = rawColor ? (rawColor.startsWith('#') ? rawColor : `#${rawColor}`) : '#6C60FF';
                              const profileInitial = (profile.name || m.title || 'U').charAt(0).toUpperCase();
                              return (
                                <button
                                  type="button"
                                  key={id}
                                  onClick={() => {
                                    toggleSelectedId(id);
                                    setIsMemorySearchFocused(false);
                                  }}
                                  className={`w-full flex items-center gap-3 md:gap-2.5 px-5 py-5 md:px-3 md:py-2.5 text-left border-b border-gray-100 last:border-b-0 transition-colors ${
                                    isChecked ? 'bg-[#6C60FF]/5' : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <input type="checkbox" checked={isChecked} readOnly className="w-5 h-5 md:w-4 md:h-4 rounded accent-[#6C60FF] flex-shrink-0" />
                                  <div className="w-14 h-14 md:w-9 md:h-9 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                                    {thumb ? (
                                      isCampaignVideoUrl(thumb)
                                        ? <CampaignVideoThumbnail src={thumb} className="w-full h-full object-cover" />
                                        : <img src={thumb} alt={m.title} className="w-full h-full object-cover" />
                                    ) : profileImg ? (
                                      <img src={profileImg} alt={profile.name || m.title} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: profileColor }}>
                                        <span className="text-white font-bold text-base md:text-xs uppercase">{profileInitial}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-base md:text-sm font-medium text-gray-900 truncate">{m.title || 'Untitled'}</p>
                                    {loc && <p className="text-sm md:text-xs text-gray-500 truncate">{loc}</p>}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                    <div className="create-memory-select w-[22%] max-w-[76px] shrink-0">
                      <Select
                        value={memoryCategoryFilter}
                        onValueChange={(value) => { setMemoryCategoryFilter(value); setVisibleCampaignsCount(CAMPAIGNS_LOAD_BATCH); }}
                      >
                        <SelectTrigger className="!h-12 text-base bg-gray-50 border-gray-200 outline-none transition-colors [&:focus-visible]:!border-gray-300 [&:focus-visible]:!ring-gray-300/50 [&:focus-visible]:!ring-2 [&:focus]:!border-gray-300 [&:focus]:!ring-gray-300/50 [&:focus]:!ring-2">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent style={{ zIndex: 100001, border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} className="!border-gray-200 !shadow-md">
                          <SelectItem value="All Categories">All</SelectItem>
                          {apiCategories.map((c: any) => (
                            <SelectItem key={c.id || c.name} value={c.name}>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCategoryColor(c.name) }} />
                                {c.name}
                              </div>
                            </SelectItem>
                          ))}
                          {carsAvailable && (
                            <SelectItem value={CARS_CATEGORY_NAME}>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCategoryColor(CARS_CATEGORY_NAME) }} />
                                {CARS_CATEGORY_NAME}
                              </div>
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {(memoriesLoading || shopifyCollectionsLoading || carsForPickerLoading) ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-[#6C60FF]" />
                    </div>
                  ) : (() => {
                    const pickerSource = existingCampaignsPickerSource;
                    const filtered = pickerSource.filter((m: any) => {
                      const locStr = typeof m.location === 'string' ? m.location : (m.location?.formatted || m.location?.address || '');
                      const matchSearch = !memorySearch || (m.title || '').toLowerCase().includes(memorySearch.toLowerCase()) || locStr.toLowerCase().includes(memorySearch.toLowerCase());
                      const matchCat = memoryCategoryFilter === 'All Categories' || (m.category?.name || m.category || '') === memoryCategoryFilter;
                      return matchSearch && matchCat;
                    });
                    const visibleItems = filtered.slice(0, visibleCampaignsCount);
                    const allSelected = filtered.length > 0 && filtered.every((m: any) => selectedMemoryIds.includes(String(m.id)));

                    return (
                      <>
                        {/* Select All / Deselect All */}
                        <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-100">
                          <span className="text-xs font-medium text-[#6C60FF] bg-[#6C60FF]/10 px-2 py-0.5 rounded-full">
                            {isCatalogCategory ? `${selectedMemoryIds.length} / ${CATALOG_MAX_ITEMS} selected` : `${selectedMemoryIds.length} selected`}
                          </span>
                          <div className="flex items-center gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => selectAllIds(filtered.map((m: any) => String(m.id)))}
                              className="text-[#6C60FF] font-medium hover:underline"
                            >Select All</button>
                            <span className="text-gray-300">|</span>
                            <button
                              type="button"
                              onClick={() => { setSelectedMemoryIds([]); setCatalogNotice(''); }}
                              className="text-gray-500 font-medium hover:underline"
                            >Deselect All</button>
                          </div>
                        </div>
                        {isCatalogCategory && catalogNotice && (
                          <p role="status" className="px-3 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-100">{catalogNotice}</p>
                        )}

                        {/* Memory list — each campaign is its own bordered card. Fixed-height,
                            internally scrollable; more items load in as you near the bottom. */}
                        {visibleItems.length === 0 ? (
                          <div className="py-6 text-center text-sm text-gray-400">{isCatalogCategory ? 'No items found' : 'No campaigns found'}</div>
                        ) : (
                          <div
                            className="space-y-2 p-3 bg-white max-h-80 overflow-y-auto modal-scrollbar"
                            onScroll={(e) => {
                              const el = e.currentTarget;
                              if (
                                visibleCampaignsCount < filtered.length &&
                                el.scrollTop + el.clientHeight >= el.scrollHeight - 80
                              ) {
                                setVisibleCampaignsCount(prev => Math.min(prev + CAMPAIGNS_LOAD_BATCH, filtered.length));
                              }
                            }}
                          >
                            {visibleItems.map((m: any) => {
                              const id = String(m.id);
                              const isChecked = selectedMemoryIds.includes(id);
                              const thumb = m.image_link || m.last_update_img || m.thumbnail || '';
                              const loc = typeof m.location === 'string' ? m.location : (m.location?.formatted || m.location?.address || 'Unknown location');
                              const count = m.posts_count || m.photos?.count || m.photos_count || m.media_count || m.new_images || 0;
                              // No campaign image → fall back to the author's profile (choice A:
                              // campaign owner, else the logged-in user). Profile image first,
                              // otherwise a colored box with the author's initial.
                              const profile = m.author || m.user || user || {};
                              const profileImg = profile.profile_image || profile.avatar || '';
                              const rawColor = profile.profile_color;
                              const profileColor = rawColor ? (rawColor.startsWith('#') ? rawColor : `#${rawColor}`) : '#6C60FF';
                              const profileInitial = (profile.name || m.title || 'U').charAt(0).toUpperCase();
                              return (
                                <div
                                  key={id}
                                  className={`flex items-center gap-4 px-3 py-3.5 rounded-xl border cursor-pointer transition-colors ${
                                    isChecked
                                      ? 'border-[#6C60FF] bg-[#6C60FF]/5'
                                      : 'border-gray-200 bg-white hover:bg-gray-50'
                                  }`}
                                  onClick={() => toggleSelectedId(id)}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    readOnly
                                    className="w-5 h-5 rounded accent-[#6C60FF] flex-shrink-0"
                                  />
                                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                    {thumb ? (
                                      isCampaignVideoUrl(thumb)
                                        ? <CampaignVideoThumbnail src={thumb} className="w-full h-full object-cover" />
                                        : <img src={thumb} alt={m.title} className="w-full h-full object-cover" />
                                    ) : profileImg ? (
                                      <img src={profileImg} alt={profile.name || m.title} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: profileColor }}>
                                        <span className="text-white font-bold text-xl uppercase">{profileInitial}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-base font-medium text-gray-900 truncate">{m.title || 'Untitled'}</p>
                                    <p className="text-sm text-gray-500 truncate">{loc} · {count} images</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
            </>)}

            {/* Cover photo | Intro Video — one or the other (both are the campaign's cover, last_update_img):
                choosing one replaces the other. */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-x-2">
              <input
                ref={coverPhotoInputRef}
                type="file"
                accept={COVER_PHOTO_ACCEPT}
                className="hidden"
                data-testid="cover-photo-input"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  e.target.value = '';
                  if (file) void handleCoverPhotoPicked(file);
                }}
              />
              <input
                ref={introVideoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                data-testid="intro-video-input"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  e.target.value = '';
                  if (file) void handleIntroVideoPicked(file);
                }}
              />
              {(['photo', 'video'] as const).map((kind, i) => {
                const chosen = coverChoice.kind === kind;
                const label = kind === 'photo' ? 'Cover photo' : 'Intro Video';
                return (
                  <React.Fragment key={kind}>
                    {i === 1 && <span className="flex h-12 md:h-10 items-center text-sm text-gray-400" aria-hidden="true">or</span>}
                    <div className="min-w-0">
                      <label className="flex items-center gap-2 text-base md:text-sm font-medium text-gray-700 mb-1">
                        {kind === 'photo' ? <ImageIcon className="w-4 h-4 text-black flex-shrink-0" /> : <Video className="w-4 h-4 text-black flex-shrink-0" />}
                        <span className="truncate">{label}</span>
                        <span className="hidden md:inline text-gray-400 font-normal">(optional)</span>
                      </label>
                      {chosen ? (
                        <div className="flex h-12 md:h-10 items-center justify-between gap-2 px-3 border border-gray-200 rounded-lg bg-gray-50" data-testid={`cover-choice-${kind}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            {coverChoice.uploading ? (
                              <Loader2 className="w-4 h-4 text-[#6C60FF] flex-shrink-0" style={{ animation: 'spin 2s linear infinite' }} />
                            ) : kind === 'photo' && coverDisplayUrl ? (
                              <img src={coverDisplayUrl} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                            ) : kind === 'photo' ? (
                              <ImageIcon className="w-4 h-4 text-[#6C60FF] flex-shrink-0" />
                            ) : (
                              <Video className="w-4 h-4 text-[#6C60FF] flex-shrink-0" />
                            )}
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm text-gray-700 truncate">{coverChoice.name}</span>
                              {coverChoice.uploading && (
                                <span className="text-xs text-[#6C60FF]">Uploading...{kind === 'video' ? ` ${coverChoice.progress}%` : ''}</span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            aria-label={`Remove ${label.toLowerCase()}`}
                            onClick={clearCover}
                            className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (kind === 'photo') { coverPhotoInputRef.current?.click(); return; }
                            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
                            if (isMobile) {
                              setIsVideoRecorderOpen(true);
                            } else {
                              introVideoInputRef.current?.click();
                            }
                          }}
                          className="w-full h-12 md:h-10 px-2 border border-gray-300 rounded-lg text-base md:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors truncate"
                        >
                          {kind === 'photo' ? 'Add Cover Photo' : 'Add Intro Video'}
                        </button>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Photos and videos are added in step 2 Moments (the original Add a Moment UI). */}
            {!flowEditing && !flowCampaign && (<>
            {/* Property (optional, only on personal account) */}
            {viewType !== 'property' && apiProperties.length > 0 && (
              <div>
                <label className="block text-base md:text-sm font-medium text-gray-700 mb-1">
                  Property <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  {/* Click-outside overlay */}
                  {showPropertyDropdown && (
                    <div className="fixed inset-0" style={{ zIndex: 100001 }} onClick={() => setShowPropertyDropdown(false)} />
                  )}
                  {/* Trigger */}
                  <button
                    type="button"
                    onClick={() => { setShowPropertyDropdown(prev => !prev); setPropertySearch(''); }}
                    className="w-full h-12 md:h-10 px-3 border border-gray-200 rounded-lg bg-gray-50 hover:bg-white hover:border-gray-300 transition-colors text-left flex items-center gap-2"
                  >
                    {formData.property.length === 0 ? (
                      <span className="text-sm text-gray-400">Select property</span>
                    ) : formData.property.length === 1 ? (() => {
                      const sel = apiProperties.find(p => p.id.toString() === formData.property[0]);
                      return sel ? (
                        <>
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                            {sel.image ? (
                              <img src={sel.image} alt={sel.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-[#6C60FF] text-white text-xs font-semibold">
                                {sel.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <span className="text-sm text-gray-900 truncate">{sel.name}</span>
                        </>
                      ) : null;
                    })() : (
                      <span className="text-sm text-gray-900 font-medium">{formData.property.length} properties selected</span>
                    )}
                  </button>

                  {/* Dropdown */}
                  {showPropertyDropdown && (
                    <div className="relative w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden flex flex-col" style={{ zIndex: 100002 }}>
                      {/* Search + Select All */}
                      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                        {/* Select All checkbox */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const allIds = apiProperties.map(p => p.id.toString());
                            const allSelected = allIds.every(id => formData.property.includes(id));
                            setFormData(prev => ({ ...prev, property: allSelected ? [] : allIds }));
                          }}
                          className="flex-shrink-0"
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${apiProperties.length > 0 && apiProperties.every(p => formData.property.includes(p.id.toString())) ? 'bg-[#6C60FF] border-[#6C60FF]' : 'border-gray-300 bg-white'}`}>
                            {apiProperties.length > 0 && apiProperties.every(p => formData.property.includes(p.id.toString())) && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            )}
                          </div>
                        </button>
                        {/* Search */}
                        <div className="relative flex-1">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search properties..."
                            value={propertySearch}
                            onChange={(e) => setPropertySearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#6C60FF] bg-white"
                          />
                        </div>
                      </div>

                      {/* List */}
                      <div className="overflow-y-auto max-h-48">
                        {(() => {
                          const filtered = apiProperties.filter(p => !propertySearch.trim() || p.name.toLowerCase().includes(propertySearch.toLowerCase()));
                          if (filtered.length === 0) return <div className="px-3 py-4 text-center text-sm text-gray-400">No properties found</div>;
                          return filtered.map((property) => {
                            const isChecked = formData.property.includes(property.id.toString());
                            return (
                              <button
                                key={property.id}
                                type="button"
                                onClick={() => {
                                  const id = property.id.toString();
                                  setFormData(prev => ({
                                    ...prev,
                                    property: prev.property.includes(id)
                                      ? prev.property.filter(x => x !== id)
                                      : [...prev.property, id]
                                  }));
                                }}
                                className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 text-left ${isChecked ? 'bg-purple-50' : ''}`}
                              >
                                {/* Checkbox */}
                                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${isChecked ? 'bg-[#6C60FF] border-[#6C60FF]' : 'border-gray-300 bg-white'}`}>
                                  {isChecked && (
                                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  )}
                                </div>
                                {/* Image */}
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                                  {property.image ? (
                                    <img src={property.image} alt={property.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-[#6C60FF] text-white text-sm font-semibold">
                                      {property.name.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                {/* Name + location */}
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-900 truncate">{property.name}</div>
                                  {property.location && (
                                    <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                      <MapPin className="w-3 h-3" />{property.location}
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            </>)}

            {/* Date */}
            <div>
              <label className="flex items-center gap-2 text-base md:text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 text-black" />
                Date
              </label>
              <Input
                type="date"
                value={formData.date}
                onChange={handleDateChange}
                className={`h-12 md:h-10 text-base md:text-sm bg-gray-50 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 transition-colors ${
                  isTypingDate 
                    ? 'border-black focus:border-black focus-visible:border-black' 
                    : 'border-gray-200 focus:border-gray-200 focus-visible:border-gray-200'
                }`}
              />
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="endDateCheckbox"
                  checked={showEndDate}
                  onChange={(e) => {
                    setShowEndDate(e.target.checked);
                    if (!e.target.checked) {
                      setFormData(prev => ({ ...prev, endDate: '' }));
                    }
                  }}
                  className="w-5 h-5 md:w-4 md:h-4 bg-gray-100 border-gray-300 rounded focus:ring-2 focus:ring-[#6C60FF] accent-[#6C60FF]"
                />
                <label htmlFor="endDateCheckbox" className="text-base md:text-xs text-gray-600 cursor-pointer">
                  Add end date
                </label>
              </div>
              
              {/* End Date Field */}
              {showEndDate && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={handleEndDateChange}
                    className={`text-sm bg-gray-50 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 transition-colors ${
                      isTypingEndDate 
                        ? 'border-black focus:border-black focus-visible:border-black' 
                        : 'border-gray-200 focus:border-gray-200 focus-visible:border-gray-200'
                    }`}
                    min={formData.date || undefined}
                  />
                </div>
              )}
            </div>

            {/* Location */}
            <div>
              <label className="flex items-center gap-2 text-base md:text-sm font-medium text-gray-700 mb-1">
                <MapPin className="w-4 h-4 text-black" />
                Location <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <GooglePlacesInput
                value={formData.location}
                onChange={handleLocationChange}
                placeholder="Enter location (e.g. Paris, France or Home)"
                className={`h-12 md:h-10 text-base md:text-sm bg-gray-50 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-1 focus-visible:ring-1 transition-colors ${
                  isTypingLocation 
                    ? 'border-black focus:border-black focus:ring-black focus-visible:border-black focus-visible:ring-black' 
                    : 'border-gray-200 focus:border-gray-200 focus:ring-gray-200 focus-visible:border-gray-200 focus-visible:ring-gray-200'
                }`}
                onPlaceSelect={(place) => {
                  console.log('Selected place in CreateMemory:', place);
                  // You can add additional logic here when a place is selected
                }}
              />
            </div>

            {/* Labels + Tags are tucked behind "Advanced filters" to keep the form short
                (same as the mobile app). Opens by itself when either is already set. */}
            <div>
              <button
                type="button"
                onClick={() => setAdvancedFiltersOverride(!advancedFiltersOpen)}
                aria-expanded={advancedFiltersOpen}
                aria-controls="create-campaign-advanced-filters"
                className="inline-flex items-center gap-0.5 py-2 -my-1 text-sm font-semibold text-[#6C60FF] hover:text-[#5A4FE5] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40"
              >
                Advanced filters
                <ChevronRight
                  className={`w-5 h-5 transition-transform duration-200 ${advancedFiltersOpen ? 'rotate-90' : ''}`}
                  aria-hidden="true"
                />
                {!advancedFiltersOpen && advancedFiltersCount > 0 && (
                  <span className="ml-1.5 px-[7px] py-0.5 rounded-[10px] bg-[#F0EEFF] text-[#6C60FF] text-[11px] font-medium leading-tight">
                    {advancedFiltersCount} set
                  </span>
                )}
              </button>
            </div>

            {advancedFiltersOpen && (
              <div id="create-campaign-advanced-filters" className="space-y-3">
                {/* Tags */}
                <div>
                  <label className="flex items-center gap-2 text-base md:text-sm font-medium text-gray-700 mb-1">
                    <Tag className="w-4 h-4 text-black" />
                    Tags <span className="text-gray-400 text-xs">(optional)</span>
                  </label>
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {formData.tags.map((tag, index) => (
                        <span key={index} className="flex items-center gap-1 px-2.5 py-1 bg-gray-200 text-gray-900 text-[12px] font-normal rounded-full border border-gray-300">
                          {tag}
                          <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-red-500 leading-none ml-0.5">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={currentTag}
                      onChange={handleTagChange}
                      placeholder="Add tags separated by commas (e.g. beach, summer, 2024)"
                      className={`flex-1 h-12 md:h-10 text-base md:text-sm bg-gray-50 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-1 focus-visible:ring-1 transition-colors ${
                        isTypingTag
                          ? 'border-black focus:border-black focus:ring-black focus-visible:border-black focus-visible:ring-black'
                          : 'border-gray-200 focus:border-gray-200 focus:ring-gray-200 focus-visible:border-gray-200 focus-visible:ring-gray-200'
                      }`}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                    />
                    <Button
                      type="button"
                      onClick={handleAddTag}
                      size="sm"
                      disabled={!currentTag.trim()}
                      className="text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 border-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Add
                    </Button>
                  </div>
                </div>


                {/* Label */}
                <div>
                  <label className="flex items-center gap-2 text-base md:text-sm font-medium text-gray-700 mb-1">
                    <Tag className="w-4 h-4 text-black" />
                    Labels <span className="text-gray-400 font-normal text-xs">(optional)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={labelInput}
                      onChange={(e) => setLabelInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const trimmed = labelInput.trim();
                          if (trimmed) {
                            setFormData(prev => ({ ...prev, label: trimmed }));
                            setLabelInput('');
                          }
                        }
                      }}
                      placeholder="Add a label..."
                      className="flex-1 h-12 md:h-10 px-3 text-base md:text-sm bg-gray-50 border border-gray-200 rounded-md outline-none focus:border-gray-300 transition-colors"
                    />
                    <button
                      type="button"
                      disabled={!labelInput.trim()}
                      onClick={() => {
                        const trimmed = labelInput.trim();
                        if (trimmed) {
                          setFormData(prev => ({ ...prev, label: trimmed }));
                          setLabelInput('');
                        }
                      }}
                      className="px-4 h-12 md:h-10 text-base md:text-sm font-medium bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>
                  {apiLabels.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-xs text-gray-500 font-medium">Existing:</span>
                      {apiLabels.map((lbl: any) => (
                        <button
                          key={lbl.id}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, label: prev.label === lbl.name ? '' : lbl.name }))}
                          className={`px-3 py-1 text-xs rounded-full border border-[#FEC53D] text-black transition-colors ${
                            formData.label === lbl.name ? 'ring-2 ring-offset-1 ring-[#FEC53D]' : ''
                          }`}
                          style={{ backgroundColor: '#FFD46033' }}
                        >
                          {lbl.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {formData.label && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-gray-500">Selected:</span>
                      <span className="px-2 py-0.5 text-xs border border-[#FEC53D] text-black rounded-full font-medium" style={{ backgroundColor: '#FFD46033' }}>{formData.label}</span>
                      <button type="button" onClick={() => setFormData(prev => ({ ...prev, label: '' }))} className="text-gray-400 hover:text-gray-600 ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Moderation (Chris, 7 Nov 2026, point 12): this campaign's own setting. Saved with the campaign. Only
                    where moderation applies: a business owner (review M2). */}
                {moderationSwitchShown({ campaignApplies: flowCampaign?.moderationApplies ?? null, role: user?.role, viewType }) ? (
                <div className="flex items-center justify-between gap-4" data-testid="st-moderation">
                  <div className="min-w-0">
                    <label htmlFor="st-moderation-switch" className="block text-base md:text-sm font-medium text-gray-700">Moderation</label>
                    <p id="st-moderation-help" className="text-xs text-gray-500">Moderate media before it goes live.</p>
                  </div>
                  <Switch
                    id="st-moderation-switch"
                    checked={moderationOn}
                    onCheckedChange={(v) => setModerationChoice(Boolean(v))}
                    aria-describedby="st-moderation-help"
                  />
                </div>
                ) : null}
              </div>
            )}

            {flowEditing && onDeleteCampaign ? (
              <div className="border-t border-gray-100 pt-3">
                <button type="button" onClick={() => { handleModalClose(); onDeleteCampaign(); }}
                  className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 -ml-2 text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />Delete campaign
                </button>
              </div>
            ) : null}
          </div>
            </StepCard>
            )}

            <StoreelMomentsCard
              rows={momentRows}
              note={view.momentsNote}
              busy={isSubmitting}
              onAddMoment={() => openAddMoment(undefined)}
              addChooser={{ options: chooserOptions, onPick: (kind) => pickWidget(kind, undefined) }}
              captionRequest={captionRequest}
              onDropFiles={savedMoments ? undefined : (files) => {
                const valid = Array.from(files).filter((f) => ['image/jpeg', 'image/jpg', 'image/png'].includes(f.type.toLowerCase()));
                if (valid.length !== files.length) toast.error('Please choose only JPG, JPEG or PNG photos.');
                if (!valid.length) return;
                const dt = new DataTransfer();
                valid.forEach((f) => dt.items.add(f));
                setMomentFiles(dt.files);
                addAnchorRef.current = undefined;
                setIsAddMomentOpen(true);
              }}
            />

            <StoreelSendStep
              campaign={flowCampaign}
              optionalLine={view.sendOptional}
              sendRequest={sendRequest}
              onStatus={({ problem, filled }) => { setSendBlocker(problem); setSendFilled(filled); }}
              sender={flowSender}
              paid={starterPlan.known && !starterPlan.isStarter}
              canSend={canSend}
              active={open && campaignType === 'storeel'}
              onSent={onStoreelSent}
              onForbidden={() => setSendForbidden(true)}
              onSeePlans={() => setPlansAsk('Upgrade your plan to send more messages this month.')}
            />

            {/* Publishing (Chris, 8 Nov 2026 (b), point 2): the campaign page's old Publish options — only on a saved
                campaign opened from its page, which renders the body (same calls as before). */}
            {publishing && flowCampaign && !flowLoading && !flowLoadError ? (
              <StepCard number={publishingStepNumber()} title="Publishing" id={PUBLISHING_STEP_ID}>
                {publishing}
              </StepCard>
            ) : null}

            {/* The actions, at the end of the list like the newsletter composer's (Chris, 4 Nov: "Just keep going down
                the list"): save only, or save and then confirm the send. Nothing is saved before one is pressed. Right
                after the Send card on every screen (phones: before the preview, so they are reached right after the
                form). A refused save says why here too, and its field is scrolled to. */}
            {/* Chris, 6 Nov 2026: every reason / error here reads like an error — "*Add a campaign title", red, on the
                left, in the middle of the gap between the Send card and the buttons (as much space above as below). */}
            <div id="st-actions" className={actionMessages.length || view.createdNote ? '' : 'pt-2'}>
              {actionMessages.length || view.createdNote ? (
                <div data-testid="st-action-lines" className="space-y-1 pb-4 text-left">
                  {actionMessages.map((line) => (
                    <p key={line.id} id={line.id} role={line.alert ? 'alert' : undefined} className="text-sm text-red-600">{line.text}</p>
                  ))}
                  {view.createdNote ? <p role="status" className="text-sm text-gray-700">{view.createdNote}</p> : null}
                </div>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                <button type="button" onClick={closeFlow} className={`${BUTTON_OUTLINE} w-full sm:w-auto`}>{view.closeLabel}</button>
                <button type="button" onClick={() => saveFlow(false)} disabled={saveDisabled} aria-describedby={saveReason ? 'st-save-reason' : undefined} className={`${BUTTON_SECONDARY} w-full sm:w-auto`}>
                  {savingAction === 'save' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}{view.save.label}
                </button>
                <button type="button" onClick={() => saveFlow(true)} disabled={saveDisabled || Boolean(sendDisabledReason)}
                  aria-describedby={saveReason ? 'st-save-reason' : sendDisabledReason ? 'st-send-reason' : undefined} className={`${BUTTON_PRIMARY} w-full sm:w-auto`}>
                  {savingAction === 'send' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}{view.saveAndSend.label}
                </button>
              </div>
            </div>
          </div>

          <aside aria-label="Storeel preview" className="min-w-0 self-start pb-[max(1rem,env(safe-area-inset-bottom))] lg:sticky lg:top-0">
            <StoreelLivePreview
              input={{
                title: formData.title, moments: previewMoments,
                location: formData.location, date: formData.date, authorName: user?.name,
                // The cover's pills and dates (Chris's Figma, 6 Nov 2026).
                category: formData.category === CURRENT_CATEGORY ? '' : formData.category, endDate: showEndDate ? formData.endDate : '',
                // The cover the saved campaign page will show: cover photo, intro video, else the brand.
                coverPhoto: coverChoice.kind === 'photo' ? coverDisplayUrl : null,
                introVideo: coverChoice.kind === 'video' ? coverDisplayUrl : null,
                brandImage: storeelBrandImage({ viewType, propertyImage: currentProperty?.image, userAvatar: user?.avatar }),
              }}
              avatarUrl={user?.avatar ?? null}
              avatarColor={user?.profile_color ?? null}
              controls={flowLoading || flowLoadError ? undefined : previewControls}
              widgets={savedMomentsList ? previewWidgets : undefined}
              cardButtons={savedMomentsList ? previewCardButtons : undefined}
            />
          </aside>
          {/* See plans (review I2): the plans open under this page, so leaving it is asked first. */}
          <ComposerDialog
            open={plansAsk !== null}
            onOpenChange={(o) => { if (!o) setPlansAsk(null); }}
            title="Leave this Storeel to see the plans?"
            description={flowCampaign ? 'Changes you haven’t saved yet (title, cover, dates…) will be lost. Save Changes first to keep them.' : 'It isn’t saved yet. Save as Draft first to keep it, or leave now and it will be lost.'}
            footer={(
              <>
                <button type="button" onClick={() => setPlansAsk(null)} className={BUTTON_OUTLINE}>Stay</button>
                <button type="button" onClick={() => { const msg = plansAsk ?? undefined; setPlansAsk(null); handleModalClose(); requestUpgrade(msg); }} className={BUTTON_PRIMARY}>Leave and see plans</button>
              </>
            )}
          />
          {/* A widget's editor needs the saved Storeel and its page (Chris, 8 Nov 2026, point 1): save first, asked. */}
          <ComposerDialog
            open={widgetAsk !== null}
            onOpenChange={(o) => { if (!o) setWidgetAsk(null); }}
            title={flowCampaign ? 'Continue on the Storeel’s page?' : 'Save this Storeel as a draft first?'}
            description={flowCampaign
              ? `${widgetAsk?.label ?? 'This widget'} is added on the Storeel’s page. We’ll save your changes, then open the ${widgetAsk?.label ?? ''} editor at this place.`
              : `${widgetAsk?.label ?? 'This widget'} is added to a saved Storeel. We’ll save your draft, then open the ${widgetAsk?.label ?? ''} editor at this place on the Storeel’s page.`}
            footer={(
              <>
                <button type="button" onClick={() => setWidgetAsk(null)} className={BUTTON_OUTLINE}>Cancel</button>
                <button type="button" onClick={() => { void confirmWidgetAsk(); }} disabled={isSubmitting} className={BUTTON_PRIMARY}>
                  {flowCampaign ? 'Save and continue' : 'Save draft and continue'}
                </button>
              </>
            )}
          />
          {/* Saved campaign: a moment is deleted from it at once, so ask first (Chris, 7 Nov 2026). */}
          <ComposerDialog
            open={deleteAsk !== null}
            onOpenChange={(o) => { if (!o && !momentBusy) setDeleteAsk(null); }}
            title="Delete this moment?"
            description="It is removed from the campaign now."
            footer={(
              <>
                <button type="button" onClick={() => setDeleteAsk(null)} disabled={momentBusy} className={BUTTON_OUTLINE}>Cancel</button>
                <button type="button" onClick={() => { void confirmDelete(); }} disabled={momentBusy} className={`${BUTTON_PRIMARY} !bg-red-600 hover:!bg-red-700`}>
                  {momentBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}Delete
                </button>
              </>
            )}
          />
        </div>
      </div>

    </div>
  );

  return (
    <>
      {/* Render modal in portal only when open */}
      {open && campaignType === 'storeel' && createPortal(modalContent, document.body)}
      {open && (campaignType === 'newsletter' || composerMounted) && createPortal(
        <NewsletterComposer
          ref={newsletterComposerRef}
          newsletterId={newsletterId}
          hidden={campaignType !== 'newsletter'}
          switcher={<CampaignTypeSwitch value="newsletter" onChange={chooseCampaignType} />}
          onClose={handleModalClose}
          // Wherever Create Campaign was opened from (Sidebar or Campaigns page), the Newsletters view refreshes.
          onChanged={() => { onNewsletterChanged?.(); announceNewslettersChanged(); }}
          onSwitchToStoreel={() => chooseCampaignType('storeel')}
        />,
        document.body,
      )}

      {/* EXIF Progress Modal - Separate Modal on Right Side */}
      <ExifProgressModal
        isOpen={showExifModal}
        onClose={() => setShowExifModal(false)}
        extractionResults={exifExtractionResults}
      />

      {/* Add Moment Modal - opens with selected images from media block */}
      {createPortal(
        <AddMomentModal
          isOpen={isAddMomentOpen}
          onClose={() => {
            setIsAddMomentOpen(false); setMomentFiles(null); setEditingPhotoIndex(null); setMomentLibraryImages([]);
            // A saved campaign: refresh its moments on close too, as the campaign page does (whatever was added).
            if (flowCampaignRef.current) void refreshSavedMoments(flowCampaignRef.current.id);
          }}
          capturedFiles={editingPhotoIndex !== null ? null : momentFiles}
          // Products / vehicles too (Chris, 7 Nov 2026, point 7).
          inventory={momentInventory}
          // Step 2 Moments' Add a Moment (Storeel flow v2): before the campaign exists the moments are held here and
          // sent with Save as Draft; on a saved campaign the original UI adds them to it directly, as on its page.
          memoryId={flowCampaign ? String(flowCampaign.id) : undefined}
          memoryTitle={formData.title || 'New Campaign'}
          memoryLocation={formData.location}
          // Add from Media Library: the library opens over Add a Moment, so files already chosen in it stay. On a saved
          // campaign its picks go into Add a Moment (as on the campaign page); before that they're added to step 2.
          onOpenMediaLibrary={() => { setLibraryForMoment(true); setIsMediaLibraryModalOpen(true); }}
          selectedMediaLibraryImages={momentLibraryImages}
          // As the campaign page gives it: the campaign's moments ("Choose a Moment"), its tags and the owner's role.
          memoryImages={flowCampaign ? flowCampaign.previewMoments.flatMap((m) => (m.kind === 'photo' && m.postId ? [{ id: String(m.postId), src: m.image || '', title: m.title || 'Untitled', subImages: [] }] : [])) : undefined}
          storyTags={formData.tags}
          userRole={flowCampaign && canSend ? ('owner' as unknown as 'admin') : undefined}
          editPhotoData={editingPhotoIndex !== null && mainPhotosArray[editingPhotoIndex] ? {
            index: editingPhotoIndex,
            name: mainPhotosArray[editingPhotoIndex].imageName || mainPhotosArray[editingPhotoIndex].name,
            fileUrl: mainPhotosArray[editingPhotoIndex].fileUrl || '',
            title: mainPhotosArray[editingPhotoIndex].title || '',
            description: mainPhotosArray[editingPhotoIndex].description || '',
            capture_date: mainPhotosArray[editingPhotoIndex].capture_date || '',
            location: mainPhotosArray[editingPhotoIndex].location || '',
            tags: mainPhotosArray[editingPhotoIndex].tags || [],
            originalSizeMB: mainPhotosArray[editingPhotoIndex].originalSizeMB || 0
          } : undefined}
          onAddMoment={(momentData) => {
            if (flowCampaignRef.current) {
              // Added to the saved campaign by the original UI: show its moments as they now are — at the "+" it was
              // added from (Chris, 7 Nov 2026).
              setIsAddMomentOpen(false);
              setMomentFiles(null);
              setMomentLibraryImages([]);
              setSavedNow(true);
              void placeSavedUploads(flowCampaignRef.current.id, shownPlacedKeys, addAnchorRef.current);
              onCampaignSaved?.(flowCampaignRef.current.id);
              return;
            }
            if (momentData?.editIndex !== undefined) {
              // Edit mode — update existing photo in mainPhotosArray
              if (momentData?.photos?.[0]) {
                setMainPhotosArray(prev => prev.map((photo, i) =>
                  i === momentData.editIndex ? { ...photo, ...momentData.photos[0] } : photo
                ));
              }
            } else if (momentData?.photos?.length > 0) {
              // Add mode — append new photos (where the preview's "+" was, Chris 7 Nov 2026)
              const added = withPhotoIds(momentData.photos as typeof mainPhotosArray);
              setMainPhotosArray(prev => [...prev, ...added]);
              placeAdded(added.filter((p) => p.fileUrl).map((p) => `photo-${p.id}`));
            }
            setIsAddMomentOpen(false);
            setMomentFiles(null);
            setEditingPhotoIndex(null);
          }}
        />,
        document.body
      )}

      {/* Video Recorder Modal — mobile only */}
      {createPortal(
        <VideoRecorderModal
          isOpen={isVideoRecorderOpen}
          onClose={() => setIsVideoRecorderOpen(false)}
          onVideoReady={(fileUrl, fileName) => {
            // VideoRecorderModal already uploaded to S3 — just store display name + URL
            dispatchCover({ type: 'ready', seq: nextCoverSeq(), kind: 'video', file: null, name: fileName, url: fileUrl });
            setIsVideoRecorderOpen(false);
          }}
        />,
        document.body
      )}

      {/* Media Library Selection Modal */}
      <MediaLibrarySelectionModal
        isOpen={isMediaLibraryModalOpen}
        onClose={() => { setIsMediaLibraryModalOpen(false); setLibraryForMoment(false); }}
        onConfirm={(selectedItems) => {
          setIsMediaLibraryModalOpen(false);
          if (libraryForMoment && flowCampaignRef.current) {
            // A saved campaign: the picks go into Add a Moment (still open), which adds them to the campaign.
            setLibraryForMoment(false);
            setMomentLibraryImages(selectedItems.map((img) => ({
              id: String(img.id), image: img.image || img.fileUrl || '', title: img.name || 'Untitled', category: img.category || '',
              date: img.capture_date || img.captureDate || undefined, location: img.location || undefined,
            })));
            return;
          }
          if (libraryForMoment) {
            setLibraryForMoment(false);
            toast.success(`${selectedItems.length} ${selectedItems.length === 1 ? 'photo' : 'photos'} added to your moments.`);
          }
          console.log('📚 Selected items from media library:', selectedItems);

          // Convert selected media library images to the format used by mainPhotosArray
          const libraryPhotos = selectedItems.map(img => ({
            name: img.name || 'Untitled',
            location: img.location || '',
            capture_date: img.capture_date || img.captureDate || '',
            capture_time: img.capture_time || img.captureTime || '',
            fileUrl: img.image || img.fileUrl || '',
            imageName: img.imageName || img.name || '',
            originalSizeMB: img.originalSizeMB || 0
          }));

          // Add to mainPhotosArray (where the preview's "+" was, Chris 7 Nov 2026)
          const addedFromLibrary = withPhotoIds(libraryPhotos);
          setMainPhotosArray(prev => [...prev, ...addedFromLibrary]);
          placeAdded(addedFromLibrary.filter((p) => p.fileUrl).map((p) => `photo-${p.id}`));

          console.log('✅ Added media library images to mainPhotosArray:', libraryPhotos);
        }}
      />


    </>
  );
});

export default CreateMemory;