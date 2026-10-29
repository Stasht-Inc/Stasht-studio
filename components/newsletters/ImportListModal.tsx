import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { composerToast } from './ComposerToaster';
import { newslettersAPI, type ConsentType, type ContactList, type MergeResult } from '../../services/newslettersAPI';
import ComposerDialog from './ComposerDialog';
import SegmentedSwitch from './SegmentedSwitch';
import { GENERIC_ERROR } from './lib/apiResult';
import { formatCount, type GroupOption } from './lib/audience';
import {
  MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, buildImportRows, columnLabels, csvFileProblem, detectColumns, importSummary, listNameFromFile, parseCsv, type ColumnMap,
  type DateOrder,
} from './lib/csv';
import { CONSENT_HINT, CONSENT_OPTIONS } from './lib/consent';
import { ALREADY_ON_LIST, mergeResultText } from './lib/lists';
import { LIMITS } from './lib/rules';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, LABEL, LINK_BUTTON, inputClass } from './lib/ui';

const SOURCES = [
  { value: 'csv', label: 'Upload a CSV file' },
  { value: 'leads', label: 'From leads' },
] as const;
const FIELD_LABEL = { name: 'Name', email: 'Email', phone: 'Mobile', consentAt: 'Date they agreed' } as const;
const COLUMN_FIELDS = ['name', 'email', 'phone', 'consentAt'] as const;
type ColumnField = typeof COLUMN_FIELDS[number];
const PREVIEW_ROWS = 5;

export interface ImportListModalProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  groups: GroupOption[];
  onCreated(list: ContactList): void;
  /** Add the file's people to this list instead of making a new one (CSV only; people already on it keep their details). */
  intoList?: Pick<ContactList, 'id' | 'name'> | null;
  onMerged?(result: MergeResult): void;
}

