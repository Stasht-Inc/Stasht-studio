// Media page "Camera Roll" tab (Chris, 9 Nov 2026). A web page can't list the phone's photos, so this opens the
// phone's own photo picker (on a computer, the file chooser). The photos picked show here, selected, on this device
// only: nothing is uploaded or saved. Tap a photo to (de)select it; the bar on top counts them and Next opens Create
// campaign with them in Add a Moment, where they're uploaded.
import React, { useEffect, useRef, useState } from "react";
import { Images, Plus } from "lucide-react";
import { Button } from "../ui/button";
import {
  CameraRollPick, addPicks, cameraRollSession, selectedPickFiles, selectionLabel, skippedMessage, togglePick,
} from "../../utils/cameraRoll";

interface CameraRollPanelProps {
  /** Next: the selected photos, in grid order. */
  onNext: (files: File[]) => void;
}

/** Same box as the Media grid's checkbox (components/media/MediaGridItem.tsx). */
function PickCheckbox({ checked }: { checked: boolean }) {
  return (
    <div
      className="w-7 h-7 sm:w-8 sm:h-8 rounded-md border-2 flex items-center justify-center transition-all duration-150"
      style={{ backgroundColor: checked ? '#0075FF' : 'white', borderColor: checked ? '#0075FF' : '#d1d5db' }}
    >
      {checked && (
        <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
          <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

export function CameraRollPanel({ onNext }: CameraRollPanelProps) {
  // Kept outside the page: still here after Create campaign is closed without making a campaign.
  const [picks, setPicksState] = useState<CameraRollPick[]>(() => cameraRollSession.getPicks());
  const [notice, setNotice] = useState('');
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const setPicks = (next: CameraRollPick[]) => {
    cameraRollSession.setPicks(next);
    setPicksState(next);
  };

  // Thumbnails: one object URL per photo, freed when it's removed or the tab closes.
  const urlsRef = useRef<Map<string, string>>(new Map());
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const map = urlsRef.current;
    const keys = new Set(picks.map((p) => p.key));
    let changed = false;
    for (const p of picks) {
      if (!map.has(p.key)) { map.set(p.key, URL.createObjectURL(p.file)); changed = true; }
    }
    for (const [key, url] of Array.from(map)) {
      if (!keys.has(key)) { URL.revokeObjectURL(url); map.delete(key); changed = true; }
    }
    if (changed) setUrls(Object.fromEntries(map));
  }, [picks]);
  useEffect(() => () => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current.clear();
  }, []);

  const openPicker = () => inputRef.current?.click();

  const handlePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // the same photos can be picked again
    if (!files.length) return;
    const { picks: next, skipped } = addPicks(picks, files);
    setPicks(next);
    setNotice(skippedMessage(skipped));
  };

  const clearAll = () => {
    setPicks([]);
    setNotice('');
  };

  const selected = picks.filter((p) => p.selected).length;

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      className="hidden"
      data-testid="camera-roll-input"
      onChange={handlePicked}
    />
  );

  if (picks.length === 0) {
    return (
      <div className="mt-3 p-6 sm:p-10 bg-white rounded-lg border border-gray-200 text-center">
        {input}
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#6C60FF]/10 flex items-center justify-center">
          <Images className="w-6 h-6 text-[#6C60FF]" />
        </div>
        <Button type="button" onClick={openPicker} className="bg-[#6C60FF] hover:bg-[#5951E6] text-white">
          Choose from Camera Roll
        </Button>
        <p className="mt-3 text-sm text-gray-600">Pick photos to start a campaign. Nothing is uploaded until you create it.</p>
        {notice && <p className="mt-3 text-sm text-red-600">{notice}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3">
      {input}
      {/* The selection bar: counter left, Next right. */}
      <div className="sticky top-20 z-30 bg-gray-50 pb-2" data-testid="camera-roll-bar">
        <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm sm:text-base font-semibold text-gray-900 truncate">{selectionLabel(selected)}</span>
            <button type="button" onClick={clearAll} className="text-sm text-gray-500 hover:text-gray-800 underline-offset-2 hover:underline">
              Clear
            </button>
          </div>
          <Button
            type="button"
            disabled={selected === 0}
            onClick={() => onNext(selectedPickFiles(picks))}
            className="bg-[#6C60FF] hover:bg-[#5951E6] text-white px-5"
          >
            Next
          </Button>
        </div>
      </div>

      <div className="p-2 sm:p-3 bg-white rounded-lg border border-gray-200">
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5 sm:gap-2">
          {picks.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={p.selected}
              aria-label={`${p.file.name}${p.selected ? ', selected' : ''}`}
              onClick={() => setPicks(togglePick(picks, p.key))}
              className={`relative aspect-square overflow-hidden rounded-md bg-gray-100 ${p.selected ? 'ring-2 ring-[#0075FF]' : ''}`}
            >
              {urls[p.key] && !broken.has(p.key) ? (
                <img
                  src={urls[p.key]}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => setBroken((prev) => new Set(prev).add(p.key))}
                />
              ) : (
                // No preview in this browser (e.g. HEIC on a computer): the file name instead.
                <span className="absolute inset-0 flex items-center justify-center px-2 pt-9 pb-2 sm:pt-10 text-[12px] text-gray-600 break-all">{p.file.name}</span>
              )}
              <span className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2"><PickCheckbox checked={p.selected} /></span>
            </button>
          ))}
          <button
            type="button"
            onClick={openPicker}
            className="aspect-square rounded-md border-2 border-dashed border-gray-300 text-gray-600 hover:border-[#6C60FF] hover:text-[#6C60FF] flex flex-col items-center justify-center gap-1"
          >
            <Plus className="w-6 h-6" />
            <span className="text-sm font-medium">Add more</span>
          </button>
        </div>
        {notice && <p className="mt-3 text-sm text-red-600">{notice}</p>}
      </div>
    </div>
  );
}

export default CameraRollPanel;
