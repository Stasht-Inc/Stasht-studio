import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { composerToast } from './ComposerToaster';
import type { BlockType, CampaignItem, NewsletterBlock, NewsletterHeader } from '../../services/newslettersAPI';
import type { NewsletterDraft } from './lib/draft';
import { initialsFrom, type SenderProfile } from './lib/profile';
import { LIMITS } from './lib/rules';
import { ACTION_TOAST_MS, blocksProblems, campaignSelections, createBlock, insertBlock, liveBlockProblems, moveBlock, newBlockId, removeBlock, undoDelete, updateBlockData } from './lib/blocks';
import { EDIT_ITEMS_LABEL, campaignIdsOf, pruneOverrides } from './lib/campaignsBlock';
import InboxRow from './InboxRow';
import HeaderEditor from './HeaderEditor';
import EcardFooter from './EcardFooter';
import AddSectionPopover from './AddSectionPopover';
import BlockFrame from './BlockFrame';
import BlockEditor, { BLOCK_LABEL } from './blocks/BlockEditor';
import CampaignPickerDialog from './CampaignPickerDialog';
import type { PreviewDevice } from './DeviceToggle';

export interface NewsletterEditorProps {
  draft: NewsletterDraft;
  readOnly: boolean;
  device: PreviewDevice;
  profile: SenderProfile | null;
  businessAddress: string | null;
  /** After a Send / Schedule attempt: mark unfinished sections. */
  showProblems: boolean;
  fieldErrors: Record<string, string>;
  /** A patch, or a function of the latest draft (null: nothing to change). */
  onChange(patch: Partial<NewsletterDraft> | ((latest: NewsletterDraft) => Partial<NewsletterDraft> | null)): void;
  onHeaderChange(header: NewsletterHeader | ((latest: NewsletterHeader) => NewsletterHeader)): void;
  onSaveAddress(address: string): Promise<boolean>;
  /** The sections as last saved (the API's copy): a Campaigns section's cards come from here. */
  savedBlocks?: NewsletterBlock[];
  /** False while the composer is hidden (the Storeel tab shows): Escape is not this editor's then. */
  active?: boolean;
}

const HEADER_ID = '__header__';

/** 422 errors for one section: 'blocks.2' or 'blocks.2.data.url'. */
function serverBlockError(fieldErrors: Record<string, string>, index: number): string | null {
  if (fieldErrors[`blocks.${index}`]) return fieldErrors[`blocks.${index}`];
  const key = Object.keys(fieldErrors).find((k) => k.startsWith(`blocks.${index}.`));
  return key ? fieldErrors[key] : null;
}

interface BlockHandlers {
  onSelect(): void;
  /** Done / × : close the editor, focus back on the section. */
  onDone(): void;
  onMoveUp(): void;
  onMoveDown(): void;
  onDelete(): void;
  onChange(data: Record<string, unknown>): void;
  /** Campaigns: open the picker. */
  onPick(): void;
}

/** One section with its frame. Memoised: typing in one section doesn't re-render the others. */
const BlockRow = memo(function BlockRow({ block, index, count, selected, readOnly, problem, padClass, handlers, serverItems, accent, phone }: {
  block: NewsletterBlock;
  index: number;
  count: number;
  selected: boolean;
  readOnly: boolean;
  problem: string | null;
  padClass: string;
  handlers: BlockHandlers;
  serverItems?: CampaignItem[];
  accent?: string | null;
  phone: boolean;
}) {
  const campaigns = block.type === 'campaigns';
  return (
    <BlockFrame blockId={block.id} label={BLOCK_LABEL[block.type]} index={index} count={count} selected={selected} readOnly={readOnly} problem={problem} padClass={padClass}
      onSelect={handlers.onSelect} onDone={handlers.onDone} onMoveUp={handlers.onMoveUp} onMoveDown={handlers.onMoveDown} onDelete={handlers.onDelete}
      onEdit={campaigns ? handlers.onPick : undefined} editLabel={campaigns ? EDIT_ITEMS_LABEL : undefined}>
      <BlockEditor block={block} selected={selected} readOnly={readOnly} onChange={handlers.onChange}
        serverItems={campaigns ? serverItems : undefined} accent={campaigns ? accent : undefined} onPick={campaigns ? handlers.onPick : undefined} phone={phone} />
    </BlockFrame>
  );
});

/**
 * The right-hand EMAIL PREVIEW, edited in place. It is drawn like the email the server sends
 * (emails/newsletter/*.blade.php): grey page, "View in browser", a 600 px white card with the header,
 * the sections (40 px side padding, 20 px on phones) and the e-card footer. "+" lines sit between sections, always
 * shown.
 */
