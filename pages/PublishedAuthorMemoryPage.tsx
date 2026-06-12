import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Calendar, Globe, Copy, Share2, QrCode, X, Mail, Facebook, Linkedin, Instagram } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import MemoryCard from "../components/MemoryCard";

export default function PublishedAuthorMemoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entryData, setEntryData] = useState<any>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showAuthorPopover, setShowAuthorPopover] = useState(false);

  const shareUrl = window.location.href;

  useEffect(() => {
    if (!slug) {
      setError("Campaign not found");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const apiBase = import.meta.env.VITE_API_BASE_URL || "/api/react";
        const response = await fetch(`${apiBase}/memories/published/${slug}`, {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Failed to load campaign (${response.status})`);
        }

        const json = await response.json();
        setEntryData(json);
      } catch (err: any) {
        setError(err.message || "Failed to load campaign");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug]);

  const fallbackCopy = (text: string) => {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    try {
      document.execCommand("copy");
      toast.success("Link copied!");
    } catch {
      toast.error("Failed to copy link");
    }
    document.body.removeChild(el);
  };

  const handleCopy = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(shareUrl)
        .then(() => toast.success("Link copied!"))
        .catch(() => fallbackCopy(shareUrl));
    } else {
      fallbackCopy(shareUrl);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ url: shareUrl, title: "Published Campaign" });
    } else {
      fallbackCopy(shareUrl);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#9333EA] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-800 mb-2">Campaign not found</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  // Normalise the response — the API returns { success, author, data, meta }
  const memories: any[] = entryData?.data || [];
  const author = entryData?.author || {};
  const meta = entryData?.meta || entryData || {};
  const authorName = author.name || meta.author_name || meta.name || "Published Campaign";
  const authorProfileImage = author.profile_image || null;
  const authorProfileColor = author.profile_color
    ? (author.profile_color.startsWith('#') ? author.profile_color : `#${author.profile_color}`)
    : '#6C60FF';
  const wallpaperImage = entryData?.wallpaper_image || meta.wallpaper_image || entryData?.data?.[0]?.wallpaper_image || meta.cover_image || null;
  const publishedAt = meta.published_at || meta.created_at || null;
  const visibility = meta.visibility || "public";

  const visibilityLabel =
    visibility === "view_only" ? "View Only" : visibility === "private" ? "Private" : "Public";
  const visibilityColor =
    visibility === "view_only"
      ? "bg-yellow-100 text-yellow-700 border border-yellow-200"
      : visibility === "private"
      ? "bg-red-100 text-red-700 border border-red-200"
      : "bg-blue-100 text-blue-700 border border-blue-200";

  return (
    <div className="relative w-full min-h-screen bg-white pb-20 lg:pb-0">
      {/* Hero Section */}
      <div className="relative w-full h-[196px] sm:h-56 md:h-80">
        {wallpaperImage ? (
          <img src={wallpaperImage} alt="Published" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: authorProfileColor }}
          >
            <span className="text-white font-bold text-6xl md:text-8xl uppercase opacity-30">
              {authorName.charAt(0) || "P"}
            </span>
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Back button */}
        <div className="absolute top-0 left-0 right-0 z-20">
          <div className="max-w-7xl mx-auto px-0 sm:px-4 py-3 sm:py-4">
            <div className="flex items-center mx-4 md:mx-0 my-4">
              <button
                onClick={() => window.history.back()}
                className="flex items-center gap-1 bg-gray-200/80 hover:bg-gray-300/80 text-gray-700 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg backdrop-blur-sm"
              >
                <ArrowLeft className="w-6 h-6 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </button>
            </div>
          </div>
        </div>

        {/* Author name + date */}
        <div className="absolute bottom-0 left-0 right-0 z-10 pb-3 sm:pb-4 md:pb-6 pt-20 md:pt-0">
          <div className="max-w-7xl mx-auto px-3 sm:px-4">
            <div className="flex items-center gap-1.5 sm:gap-2 md:mb-3">
              <Badge className="bg-[#9333EA] text-white font-medium px-3 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 text-[12px] sm:text-xs md:text-sm">
                Published
              </Badge>
            </div>
            <div className="flex items-center gap-3 mb-2 md:mb-4">
              <Avatar className="w-10 h-10 md:w-14 md:h-14 flex-shrink-0">
                <AvatarImage src={authorProfileImage || undefined} alt={authorName} />
                <AvatarFallback className="text-sm md:text-lg font-bold text-white" style={{ backgroundColor: authorProfileColor }}>
                  {authorName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Popover open={showAuthorPopover} onOpenChange={setShowAuthorPopover}>
                <PopoverTrigger asChild>
                  <h1
                    className="font-bold text-white text-2xl sm:text-3xl md:text-[42px] leading-[30px] md:leading-[52px] cursor-pointer hover:underline decoration-white/60"
                    onMouseEnter={() => setShowAuthorPopover(true)}
                    onMouseLeave={() => setTimeout(() => setShowAuthorPopover(false), 100)}
                  >
                    {authorName}
                  </h1>
                </PopoverTrigger>
                <PopoverContent
                  className="w-72 rounded-2xl shadow-xl border border-gray-100 p-0 overflow-hidden bg-white"
                  align="start"
                  sideOffset={8}
                  onMouseEnter={() => setShowAuthorPopover(true)}
                  onMouseLeave={() => setShowAuthorPopover(false)}
                >
                  {(() => {
                    const socials = [
                      { url: author.facebook_url, icon: <Facebook className="w-4 h-4" />, label: 'Facebook' },
                      { url: author.linkedin_url, icon: <Linkedin className="w-4 h-4" />, label: 'LinkedIn' },
                      { url: author.instagram_url, icon: <Instagram className="w-4 h-4" />, label: 'Instagram' },
                      { url: author.tiktok_url, icon: (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/>
                        </svg>
                      ), label: 'TikTok' },
                    ].filter(s => s.url);
                    return (
                      <div>
                        <div className="flex items-center justify-between p-4 pb-2">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10 flex-shrink-0">
                              <AvatarImage src={authorProfileImage || undefined} alt={authorName} />
                              <AvatarFallback className="text-sm font-bold text-white" style={{ backgroundColor: authorProfileColor }}>
                                {authorName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-sm text-gray-900">{authorName}</p>
                              <p className="text-xs text-gray-500">{author.location || 'Location not set'}</p>
                            </div>
                          </div>
                          <button onClick={() => setShowAuthorPopover(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="border-t border-gray-100 mx-4" />
                        <div className="px-4 py-3 flex items-center justify-between">
                          <span className="text-sm text-gray-600">Total Campaigns</span>
                          <span className="text-sm font-semibold text-gray-900">{memories.length}</span>
                        </div>
                        <div className="px-4 pb-4 space-y-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Connect</p>
                          <button className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                            <Mail className="w-4 h-4" />
                            Send Email
                          </button>
                          {socials.length > 0 && (
                            <div className="flex items-center gap-2">
                              {socials.map((s) => (
                                <a key={s.label} href={s.url!} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center justify-center w-9 h-9 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                                  title={s.label}
                                >
                                  {s.icon}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </PopoverContent>
              </Popover>
            </div>
            {publishedAt && (
              <div className="flex items-center gap-1 text-white/90 text-xs sm:text-sm">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>{new Date(publishedAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Memories heading + share card */}
      <div className="bg-white shadow-sm border-t border-b border-gray-200">
        <div className="max-w-7xl mx-auto md:px-3 px-0">
          <div className="flex items-center justify-between gap-4 py-3 px-4 md:px-0 sm:py-4 border-b border-gray-100">
            {/* Memories heading */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <div className="hidden sm:flex w-8 h-8 sm:w-10 sm:h-10 bg-[#9333EA]/10 rounded-full items-center justify-center">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-[#9333EA]" />
              </div>
              <div>
                <h2 className="text-[21px] sm:text-lg font-semibold text-gray-900 leading-tight">
                  Campaigns
                </h2>
                <p className="text-xs sm:text-sm text-gray-500">
                  {memories.length} {memories.length === 1 ? "campaign" : "campaigns"} shared
                </p>
              </div>
            </div>

            {/* Share button */}
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>
          </div>
        </div>
      </div>

      {/* Memory cards */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {memories.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
            {memories.map((mem: any) => {
              const thumbnailUrl = mem.last_update_img || mem.wallpaper_image || null;
              const memSlug = mem.slug || mem.token || mem.id;
              return (
                <div key={mem.id} className="relative z-0">
                  <MemoryCard
                    image={thumbnailUrl}
                    title={mem.title}
                    dateRange={
                      mem.created_at
                        ? new Date(mem.created_at).toLocaleDateString()
                        : "Date not specified"
                    }
                    location={mem.location || ""}
                    category=""
                    categoryColor="#9333EA"
                    label=""
                    photosCount={mem.post_count || mem.photos?.count || 0}
                    imagesCount={mem.post_count || mem.photos?.count || 0}
                    avatar={authorProfileImage || mem.author?.avatar || undefined}
                    fullName={authorName || mem.author?.name}
                    profileColor={author.profile_color || mem.author?.profile_color}
                    tags={[]}
                    isEditMode={false}
                    isSelected={false}
                    categories={[]}
                    isSharedWith={false}
                    onClick={() => {
                      window.location.href = `/published-memory/${memSlug}`;
                    }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500 text-sm">No campaigns found</div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQRModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowQRModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 shadow-xl flex flex-col items-center gap-4 w-[280px]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900">Scan QR Code</h3>
            <QRCodeSVG value={shareUrl} size={200} />
            <p className="text-xs text-gray-500 text-center break-all">{shareUrl}</p>
            <button
              onClick={() => setShowQRModal(false)}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
