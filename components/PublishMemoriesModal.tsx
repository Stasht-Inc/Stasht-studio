import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Globe, ChevronDown, Eye, Lock, Upload, User } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { userDisplayUtils } from '../utils/authUtils';

interface Memory {
  id: number;
  title: string;
  category: { name: string } | null;
  created_at: string;
  last_update_img?: string;
  cover_image?: string;
  photos?: { count: number; preview_images: { url: string }[] };
  location?: { formatted: string | null };
  tags?: { id: number; name: string }[];
}

type ActiveTab = 'author' | 'campaigns';

interface PublishMemoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  memories: Memory[];
  categories: { id: number; name: string }[];
  onPublish: (selectedMemoryIds: number[], visibility: string, wallpaperBase64: string | null) => Promise<void>;
  userProfileImage?: string;
  userProfileColor?: string;
}

const EXCLUDED_CATEGORIES = ['Shared With', 'Published', 'Suggested'];

const VISIBILITY_OPTIONS = [
  {
    value: 'public',
    label: 'Public',
    desc: 'Anyone can view and leave comments',
    icon: (active: boolean) => <Globe className={`w-5 h-5 ${active ? 'text-[#6C60FF]' : 'text-gray-500'}`} />,
  },
  {
    value: 'view-only',
    label: 'View Only',
    desc: 'Users can only view, no comments allowed',
    icon: (active: boolean) => <Eye className={`w-5 h-5 ${active ? 'text-[#6C60FF]' : 'text-gray-500'}`} />,
  },
  {
    value: 'private',
    label: 'Private',
    desc: 'Only visible with a valid access token',
    icon: (active: boolean) => <Lock className={`w-5 h-5 ${active ? 'text-amber-500' : 'text-gray-500'}`} />,
  },
];

// Includes the raw-MIME-subtype extensions (.quicktime, .x-msvideo, etc.) that
// some iPhone/.mov uploads still carry from a since-fixed backend naming bug
// (ClickUp wdy2xgympv) — without these, those files render as a plain image
// with no play button. Keep this list in sync with the mobile app's
// _isVideoFile() in stasht-app-2026/lib/new_development/stories/story_detail_cover.dart.
const VIDEO_EXTENSIONS = [
  '.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm', '.3gp', '.m4v',
  '.mts', '.m2ts', '.quicktime', '.x-msvideo', '.x-matroska', '.x-ms-wmv', '.3gpp',
];
const isVideoUrl = (url: string) => {
  const lower = url.toLowerCase();
  return VIDEO_EXTENSIONS.some(ext => lower.includes(ext));
};

