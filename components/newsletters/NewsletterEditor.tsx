import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { BlockType, NewsletterBlock, NewsletterHeader } from '../../services/newslettersAPI';
import type { NewsletterDraft } from './lib/draft';
import { initialsFrom, type SenderProfile } from './lib/profile';
import { LIMITS } from './lib/rules';
import { blocksProblems, createBlock, insertBlock, liveBlockProblems, moveBlock, newBlockId, removeBlock, updateBlockData } from './lib/blocks';
import InboxRow from './InboxRow';
import HeaderEditor from './HeaderEditor';
import EcardFooter from './EcardFooter';
import AddSectionPopover from './AddSectionPopover';
import BlockFrame from './BlockFrame';
import BlockEditor, { BLOCK_LABEL } from './blocks/BlockEditor';
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
  onMoveUp(): void;
  onMoveDown(): void;
  onDelete(): void;
  onChange(data: Record<string, unknown>): void;
}

/** One section with its frame. Memoised: typing in one section doesn't re-render the others. */
const BlockRow = memo(function BlockRow({ block, index, count, selected, readOnly, problem, padClass, handlers }: {
  block: NewsletterBlock;
  index: number;
  count: number;
  selected: boolean;
  readOnly: boolean;
  problem: string | null;
  padClass: string;
  handlers: BlockHandlers;
}) {
  return (
    <BlockFrame label={BLOCK_LABEL[block.type]} index={index} count={count} selected={selected} readOnly={readOnly} problem={problem} padClass={padClass}
      onSelect={handlers.onSelect} onMoveUp={handlers.onMoveUp} onMoveDown={handlers.onMoveDown} onDelete={handlers.onDelete}>
      <BlockEditor block={block} selected={selected} readOnly={readOnly} onChange={handlers.onChange} />
    </BlockFrame>
  );
});

/**
 * The right-hand EMAIL PREVIEW, edited in place. It is drawn like the email the server sends
 * (emails/newsletter/*.blade.php): grey page, "View in browser", a 600 px white card with the header,
 * the sections (40 px side padding, 20 px on phones) and the e-card footer. "+" lines sit between sections.
 */
export default function NewsletterEditor({
  draft, readOnly, device, profile, businessAddress, showProblems, fieldErrors, onChange, onHeaderChange, onSaveAddress,
}: NewsletterEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
      onSelect: () => setSelectedId(id),
      onMoveUp: () => onBlocks((list, index) => moveBlock(list, index, -1)),
      onMoveDown: () => onBlocks((list, index) => moveBlock(list, index, 1)),
      onDelete: () => { onBlocks((list) => removeBlock(list, id)); setSelectedId(null); },
      onChange: (data) => onBlocks((list) => updateBlockData(list, id, data)),
    };
    handlersRef.current.set(id, made);
    return made;
  }, []);
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
      toast.error(`You can add up to ${LIMITS.blocks} sections.`);
      return;
    }
    onChange((d) => ({ blocks: insertBlock(d.blocks, index, block) }));
    setSelectedId(block.id);
  };
  const plus = (index: number, label: string, alwaysVisible = false) =>
    readOnly ? null : <AddSectionPopover label={label} onAdd={(type) => add(index, type)} disabled={full} alwaysVisible={alwaysVisible} />;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <p className="border-b border-gray-100 bg-gray-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Inbox</p>
      <InboxRow fromName={draft.from_name} subject={draft.subject} previewText={draft.preview_text}
        initial={initialsFrom(profile?.name || draft.from_name).slice(0, 1)} photoUrl={profile?.photoUrl ?? null} color={profile?.color ?? null} />
      <div className={`bg-[#F3F4F8] ${phone ? 'px-2 py-5 sm:px-4' : 'px-2 py-6 sm:px-4'}`} onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}>
        <div className={phone ? 'mx-auto w-[375px] max-w-full rounded-[2rem] border-[6px] border-gray-900 bg-[#F3F4F8] px-2 py-4' : ''}>
          <p className="mb-3 text-center text-xs text-gray-500"><span className="underline">View in browser</span></p>
          <div className="mx-auto w-full max-w-[600px] overflow-hidden rounded-2xl border border-[#ECEDF3] bg-white">
            <HeaderEditor header={draft.header} onChange={onHeaderChange} selected={selectedId === HEADER_ID}
              onSelect={() => { if (!readOnly) setSelectedId(HEADER_ID); }} readOnly={readOnly} padClass={padClass} />
            <div className="py-3">
              {plus(0, 'Add a section at the top', blocks.length === 0)}
              {blocks.length === 0 && !readOnly ? <p className={`${padClass} pb-3 text-center text-sm text-gray-500`}>Tap + to add your first section.</p> : null}
              {blocks.map((block, index) => (
                <Fragment key={block.id}>
                  <BlockRow block={block} index={index} count={blocks.length} selected={selectedId === block.id} readOnly={readOnly}
                    problem={problems[block.id] ?? serverBlockError(fieldErrors, index)} padClass={padClass} handlers={handlersFor(block.id)} />
                  {plus(index + 1, `Add a section after section ${index + 1}`)}
                </Fragment>
              ))}
            </div>
            <EcardFooter profile={profile} fromName={draft.from_name} businessAddress={businessAddress} onSaveAddress={onSaveAddress} readOnly={readOnly}
              addressError={fieldErrors.business_address ?? null} padClass={padClass} />
          </div>
        </div>
      </div>
    </div>
  );
}
