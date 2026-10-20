import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { newslettersAPI, type ContactList } from '../../services/newslettersAPI';
import ComposerDialog from './ComposerDialog';
import SegmentedSwitch from './SegmentedSwitch';
import { GENERIC_ERROR } from './lib/apiResult';
import { formatCount, type GroupOption } from './lib/audience';
import {
  MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, buildImportRows, columnLabels, detectColumns, importSummary, listNameFromFile, parseCsv, type ColumnMap,
} from './lib/csv';
import { LIMITS } from './lib/rules';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, LABEL, LINK_BUTTON, inputClass } from './lib/ui';

const SOURCES = [
  { value: 'csv', label: 'Upload a CSV file' },
  { value: 'leads', label: 'From leads' },
] as const;
const FIELD_LABEL = { name: 'Name', email: 'Email', phone: 'Mobile' } as const;
const PREVIEW_ROWS = 5;

export interface ImportListModalProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  groups: GroupOption[];
  onCreated(list: ContactList): void;
}

export default function ImportListModal({ open, onOpenChange, groups, onCreated }: ImportListModalProps) {
  const [source, setSource] = useState<'csv' | 'leads'>('csv');
  const [name, setName] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [table, setTable] = useState<string[][] | null>(null);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [consent, setConsent] = useState(false);
  const [groupId, setGroupId] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) return;
    setSource('csv'); setName(''); setFileName(null); setTable(null); setMap(null);
    setConsent(false); setGroupId('all'); setBusy(false); setError(null);
  }, [open]);

  const preview = useMemo(() => (table && map ? buildImportRows(table, map) : null), [table, map]);
  const ready = preview?.rows.length ?? 0;
  const tooMany = ready > MAX_IMPORT_ROWS;
  const columns = table ? columnLabels(table, map?.hasHeader ?? false) : [];

  const readFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_IMPORT_BYTES) { setError('This file is bigger than 5 MB. Split it into smaller files.'); return; }
    const rows = parseCsv(await file.text());
    if (!rows.length) { setError('This file is empty.'); return; }
    setTable(rows);
    setMap(detectColumns(rows));
    setFileName(file.name);
    setName((current) => (current.trim() ? current : listNameFromFile(file.name)));
  };

  const setColumn = (field: 'name' | 'email' | 'phone', value: string) => {
    if (!map) return;
    const index = value === '' ? null : Number(value);
    setMap({ ...map, [field]: index, ...(field === 'name' ? { firstName: null, lastName: null } : {}) });
  };

  const submit = async () => {
    setError(null);
    if (!name.trim()) { setError('Give the list a name.'); return; }
    setBusy(true);
    if (source === 'csv') {
      if (!preview || !ready || !consent || tooMany) { setBusy(false); return; }
      const res = await newslettersAPI.importList({ name: name.trim(), consent: true, rows: preview.rows });
      setBusy(false);
      // ContactListController::import 422 keys: name, consent, rows.
      if (!res.ok || !res.data) { setError(res.fieldErrors.name ?? res.fieldErrors.rows ?? res.fieldErrors.consent ?? res.error ?? GENERIC_ERROR); return; }
      toast.success(importSummary(res.data));
      onCreated(res.data);
      onOpenChange(false);
      return;
    }
    const res = await newslettersAPI.listFromLeads({ name: name.trim(), ...(groupId !== 'all' ? { lead_group_id: Number(groupId) } : {}) });
    setBusy(false);
    // fromLeads 422 keys: name, lead_group_id.
    if (!res.ok || !res.data) { setError(res.fieldErrors.name ?? res.fieldErrors.lead_group_id ?? res.error ?? GENERIC_ERROR); return; }
    toast.success(`Made the list "${res.data.name}" with ${formatCount(res.data.member_count)} people.`);
    onCreated(res.data);
    onOpenChange(false);
  };

  const footer = (
    <>
      <button type="button" onClick={() => onOpenChange(false)} disabled={busy} className={BUTTON_OUTLINE}>Cancel</button>
      <button type="button" onClick={submit} disabled={busy || (source === 'csv' && (!consent || !ready || tooMany))} className={BUTTON_PRIMARY}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {source === 'csv' ? `Import ${formatCount(ready)} ${ready === 1 ? 'contact' : 'contacts'}` : 'Make the list'}
      </button>
    </>
  );

  return (
    <ComposerDialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }} title="Add a list"
      description="Bring in your own contacts, or save a copy of your leads as a list." footer={footer}>
      <div className="space-y-4">
        <SegmentedSwitch label="List source" options={SOURCES} value={source} onChange={(v) => { setSource(v); setError(null); }} />
        <div>
          <label htmlFor="nl-list-name" className={LABEL}>List name</label>
          <input id="nl-list-name" type="text" value={name} maxLength={LIMITS.name} placeholder="e.g. Open house sign-ups"
            onChange={(e) => setName(e.target.value)} className={inputClass()} />
        </div>

        {source === 'csv' ? (
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
                <div className="grid gap-3 sm:grid-cols-3">
                  {(['name', 'email', 'phone'] as const).map((field) => (
                    <div key={field}>
                      <label htmlFor={`nl-col-${field}`} className={LABEL}>{FIELD_LABEL[field]} column</label>
                      <select id={`nl-col-${field}`} value={map[field] ?? ''} onChange={(e) => setColumn(field, e.target.value)} className={inputClass()}>
                        <option value="">{field === 'name' && map.name === null && map.firstName !== null ? 'First and last name' : 'None'}</option>
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
                {tooMany ? <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">This file has more than {formatCount(MAX_IMPORT_ROWS)} contacts. Split it into smaller files.</p> : null}
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
                <label className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
                  <input type="checkbox" checked={consent} aria-required="true" onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#6C60FF]" />
                  <span>These people agreed to get emails or texts from my business. <span className="text-gray-500">(Required)</span></span>
                </label>
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

        {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      </div>
    </ComposerDialog>
  );
}