function MemoryThumbnail({ thumbnail, initials, userProfileImage, userProfileColor }: {
  thumbnail: string | null;
  initials: string;
  userProfileImage?: string;
  userProfileColor?: string;
}) {
  const [thumbError, setThumbError] = useState(false);
  const [profileImgError, setProfileImgError] = useState(false);
  const formattedColor = userDisplayUtils.formatProfileColor(userProfileColor);
  const bgColor = formattedColor || userDisplayUtils.generateAvatarColor(initials) || '#6C60FF';
  const showThumb = thumbnail && !thumbError;
  const showProfileImg = !showThumb && !formattedColor && userProfileImage && !profileImgError;
  const isVideo = showThumb && isVideoUrl(thumbnail!);

  return (
    <div
      className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
      style={{ backgroundColor: bgColor }}
    >
      {showThumb ? (
        isVideo ? (
          <video
            src={`${thumbnail}#t=0.1`}
            className="w-full h-full object-cover"
            preload="metadata"
            playsInline
            muted
            onLoadedMetadata={(e) => {
              const vid = e.currentTarget;
              if (vid.currentTime === 0) vid.currentTime = 0.1;
            }}
            onError={() => setThumbError(true)}
          />
        ) : (
          <img
            src={thumbnail}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setThumbError(true)}
          />
        )
      ) : showProfileImg ? (
        <img
          src={userProfileImage}
          alt="Profile"
          className="w-full h-full object-cover"
          onError={() => setProfileImgError(true)}
        />
      ) : (
        <span className="text-white font-semibold text-sm">{initials}</span>
      )}
    </div>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export default function PublishMemoriesModal({
  isOpen,
  onClose,
  memories,
  categories,
  onPublish,
  userProfileImage,
  userProfileColor,
}: PublishMemoriesModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('author');
  const [visibility, setVisibility] = useState('public');
  const [isVisibilityOpen, setIsVisibilityOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isTagOpen, setIsTagOpen] = useState(false);
  const [selectStoriesChecked, setSelectStoriesChecked] = useState(true);
  const [filterByTagsChecked, setFilterByTagsChecked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('all');
  const [selectedMemories, setSelectedMemories] = useState<number[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [wallpaperPreview, setWallpaperPreview] = useState<string | null>(null);
  const [wallpaperBase64, setWallpaperBase64] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set default filter state per tab
  useEffect(() => {
    if (activeTab === 'campaigns') {
      setSelectStoriesChecked(false);
      setFilterByTagsChecked(true);
    } else {
      setSelectStoriesChecked(true);
      setFilterByTagsChecked(false);
    }
    setSearchQuery('');
    setTagSearchQuery('');
    setSelectedCategory('all');
    setSelectedTag('all');
  }, [activeTab]);

  // Reset all state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('author');
      setVisibility('public');
      setIsVisibilityOpen(false);
      setSelectStoriesChecked(true);
      setFilterByTagsChecked(false);
      setSearchQuery('');
      setSelectedCategory('all');
      setTagSearchQuery('');
      setSelectedTag('all');
      setSelectedMemories([]);
      setWallpaperPreview(null);
      setWallpaperBase64(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredCategories = categories.filter(
    (c: any) => !EXCLUDED_CATEGORIES.includes(c.name)
  );

  const allTags = Array.from(
    new Map(
      memories.flatMap((m) => m.tags || []).map((t) => [t.id, t])
    ).values()
  );

  const filteredMemories = memories.filter((memory) => {
    if (!memory.category || EXCLUDED_CATEGORIES.includes(memory.category.name)) return false;

    if (selectStoriesChecked) {
      if (searchQuery && !memory.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (selectedCategory !== 'all' && memory.category.name !== selectedCategory) return false;
    }

    if (filterByTagsChecked) {
      if (selectedTag !== 'all') {
        const ids = (memory.tags || []).map((t) => t.id.toString());
        if (!ids.includes(selectedTag)) return false;
      }
      if (tagSearchQuery) {
        const matches = (memory.tags || []).some((t) =>
          t.name.toLowerCase().includes(tagSearchQuery.toLowerCase())
        );
        if (!matches) return false;
      }
    }

    return true;
  });

  const handleSelectAll = () => setSelectedMemories(filteredMemories.map((m) => m.id));
  const handleDeselectAll = () => setSelectedMemories([]);
  const handleToggleMemory = (id: number) =>
    setSelectedMemories((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );

  const handlePublish = async () => {
    if (selectedMemories.length === 0) return;
    setIsPublishing(true);
    try {
      await onPublish(selectedMemories, visibility, wallpaperBase64);
      onClose();
    } catch (error) {
      console.error('Error publishing:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleWallpaperFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setWallpaperPreview(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = (e) => setWallpaperBase64(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const getThumbnail = (memory: Memory) =>
    memory.last_update_img || memory.cover_image || memory.photos?.preview_images?.[0]?.url || null;

  const getImageCount = (memory: Memory) => memory.photos?.count ?? 0;

  const getLocation = (memory: Memory) =>
    memory.location?.formatted || 'Unknown location';

  const currentVisibility = VISIBILITY_OPTIONS.find((v) => v.value === visibility)!;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
              {activeTab === 'author'
                ? <User className="w-5 h-5 text-[#6C60FF]" />
                : <Globe className="w-5 h-5 text-[#6C60FF]" />
              }
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {activeTab === 'author' ? 'Publish Author' : 'Publish Campaigns'}
              </h2>
              <p className="text-xs text-gray-500">Choose and publish</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 flex-shrink-0">
          {(['author', 'campaigns'] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'author') {
                  setFilterByTagsChecked(false);
                  setSelectStoriesChecked(true);
                }
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
                activeTab === tab
                  ? 'border-[#6C60FF] text-[#6C60FF]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <GridIcon className="w-4 h-4" />
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">

          {/* Add Wallpaper — Author tab only */}
          {activeTab === 'author' && (
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Add Wallpaper</p>
              <div
                className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors cursor-pointer ${
                  isDragging ? 'border-[#6C60FF] bg-purple-50' : 'border-gray-200 bg-gray-50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleWallpaperFile(file);
                }}
                onClick={() => !wallpaperPreview && fileInputRef.current?.click()}
              >
                {wallpaperPreview ? (
                  <div className="relative">
                    <img
                      src={wallpaperPreview}
                      alt="Wallpaper preview"
                      className="h-24 w-full object-cover rounded-lg"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); setWallpaperPreview(null); }}
                      className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow"
                    >
                      <X className="w-3 h-3 text-gray-600" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                    <p className="text-sm text-gray-500">
                      Drag & drop photo<br />here or click to browse
                    </p>
                  </>
                )}
              </div>
              {!wallpaperPreview && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  + Select Files
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleWallpaperFile(f);
                  e.target.value = '';
                }}
              />
            </div>
          )}

          {/* Publishing Visibility */}
          <div>
            <p className="text-sm font-medium text-gray-900 mb-2">Publishing Visibility</p>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsVisibilityOpen(!isVisibilityOpen)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-purple-50 border border-purple-100 rounded-xl hover:bg-purple-100 transition-colors text-left"
              >
                {currentVisibility.icon(true)}
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{currentVisibility.label}</div>
                  <div className="text-xs text-gray-500">{currentVisibility.desc}</div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>

              {isVisibilityOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <div
                      key={opt.value}
                      onClick={() => { setVisibility(opt.value); setIsVisibilityOpen(false); }}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      {opt.icon(visibility === opt.value)}
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                        <div className="text-xs text-gray-500">{opt.desc}</div>
                      </div>
                      {visibility === opt.value && (
                        <svg className="w-4 h-4 text-[#6C60FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filter Radio Buttons */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="filterMode"
                checked={selectStoriesChecked}
                onChange={() => { setSelectStoriesChecked(true); setFilterByTagsChecked(false); }}
                className="w-4 h-4 accent-[#6C60FF] cursor-pointer"
              />
              <span className="text-sm text-gray-700">Select Campaigns</span>
            </label>
            {activeTab !== 'author' && (
              <>
                <span className="text-gray-300">|</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="filterMode"
                    checked={filterByTagsChecked}
                    onChange={() => { setFilterByTagsChecked(true); setSelectStoriesChecked(false); }}
                    className="w-4 h-4 accent-[#6C60FF] cursor-pointer"
                  />
                  <span className="text-sm text-gray-700">Filter by Tags</span>
                </label>
              </>
            )}
          </div>

          {/* Search / Filter Row */}
          {(selectStoriesChecked || filterByTagsChecked) && (
            <div className="flex gap-2">
              {/* Campaign name search */}
              {selectStoriesChecked && (
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search campaigns..."
                    className="w-full pl-9 text-sm border-gray-300 focus:border-gray-400 focus:ring-0 focus-visible:ring-0 focus-visible:border-gray-400"
                  />
                </div>
              )}
              {/* Tag search — hidden on author tab */}
              {filterByTagsChecked && !selectStoriesChecked && activeTab !== 'author' && (
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    value={tagSearchQuery}
                    onChange={(e) => setTagSearchQuery(e.target.value)}
                    placeholder="Search tags..."
                    className="w-full pl-9 text-sm border-gray-300 focus:border-gray-400 focus:ring-0 focus-visible:ring-0 focus-visible:border-gray-400"
                  />
                </div>
              )}
              {/* Category dropdown (when Select Campaigns active) */}
              {selectStoriesChecked && (
                <div className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => { setIsCategoryOpen(!isCategoryOpen); setIsTagOpen(false); }}
                    className="flex items-center gap-2 pl-3 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 transition-colors whitespace-nowrap"
                  >
                    {selectedCategory === 'all' ? 'All Categories' : selectedCategory}
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                  {isCategoryOpen && (
                    <div className="absolute right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[160px]">
                      {[{ id: 'all', name: 'All Categories' }, ...filteredCategories].map((cat: any) => (
                        <div
                          key={cat.id}
                          onClick={() => { setSelectedCategory(cat.name === 'All Categories' ? 'all' : cat.name); setIsCategoryOpen(false); }}
                          className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                        >
                          {cat.name}
                          {(selectedCategory === 'all' ? cat.name === 'All Categories' : selectedCategory === cat.name) && (
                            <svg className="w-4 h-4 text-gray-700 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* All Tags dropdown (when Filter by Tags active, no Select Campaigns) */}
              {filterByTagsChecked && !selectStoriesChecked && (
                <div className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => { setIsTagOpen(!isTagOpen); setIsCategoryOpen(false); }}
                    className="flex items-center gap-2 pl-3 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 transition-colors whitespace-nowrap"
                  >
                    {selectedTag === 'all' ? 'All Tags' : allTags.find(t => t.id.toString() === selectedTag)?.name || 'All Tags'}
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                  {isTagOpen && (
                    <div className="absolute right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[160px]">
                      {[{ id: 'all', name: 'All Tags' }, ...allTags.map(t => ({ id: t.id.toString(), name: t.name }))].map((tag) => (
                        <div
                          key={tag.id}
                          onClick={() => { setSelectedTag(tag.id === 'all' ? 'all' : tag.id.toString()); setIsTagOpen(false); }}
                          className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                        >
                          {tag.name}
                          {(selectedTag === 'all' ? tag.id === 'all' : selectedTag === tag.id.toString()) && (
                            <svg className="w-4 h-4 text-gray-700 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Selected count + Select All / Deselect All */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6C60FF] bg-purple-100 px-3 py-1 rounded-full">
              {selectedMemories.length} selected
            </span>
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={handleSelectAll}
                className="text-gray-700 font-medium hover:text-[#6C60FF] transition-colors"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={handleDeselectAll}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                Deselect All
              </button>
            </div>
          </div>

          {/* Campaigns List */}
          <div className="space-y-2">
            {filteredMemories.length > 0 ? (
              filteredMemories.map((memory) => {
                const thumbnail = getThumbnail(memory);
                const imageCount = getImageCount(memory);
                const location = getLocation(memory);
                const isChecked = selectedMemories.includes(memory.id);
                const initials = memory.title.charAt(0).toUpperCase();

                return (
                  <div
                    key={memory.id}
                    onClick={() => handleToggleMemory(memory.id)}
                    className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${
                      isChecked
                        ? 'border-[#6C60FF] bg-purple-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => handleToggleMemory(memory.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-shrink-0 rounded border-gray-300 data-[state=unchecked]:border-gray-300 data-[state=unchecked]:bg-white data-[state=checked]:bg-[#6C60FF] data-[state=checked]:border-[#6C60FF] data-[state=checked]:text-white focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <MemoryThumbnail
                      thumbnail={thumbnail}
                      initials={initials}
                      userProfileImage={userProfileImage}
                      userProfileColor={userProfileColor}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{memory.title}</p>
                      <p className="text-xs text-gray-500">
                        {location} · {imageCount} {imageCount === 1 ? 'image' : 'images'}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">No campaigns found</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
          <Button onClick={onClose} variant="outline" className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handlePublish}
            disabled={selectedMemories.length === 0 || isPublishing}
            className="flex-1 bg-[#6C60FF] hover:bg-[#5B52FF] text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Globe className="w-4 h-4 mr-2" />
            {isPublishing ? 'Publishing...' : 'Publish'}
          </Button>
        </div>
      </div>
    </div>
  );
}
