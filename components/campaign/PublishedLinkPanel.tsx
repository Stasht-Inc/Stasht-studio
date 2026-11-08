// The campaign's published link and its tools (the green "Published Campaign" box): share message, Live / Public /
// View Only / Private badges, the link + Copy, Share (Copy Link, Facebook, X, LinkedIn, Embed Code) and the QR code
// (+ Download). Moved out of pages/MemoryDetailsPage.tsx unchanged (Chris, 8 Nov 2026 (b), point 2) so the campaign
// page and the Storeel stepper's Publishing card show the same box. Renders nothing unless published with a link.
import { useEffect, useId, useRef, useState } from 'react';
import { Globe, Link, Copy, Facebook, QrCode, Download, Share2, Linkedin, Code } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { dashboardAPI } from '../../utils/authUtils';

// Per-campaign social share message (OG description on shared links).
export const DEFAULT_SHARE_MESSAGE = 'View this published storeel on stasht.';

export interface PublishedLinkPanelProps {
  /** The campaign (GET /memories/{id}): published, published_url, share_message, id, user. */
  apiMemoryData: any;
  /** Title / description / thumbnail used in the share texts. */
  uiMemory: { title?: string; description?: string; thumbnail?: string };
  isOwner: boolean;
  currentUserRole?: string | null;
  /** The page's own setter: a saved share message is written back onto the campaign. */
  setApiMemoryData: (update: (prev: any) => any) => void;
  /** Inside a card (the stepper): no outer margin. */
  inCard?: boolean;
}