export default function ImportListModal({ open, onOpenChange, groups, onCreated, intoList = null, onMerged }: ImportListModalProps) {
  const [source, setSource] = useState<'csv' | 'leads'>('csv');
  const [name, setName] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [table, setTable] = useState<string[][] | null>(null);
  const [map, setMap] = useState<ColumnMap | null>(null);
  // How these people agreed (CASL): required, never pre-chosen.
  const [consent, setConsent] = useState<ConsentType | null>(null);
  // Only asked when the date column can't tell day/month from month/day.
  const [dateOrder, setDateOrder] = useState<DateOrder | null>(null);
  const [groupId, setGroupId] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (open) return;
    setSource('csv'); setName(''); setFileName(null); setTable(null); setMap(null);
    setConsent(null); setDateOrder(null); setGroupId('all'); setBusy(false); setError(null);
  }, [open]);

  // Chris, 29 Oct (round 2), item 7: a problem shows next to the Import button (always in view, never below the
  // fold) and takes focus so it is read out.
  useEffect(() => {
    if (error) errorRef.current?.focus({ preventScroll: true });
  }, [error]);

  const preview = useMemo(() => (table && map ? buildImportRows(table, map, dateOrder) : null), [table, map, dateOrder]);
  const ready = preview?.rows.length ?? 0;
  const tooMany = ready > MAX_IMPORT_ROWS;
  const columns = table ? columnLabels(table, map?.hasHeader ?? false) : [];

  const readFile = async (file: File) => {
    setError(null);
    // A different file needs its own consent (and its own date order).
    setConsent(null);
    setDateOrder(null);
    if (file.size > MAX_IMPORT_BYTES) { setError('This file is bigger than 5 MB. Split it into smaller files.'); return; }
    let text: string;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const problem = csvFileProblem(file.name, bytes.subarray(0, 64));
      if (problem) { setError(problem); return; }
      text = new TextDecoder('utf-8').decode(bytes);
      // Not UTF-8 (Excel on Windows saves CSV as windows-1252): read it that way so "Renée" stays Renée.
      if (text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(bytes);
    } catch {
      setError('This file could not be read. Try again, or choose another file.');
      return;
    }
    const rows = parseCsv(text);
    if (!rows.length) { setError('This file is empty.'); return; }
    setTable(rows);
    setMap(detectColumns(rows));
    setFileName(file.name);
    setName((current) => (current.trim() ? current : listNameFromFile(file.name)));
  };

  const setColumn = (field: ColumnField, value: string) => {
    if (!map) return;
    const index = value === '' ? null : Number(value);
    setMap({ ...map, [field]: index, ...(field === 'name' ? { firstName: null, lastName: null } : {}) });
  };

  const submit = async () => {
    setError(null);
    if (!intoList && !name.trim()) { setError('Give the list a name.'); return; }
    setBusy(true);
    if (intoList) {
      if (!preview || !ready || tooMany) { setBusy(false); return; }
      if (!consent) { setBusy(false); setError('Choose how these people agreed to hear from you.'); return; }
      if (preview.needsDateOrder) { setBusy(false); setError('Choose whether the dates are day/month or month/day.'); return; }
      const res = await newslettersAPI.importIntoList(intoList.id, { consent: true, consent_type: consent, consent_source: 'import', rows: preview.rows });
      setBusy(false);
      // 422 keys: rows (also "This list can hold up to N people."), consent_type, consent.
      if (!res.ok || !res.data) {
        setError(res.fieldErrors.rows ?? res.fieldErrors.consent_type ?? res.fieldErrors.consent ?? res.error ?? GENERIC_ERROR);
        return;
      }
      composerToast.success(mergeResultText(res.data, undefined, ALREADY_ON_LIST));
      onMerged?.(res.data);
      onOpenChange(false);
      return;
    }
    if (source === 'csv') {
      if (!preview || !ready || tooMany) { setBusy(false); return; }
      // Said on pressing Import (the button stays enabled, so it's clear what is missing).
      if (!consent) { setBusy(false); setError('Choose how these people agreed to hear from you.'); return; }
      if (preview.needsDateOrder) { setBusy(false); setError('Choose whether the dates are day/month or month/day.'); return; }
      const res = await newslettersAPI.importList({ name: name.trim(), consent: true, consent_type: consent, consent_source: 'import', rows: preview.rows });
      setBusy(false);
      // ContactListController::import 422 keys: name, consent, consent_type, rows.
      if (!res.ok || !res.data) {
        setError(res.fieldErrors.name ?? res.fieldErrors.rows ?? res.fieldErrors.consent_type ?? res.fieldErrors.consent ?? res.error ?? GENERIC_ERROR);
        return;
      }
      composerToast.success(importSummary(res.data));
      onCreated(res.data);
      onOpenChange(false);
      return;
    }
    const res = await newslettersAPI.listFromLeads({ name: name.trim(), ...(groupId !== 'all' ? { lead_group_id: Number(groupId) } : {}) });
    setBusy(false);
    // fromLeads 422 keys: name, lead_group_id.
    if (!res.ok || !res.data) { setError(res.fieldErrors.name ?? res.fieldErrors.lead_group_id ?? res.error ?? GENERIC_ERROR); return; }
    composerToast.success(`Made the list "${res.data.name}" with ${formatCount(res.data.member_count)} people.`);
    onCreated(res.data);
    onOpenChange(false);
  };

  // Into an existing list: always a CSV file.
  const csv = Boolean(intoList) || source === 'csv';
  const tooManyText = `This file has more than ${formatCount(MAX_IMPORT_ROWS)} contacts. Split it into smaller files.`;
  const footerProblem = error ?? (csv && tooMany ? tooManyText : null);
  const footer = (
    <>
      {footerProblem ? (
        <p ref={errorRef} id="nl-import-error" role="alert" tabIndex={-1}
          className={`basis-full rounded-lg px-3 py-2 text-sm outline-none ${error ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{footerProblem}</p>
      ) : null}
      <button type="button" onClick={() => onOpenChange(false)} disabled={busy} className={BUTTON_OUTLINE}>Cancel</button>
      <button type="button" onClick={submit} disabled={busy || (csv && (!ready || tooMany))} aria-describedby={footerProblem ? 'nl-import-error' : undefined} className={BUTTON_PRIMARY}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {csv ? `Import ${formatCount(ready)} ${ready === 1 ? 'contact' : 'contacts'}` : 'Make the list'}
      </button>
    </>
  );

  return (
    <ComposerDialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }} title={intoList ? `Import into “${intoList.name}”` : 'Add a list'}
      description={intoList
        ? 'New people are added. People already on the list keep their details; we only fill in what is missing.'
        : 'Bring in your own contacts, or save a copy of your leads as a list.'}
      footer={footer}>
      <div className="space-y-4">
        {intoList ? null : (
          <>
            <SegmentedSwitch label="List source" options={SOURCES} value={source} onChange={(v) => { setSource(v); setError(null); }} />
            <div>
              <label htmlFor="nl-list-name" className={LABEL}>List name</label>
              <input id="nl-list-name" type="text" value={name} maxLength={LIMITS.name} placeholder="e.g. Open house sign-ups"
                onChange={(e) => setName(e.target.value)} className={inputClass()} />
            </div>
          </>
        )}

        {csv ? (
          <>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void readFile(f); }}
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center"
            >
              <FileUp className="h-6 w-6 text-gray-400" aria-hidden="true" />
              <p className="text-sm text-gray-600">{fileName ?? 'Drop a CSV file here, or'}</p>
              <button type="button" onClick={() => fileRef.current?.click()} className={LINK_BUTTON}>{fileName ? 'Choose another file' : 'choose a file'}</button>
              <p className="text-xs text-gray-500">Columns for name, email and mobile number. Up to {formatCount(MAX_IMPORT_ROWS)} contacts.</p>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" tabIndex={-1} aria-hidden="true" data-testid="nl-csv-input"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void readFile(f); }} />
            </div>

            {map && table ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {COLUMN_FIELDS.map((field) => (
                    <div key={field}>
                      <label htmlFor={`nl-col-${field}`} className={LABEL}>{FIELD_LABEL[field]}{field === 'consentAt' ? <span className="font-normal text-gray-500"> (optional)</span> : ' column'}</label>
                      <select id={`nl-col-${field}`} value={map[field] ?? ''} onChange={(e) => setColumn(field, e.target.value)} className={inputClass()}>
                        <option value="">{field === 'name' && map.name === null && map.firstName !== null ? 'First and last name' : field === 'consentAt' ? 'None (use today)' : 'None'}</option>
                        {columns.map((label, i) => <option key={i} value={i}>{label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={map.hasHeader} onChange={(e) => setMap({ ...map, hasHeader: e.target.checked })} className="h-4 w-4 accent-[#6C60FF]" />
                  The first row has column names
                </label>
                <p className="text-sm text-gray-900" aria-live="polite">
                  {ready ? `${formatCount(ready)} ${ready === 1 ? 'contact' : 'contacts'} ready to import.` : 'No contacts with an email address or mobile number yet.'}
                  {preview?.invalid ? ` ${formatCount(preview.invalid)} rows have no email address or mobile number we can use, so they will be skipped.` : ''}
                </p>
                {preview?.needsDateOrder || (dateOrder && map.consentAt !== null) ? (
                  <fieldset className="rounded-lg border border-gray-200 p-3">
                    <legend className="px-1 text-sm font-medium text-gray-900">Are dates day/month or month/day?</legend>
                    <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                      {([['dmy', 'Day/month (31/12/2026)'], ['mdy', 'Month/day (12/31/2026)']] as const).map(([value, label]) => (
                        <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                          <input type="radio" name="nl-date-order" checked={dateOrder === value} onChange={() => setDateOrder(value)} className="h-4 w-4 accent-[#6C60FF]" />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : null}
                {preview?.unreadableDates && !preview.needsDateOrder ? (
                  <p className="text-sm text-amber-800">{`${formatCount(preview.unreadableDates)} ${preview.unreadableDates === 1 ? 'date couldn\u2019t' : 'dates couldn\u2019t'} be read \u2014 we\u2019ll use today\u2019s date.`}</p>
                ) : null}
                {ready ? (
                  <div className="rounded-lg border border-gray-200">
                    <table className="w-full table-fixed text-left text-xs sm:text-sm">
                      <colgroup><col className="w-[30%]" /><col /><col className="w-[6.75rem] sm:w-[8.5rem]" /></colgroup>
                      <caption className="sr-only">The first rows of your file</caption>
                      <thead className="bg-gray-50 text-xs font-medium text-gray-600">
                        <tr><th scope="col" className="px-2.5 py-2 sm:px-3">Name</th><th scope="col" className="px-2.5 py-2 sm:px-3">Email</th><th scope="col" className="px-2.5 py-2 sm:px-3">Mobile</th></tr>
                      </thead>
                      <tbody>
                        {preview!.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="px-2.5 py-2 align-top [overflow-wrap:anywhere] sm:px-3">{r.name ?? '—'}</td>
                            <td className="px-2.5 py-2 align-top [overflow-wrap:anywhere] sm:px-3">{r.email ?? '—'}</td>
                            <td className="whitespace-nowrap px-2.5 py-2 align-top sm:px-3">{r.phone ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <fieldset className="rounded-lg bg-gray-50 p-3" aria-describedby="nl-consent-hint">
                  <legend className="float-left mb-2 w-full text-sm font-medium text-gray-900">How did these people agree to hear from you? <span className="font-normal text-gray-500">(Required)</span></legend>
                  <div className="clear-both space-y-2">
                    {CONSENT_OPTIONS.map((o) => (
                      <label key={o.value} className="flex cursor-pointer items-start gap-2 text-sm text-gray-800">
                        <input type="radio" name="nl-consent-type" value={o.value} checked={consent === o.value} required
                          onChange={() => setConsent(o.value)} className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#6C60FF]" />
                        <span>{o.label}</span>
                      </label>
                    ))}
                  </div>
                  <p id="nl-consent-hint" className="mt-2 text-xs text-gray-500">{CONSENT_HINT}</p>
                </fieldset>
              </div>
            ) : null}
          </>
        ) : (
          <div>
            <label htmlFor="nl-list-leads" className={LABEL}>Who to copy</label>
            <select id="nl-list-leads" value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputClass()}>
              <option value="all">All leads</option>
              {groups.map((g) => <option key={g.id} value={String(g.id)}>{g.name} ({formatCount(g.member_count)})</option>)}
            </select>
            <p className="mt-1.5 text-xs text-gray-500">The list is a copy made now. New leads are not added to it later.</p>
          </div>
        )}
      </div>
    </ComposerDialog>
  );
}