export default function NewsletterEditor({
  draft, readOnly, device, profile, businessAddress, showProblems, fieldErrors, onChange, onHeaderChange, onSaveAddress, savedBlocks, active = true,
}: NewsletterEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  // True while focus is moved back to a part on purpose (after Done), so that focus doesn't select it again.
  const refocusingRef = useRef(false);
  const select = useCallback((id: string) => { if (!refocusingRef.current) setSelectedId(id); }, []);
  /** Close the open editor (changes are autosaved). focus: put keyboard focus back on that part. */
  const deselect = useCallback((focus: boolean) => {
    const id = selectedRef.current;
    if (!id) return;
    setSelectedId(null);
    if (!focus) return;
    const el = rootRef.current?.querySelector<HTMLElement>(id === HEADER_ID ? '[data-nl-header]' : `[data-block-id="${CSS.escape(id)}"]`);
    refocusingRef.current = true;
    try { el?.focus({ preventScroll: true }); } finally { refocusingRef.current = false; }
  }, []);
  // Escape closes the open editor first (the composer's own Escape, Cancel, comes next time). A popover or dialog
  // that is open handles its own Escape.
  useEffect(() => {
    if (!selectedId || !active) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[data-radix-popper-content-wrapper], [role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return;
      e.preventDefault();
      deselect(true);
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [selectedId, active, deselect]);
  // The Campaigns section whose picker is open.
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  // The section the picker was last opened for (focus goes back to it once the picker has closed).
  const pickedForRef = useRef<string | null>(null);
  if (pickerFor) pickedForRef.current = pickerFor;
  // Each saved Campaigns section's cards, by section id (the API's snapshot).
  const savedItems = useMemo(() => {
    const out = new Map<string, CampaignItem[]>();
    for (const b of savedBlocks ?? []) if (b.type === 'campaigns') out.set(b.id, b.data.items ?? []);
    return out;
  }, [savedBlocks]);
  const { blocks } = draft;
  // Over-long text shows while typing (it can't be saved); everything else after a Send / Schedule attempt.
  const problems = useMemo(() => (showProblems ? blocksProblems(blocks) : liveBlockProblems(blocks)), [blocks, showProblems]);

  // Every section's callbacks work on the latest draft (never a copy captured at render), and are made once per
  // section id so the memoised rows only re-render when their own section changes. An upload that finishes
  // after its section was deleted finds no section and changes nothing.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const handlersRef = useRef(new Map<string, BlockHandlers>());
  const handlersFor = useCallback((id: string): BlockHandlers => {
    const known = handlersRef.current.get(id);
    if (known) return known;
    const onBlocks = (fn: (list: NewsletterBlock[], index: number) => NewsletterBlock[]) => onChangeRef.current((d) => {
      const index = d.blocks.findIndex((b) => b.id === id);
      if (index < 0) return null;
      const next = fn(d.blocks, index);
      return next === d.blocks ? null : { blocks: next };
    });
    const made: BlockHandlers = {
      onSelect: () => select(id),
      onDone: () => deselect(true),
      onMoveUp: () => onBlocks((list, index) => moveBlock(list, index, -1)),
      onMoveDown: () => onBlocks((list, index) => moveBlock(list, index, 1)),
      onDelete: () => {
        let removed: { block: NewsletterBlock; index: number } | null = null;
        onBlocks((list, index) => { removed = { block: list[index], index }; return removeBlock(list, id); });
        setSelectedId(null);
        const gone = removed as { block: NewsletterBlock; index: number } | null;
        if (!gone) return;
        composerToast.info('Section deleted.', {
          duration: ACTION_TOAST_MS,
          action: {
            label: 'Undo',
            onClick: () => {
              // Filled in by the updater, which runs straight away (a ref, so TypeScript doesn't narrow it).
              const result = { outcome: 'restored' as 'restored' | 'already' | 'full' };
              onChangeRef.current((d) => {
                const r = undoDelete(d.blocks, gone.block, gone.index);
                result.outcome = r.outcome;
                return r.outcome === 'restored' ? { blocks: r.blocks } : null;
              });
              const { outcome } = result;
              if (outcome === 'full') composerToast.error(`Your email already has ${LIMITS.blocks} sections. Remove one, then add this back.`);
              else if (outcome === 'already') composerToast.info('That section is already back.');
              else setSelectedId(gone.block.id);
            },
          },
        });
      },
      onChange: (data) => onBlocks((list) => updateBlockData(list, id, data)),
      onPick: () => { setSelectedId(id); setPickerFor(id); },
    };
    handlersRef.current.set(id, made);
    return made;
  }, [select, deselect]);
  // Forget the callbacks of deleted sections.
  useEffect(() => {
    const ids = new Set(blocks.map((b) => b.id));
    for (const id of handlersRef.current.keys()) if (!ids.has(id)) handlersRef.current.delete(id);
  }, [blocks]);
  const full = blocks.length >= LIMITS.blocks;
  const phone = device === 'phone';
  // The email narrows its side padding to 20 px under 620 px wide; the phone view and small screens do too.
  const padClass = phone ? 'px-5' : 'px-5 sm:px-10';

  const add = (index: number, type: BlockType) => {
    const block = createBlock(type, newBlockId(blocks));
    const next = insertBlock(blocks, index, block);
    if (next === blocks) {
      composerToast.error(`You can add up to ${LIMITS.blocks} sections.`);
      return;
    }
    onChange((d) => ({ blocks: insertBlock(d.blocks, index, block) }));
    setSelectedId(block.id);
    // A Campaigns section starts by choosing its campaigns.
    if (type === 'campaigns') setPickerFor(block.id);
  };
  const pickerBlock = pickerFor ? blocks.find((b) => b.id === pickerFor) : undefined;
  const picking = pickerBlock?.type === 'campaigns' ? pickerBlock : null;
  const plus = (index: number, label: string) =>
    readOnly ? null : <AddSectionPopover label={label} onAdd={(type) => add(index, type)} disabled={full} />;

  return (
    // A tap anywhere in the preview outside the selected part closes its editor (a tap on another part selects
    // that one instead). Clicks from popovers and dialogs (portals) don't count.
    <div ref={rootRef} className="overflow-hidden rounded-xl border border-gray-200 bg-white"
      onClick={(e) => {
        const target = e.target as Element;
        if (!selectedRef.current || !rootRef.current?.contains(target)) return;
        if (target.closest('[data-nl-selected="true"], [data-block-id], [data-nl-header]')) return;
        deselect(false);
      }}>
      <p className="border-b border-gray-100 bg-gray-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Inbox</p>
      {/* An empty From name sends as the business's own name (NewsletterSendCheck::fromNameFor): show that. */}
      <InboxRow fromName={draft.from_name.trim() || profile?.name?.trim().slice(0, 80) || ''} subject={draft.subject} previewText={draft.preview_text}
        initial={initialsFrom(profile?.name || draft.from_name).slice(0, 1)} photoUrl={profile?.photoUrl ?? null} color={profile?.color ?? null} />
      <div className={`bg-[#F3F4F8] ${phone ? 'px-2 py-5 sm:px-4' : 'px-2 py-6 sm:px-4'}`} >
        <div className={phone ? 'mx-auto w-[375px] max-w-full rounded-[2rem] border-[6px] border-gray-900 bg-[#F3F4F8] px-2 py-4' : ''}>
          <p className="mb-3 text-center text-xs text-gray-500"><span className="underline">View in browser</span></p>
          <div className="mx-auto w-full max-w-[600px] overflow-hidden rounded-2xl border border-[#ECEDF3] bg-white">
            <HeaderEditor header={draft.header} onChange={onHeaderChange} selected={selectedId === HEADER_ID}
              onSelect={() => { if (!readOnly) select(HEADER_ID); }} onDone={() => deselect(true)} readOnly={readOnly} padClass={padClass} />
            <div className="py-3">
              {plus(0, 'Add a section at the top')}
              {blocks.length === 0 && !readOnly ? <p className={`${padClass} pb-3 text-center text-sm text-gray-500`}>Tap + to add your first section.</p> : null}
              {blocks.map((block, index) => (
                <Fragment key={block.id}>
                  <BlockRow block={block} index={index} count={blocks.length} selected={selectedId === block.id} readOnly={readOnly}
                    problem={problems[block.id] ?? serverBlockError(fieldErrors, index)} padClass={padClass} handlers={handlersFor(block.id)}
                    serverItems={savedItems.get(block.id)} accent={draft.header.background_color} phone={phone} />
                  {plus(index + 1, `Add a section after section ${index + 1}`)}
                </Fragment>
              ))}
            </div>
            <EcardFooter profile={profile} fromName={draft.from_name} businessAddress={businessAddress} onSaveAddress={onSaveAddress} readOnly={readOnly}
              addressError={fieldErrors.business_address ?? null} padClass={padClass} />
          </div>
        </div>
      </div>
      {readOnly ? null : (
        <CampaignPickerDialog
          open={picking !== null}
          onOpenChange={(o) => { if (!o) setPickerFor(null); }}
          initialSelections={picking ? campaignSelections(picking.data) : []}
          knownItems={picking ? [...(picking.data.items ?? []), ...(savedItems.get(picking.id) ?? [])] : []}
          onDone={(selections, items) => {
            if (!picking) return;
            // A card taken out loses its edits (picked again later, it starts from the item's own words).
            const overrides = pruneOverrides(picking.data.overrides, selections);
            handlersFor(picking.id).onChange({ selections, campaign_ids: campaignIdsOf(selections), items, ...(overrides ? { overrides } : {}) });
          }}
          onCloseAutoFocus={(e) => {
            // Back to the section (it stays selected), not to the + that has gone.
            const id = pickedForRef.current;
            const el = id ? document.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(id)}"]`) : null;
            if (el) { e.preventDefault(); el.focus({ preventScroll: true }); }
          }}
        />
      )}
    </div>
  );
}