export default function PublishedLinkPanel({ apiMemoryData, uiMemory, isOwner, currentUserRole, setApiMemoryData, inCard = false }: PublishedLinkPanelProps) {
  const [isSharePopoverOpen, setIsSharePopoverOpen] = useState(false);
  const [isQRPopoverOpen, setIsQRPopoverOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [isSavingShareMessage, setIsSavingShareMessage] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  // One QR per box (the page and the stepper can both show it): Download reads this box's own code.
  const qrContainerId = `qr-code-container-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    if (apiMemoryData) {
      setShareMessage(apiMemoryData.share_message || DEFAULT_SHARE_MESSAGE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiMemoryData?.id, apiMemoryData?.share_message]);

  // Close share menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setIsSharePopoverOpen(false);
      }
    };

    if (isSharePopoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSharePopoverOpen]);

  if (!((apiMemoryData?.published === 1 || apiMemoryData?.published === 2 || apiMemoryData?.published === 3) && apiMemoryData?.published_url)) return null;

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 shadow-sm" style={inCard ? undefined : { margin: '1rem 0' }}>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <Globe className="w-5 h-5 text-green-600" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          {/* Personalize the social share message (OG description on shared links) */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-green-800 mb-1">Share message</label>
            <div className="flex items-center gap-2">
              <Input
                value={shareMessage}
                onChange={(e) => setShareMessage(e.target.value)}
                disabled={!isOwner}
                maxLength={500}
                placeholder={DEFAULT_SHARE_MESSAGE}
                className="flex-1 text-sm bg-white border-green-200 text-gray-700 h-9"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!isOwner || isSavingShareMessage}
                onClick={async () => {
                  try {
                    setIsSavingShareMessage(true);
                    const res: any = await dashboardAPI.updateShareMessage(apiMemoryData.id, shareMessage.trim());
                    if (res?.success || res?.status === 1 || res?.data?.success) {
                      setApiMemoryData((prev: any) => prev ? { ...prev, share_message: shareMessage.trim() || null } : prev);
                      toast.success('Share message saved');
                    } else {
                      toast.error('Failed to save share message');
                    }
                  } catch {
                    toast.error('Failed to save share message');
                  } finally {
                    setIsSavingShareMessage(false);
                  }
                }}
                className="flex-shrink-0 h-9 px-3 bg-white hover:bg-green-50 border-green-200 text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingShareMessage ? 'Saving…' : 'Save'}
              </Button>
            </div>
            <p className="text-xs text-green-700/70 mt-1">Shown when someone shares this campaign link. Leave as-is for the default.</p>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-green-800">Published Campaign</h4>
            <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 text-xs">
              Live
            </Badge>
            {/* Privacy Badge */}
            {apiMemoryData?.published === 1 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                Public
              </Badge>
            )}
            {apiMemoryData?.published === 2 && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs">
                View Only
              </Badge>
            )}
            {apiMemoryData?.published === 3 && (
              <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200 text-xs">
                Private
              </Badge>
            )}
            {/* Shared with badge - only show for collaborators */}
            {(currentUserRole === 'contributor' || currentUserRole === 'viewer') && (
              <Badge variant="secondary" className="bg-red-500 text-white text-xs">
                Shared with
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={apiMemoryData.published_url}
              readOnly
              className="flex-1 text-sm bg-white border-green-200 text-gray-700 h-9"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(apiMemoryData.published_url);
                  toast.success("Link copied to clipboard");
                } catch (error) {
                  toast.error("Failed to copy link");
                }
              }}
              className="flex-shrink-0 h-9 px-3 bg-white hover:bg-green-50 border-green-200 text-green-700"
            >
              <Copy className="w-4 h-4 md:mr-1" />
              <span className="hidden md:inline">Copy</span>
            </Button>

            {/* Share Button with Dropdown Menu */}
            <div className="relative" ref={shareMenuRef}>
              <Button
                variant="outline"
                size="sm"
                disabled={!isOwner}
                className="flex-shrink-0 h-9 px-3 bg-white hover:bg-green-50 border-green-200 text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setIsSharePopoverOpen(!isSharePopoverOpen)}
              >
                <Share2 className="w-4 h-4 md:mr-1" />
                <span className="hidden md:inline">Share</span>
              </Button>

              {/* Share Menu Dropdown */}
              {isSharePopoverOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-2xl border border-gray-200 py-2 z-50">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(apiMemoryData.published_url).then(() => {
                        toast.success("Link copied to clipboard!");
                        setIsSharePopoverOpen(false);
                      }).catch(() => {
                        toast.error("Failed to copy link");
                      });
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <Link className="w-5 h-5 text-gray-700" />
                    <span className="text-gray-900 font-medium">Copy Link</span>
                  </button>

                  <button
                    onClick={() => {
                      // Validate required data before sharing
                      if (!apiMemoryData?.published_url) {
                        toast.error("Published URL not available. Please try again.");
                        console.error('Facebook share failed: No published URL');
                        return;
                      }

                      console.log('Sharing to Facebook:', {
                        url: apiMemoryData.published_url,
                        title: uiMemory.title,
                        description: uiMemory.description,
                        image: uiMemory.thumbnail
                      });

                      // Check if this is a localhost URL
                      const isLocalhost = apiMemoryData.published_url.includes('localhost') ||
                                        apiMemoryData.published_url.includes('127.0.0.1') ||
                                        apiMemoryData.published_url.includes('192.168.');

                      if (isLocalhost) {
                        // For localhost, copy to clipboard and show instructions
                        navigator.clipboard.writeText(apiMemoryData.published_url).then(() => {
                          toast.warning("Local development URL detected! Link copied to clipboard.", {
                            description: "Facebook can't preview localhost URLs. Please paste the link directly into Facebook, or deploy your app to test social sharing.",
                            duration: 6000
                          });
                          setIsSharePopoverOpen(false);
                        }).catch(() => {
                          toast.error("Unable to share localhost URL. Please deploy to production to test social sharing.");
                          setIsSharePopoverOpen(false);
                        });
                        return;
                      }

                      // For production URLs, use Facebook with pre-filled text
                      const authorName = apiMemoryData?.user?.name || 'Unknown';
                      const postText = `${uiMemory.title}\n\nShared by ${authorName}${uiMemory.description ? `\n\n${uiMemory.description.substring(0, 150)}` : ''}\n\n${apiMemoryData.published_url}`;

                      // Copy post text to clipboard for user to paste
                      navigator.clipboard.writeText(postText).then(() => {
                        // Show alert so user knows content is copied before Facebook opens
                        alert("Campaign details copied to clipboard!\n\nPress Ctrl+V (or Cmd+V) to paste in your Facebook post.");
                        // Open Facebook after user dismisses alert
                        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(apiMemoryData.published_url)}`, 'facebook-share-dialog', 'width=800,height=600');
                      }).catch(() => {
                        // Still open Facebook even if clipboard fails
                        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(apiMemoryData.published_url)}`, 'facebook-share-dialog', 'width=800,height=600');
                      });

                      setIsSharePopoverOpen(false);

                      // Show a helpful message
                      setTimeout(() => {
                        toast.info("Sharing to Facebook", {
                          description: "If the preview doesn't appear immediately, Facebook may still be fetching the page data. This can take a few moments for newly published pages.",
                          duration: 5000
                        });
                      }, 500);
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <Facebook className="w-5 h-5 text-gray-700" />
                    <span className="text-gray-900 font-medium">Share on Facebook</span>
                  </button>

                  <button
                    onClick={() => {
                      // Validate required data before sharing
                      if (!apiMemoryData?.published_url) {
                        toast.error("Published URL not available. Please try again.");
                        console.error('Twitter/X share failed: No published URL');
                        return;
                      }

                      const title = uiMemory.title || 'Check out this memory';
                      const authorName = apiMemoryData?.user?.name || 'Unknown';
                      const description = uiMemory.description ? `\n\n${uiMemory.description.substring(0, 100)}${uiMemory.description.length > 100 ? '...' : ''}` : '';

                      // Build post text with title, author, description
                      const postText = `${title}\n\nShared by ${authorName}${description}`;

                      console.log('Sharing to Twitter/X:', {
                        url: apiMemoryData.published_url,
                        title: title,
                        text: postText
                      });

                      // Check if this is a localhost URL
                      const isLocalhost = apiMemoryData.published_url.includes('localhost') ||
                                        apiMemoryData.published_url.includes('127.0.0.1') ||
                                        apiMemoryData.published_url.includes('192.168.');

                      if (isLocalhost) {
                        // For localhost, copy to clipboard and show instructions
                        navigator.clipboard.writeText(apiMemoryData.published_url).then(() => {
                          toast.warning("Local development URL detected! Link copied to clipboard.", {
                            description: "Twitter/X can't preview localhost URLs. Deploy your app to production to test social sharing.",
                            duration: 6000
                          });
                          setIsSharePopoverOpen(false);
                        }).catch(() => {
                          toast.error("Unable to share localhost URL.");
                          setIsSharePopoverOpen(false);
                        });
                        return;
                      }

                      // Twitter/X - pre-fill post with memory details and URL
                      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(postText)}&url=${encodeURIComponent(apiMemoryData.published_url)}`, 'twitter-share-dialog', 'width=800,height=600');
                      setIsSharePopoverOpen(false);

                      // Show helpful message for production URLs
                      setTimeout(() => {
                        toast.info("Sharing to X/Twitter", {
                          description: "Card preview may take a moment to appear as X fetches your page data.",
                          duration: 4000
                        });
                      }, 500);
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <span className="text-gray-900 font-medium">Share on X</span>
                  </button>

                  <button
                    onClick={() => {
                      // Validate required data before sharing
                      if (!apiMemoryData?.published_url) {
                        toast.error("Published URL not available. Please try again.");
                        console.error('LinkedIn share failed: No published URL');
                        return;
                      }

                      console.log('Sharing to LinkedIn:', {
                        url: apiMemoryData.published_url,
                        title: uiMemory.title,
                        description: uiMemory.description
                      });

                      // Check if this is a localhost URL
                      const isLocalhost = apiMemoryData.published_url.includes('localhost') ||
                                        apiMemoryData.published_url.includes('127.0.0.1') ||
                                        apiMemoryData.published_url.includes('192.168.');

                      if (isLocalhost) {
                        // For localhost, copy to clipboard and show instructions
                        navigator.clipboard.writeText(apiMemoryData.published_url).then(() => {
                          toast.warning("Local development URL detected! Link copied to clipboard.", {
                            description: "LinkedIn can't preview localhost URLs. Deploy your app to production to test social sharing.",
                            duration: 6000
                          });
                          setIsSharePopoverOpen(false);
                        }).catch(() => {
                          toast.error("Unable to share localhost URL.");
                          setIsSharePopoverOpen(false);
                        });
                        return;
                      }

                      // LinkedIn share - pre-fill post text with memory details in a professional format
                      const authorName = apiMemoryData?.user?.name || 'Unknown';

                      // Format the post text for LinkedIn with proper structure
                      let postText = `✨ ${uiMemory.title}\n\n`;

                      if (uiMemory.description) {
                        // Limit description to 200 characters for better readability
                        const description = uiMemory.description.length > 200
                          ? uiMemory.description.substring(0, 200) + '...'
                          : uiMemory.description;
                        postText += `${description}\n\n`;
                      }

                      postText += `👤 Shared by: ${authorName}\n\n`;
                      postText += `🔗 View the full memory:\n${apiMemoryData.published_url}`;

                      // Use LinkedIn feed share with text parameter
                      const linkedInUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(postText)}`;
                      window.open(linkedInUrl, 'linkedin-share-dialog', 'width=800,height=600');
                      setIsSharePopoverOpen(false);

                      // Show helpful message for production URLs
                      setTimeout(() => {
                        toast.info("Sharing to LinkedIn", {
                          description: "Preview may take a moment to load as LinkedIn fetches your page data.",
                          duration: 4000
                        });
                      }, 500);
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <Linkedin className="w-5 h-5 text-gray-700" />
                    <span className="text-gray-900 font-medium">Share on LinkedIn</span>
                  </button>

                  {/* Separator */}
                  <div className="border-t border-gray-200 my-1"></div>

                  <button
                    onClick={() => {
                      const embedCode = `<iframe src="${apiMemoryData.published_url}" width="600" height="800" frameborder="0"></iframe>`;
                      navigator.clipboard.writeText(embedCode).then(() => {
                        toast.success("Embed code copied to clipboard!");
                        setIsSharePopoverOpen(false);
                      }).catch(() => {
                        toast.error("Failed to copy embed code");
                      });
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <Code className="w-5 h-5 text-gray-700" />
                    <span className="text-gray-900 font-medium">Embed Code</span>
                  </button>
                </div>
              )}
            </div>

            {/* QR Code Button with Popover */}
            <Popover open={isQRPopoverOpen} onOpenChange={setIsQRPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 h-9 px-3 bg-white hover:bg-green-50 border-green-200 text-green-700"
                >
                  <QrCode className="w-4 h-4 md:mr-1" />
                  <span className="hidden md:inline">QR Code</span>
                </Button>
              </PopoverTrigger>
              {/* In the stepper (z 99999) the QR opens above it, like the stepper's own menus. */}
              <PopoverContent className="w-64 p-4 bg-white border border-gray-200 shadow-lg" style={inCard ? { zIndex: 100002 } : undefined} align="end">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-gray-900 text-center">Scan to View</h4>
                  <div className="flex justify-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="bg-white p-2 rounded-lg shadow-sm" id={qrContainerId}>
                      <QRCodeSVG
                        value={apiMemoryData.published_url}
                        size={140}
                        level="M"
                        includeMargin={true}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-center text-gray-500">
                    Scan with your phone to open the campaign
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const container = document.getElementById(qrContainerId);
                      const svg = container?.querySelector('svg');
                      if (svg) {
                        const svgData = new XMLSerializer().serializeToString(svg);
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        const img = new Image();

                        img.onload = () => {
                          canvas.width = svg.width.baseVal.value;
                          canvas.height = svg.height.baseVal.value;

                          if (ctx) {
                            // Fill white background
                            ctx.fillStyle = 'white';
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                            // Draw QR code
                            ctx.drawImage(img, 0, 0);

                            // Convert to PNG and download
                            canvas.toBlob((blob) => {
                              if (blob) {
                                const url = URL.createObjectURL(blob);
                                const downloadLink = document.createElement('a');
                                downloadLink.download = `memory-qr-code-${Date.now()}.png`;
                                downloadLink.href = url;
                                downloadLink.click();
                                URL.revokeObjectURL(url);
                                toast.success("QR Code downloaded");
                              }
                            }, 'image/png');
                          }
                        };

                        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                      } else {
                        toast.error("Failed to download QR Code");
                      }
                    }}
                    className="w-full flex items-center gap-2 justify-center h-8 bg-white hover:bg-gray-50"
                  >
                    <Download className="w-4 h-4" />
                    Download QR Code
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </div>
  );
}
