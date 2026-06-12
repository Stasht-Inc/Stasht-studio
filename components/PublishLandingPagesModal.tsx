import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Link as LinkIcon, CheckCircle2, Copy, QrCode, Share2, Clock, Download } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { toast } from 'sonner';
import { QRCodeCanvas } from 'qrcode.react';

interface Property {
  id: number;
  name: string;
  location: string;
  image?: string;
}

interface PublishLandingPagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  onPublish: (selectedPropertyIds: number[]) => Promise<{ success: boolean; links?: any[] }>;
  onSuccess?: () => void;
  buttonRef?: React.RefObject<HTMLButtonElement>;
}

export default function PublishLandingPagesModal({
  isOpen,
  onClose,
  properties,
  onPublish,
  onSuccess,
  buttonRef
}: PublishLandingPagesModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProperties, setSelectedProperties] = useState<number[]>([]);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedLinks, setPublishedLinks] = useState<any[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrCanvas, setQrCanvas] = useState<HTMLCanvasElement | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Calculate position based on button
  useEffect(() => {
    if (isOpen && buttonRef?.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const modalWidth = 320; // Reduced from 384 to 320 (w-80 in Tailwind)
      const gap = 8;

      // Calculate right position to align with button
      let rightPos = window.innerWidth - buttonRect.right;

      // Ensure modal doesn't go off screen on the left
      if (buttonRect.right - modalWidth < 0) {
        rightPos = window.innerWidth - buttonRect.left - modalWidth;
      }

      setPosition({
        top: buttonRect.bottom + gap,
        right: Math.max(16, rightPos) // Minimum 16px from right edge
      });
    }
  }, [isOpen, buttonRef]);

  // Close modal when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        handleCancel();
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter properties based on search
  const filteredProperties = properties.filter(property =>
    property.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    property.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle individual property selection (multi-select)
  const handleSelectProperty = (propertyId: number) => {
    setSelectedProperties(prev =>
      prev.includes(propertyId) ? prev.filter(id => id !== propertyId) : [...prev, propertyId]
    );
  };

  // Handle publish
  const handlePublish = async () => {
    if (selectedProperties.length === 0) return;

    setIsPublishing(true);
    try {
      const result = await onPublish(selectedProperties);

      if (result.success && result.links) {
        setPublishedLinks(result.links);
        setShowSuccess(true);
        // Call onSuccess callback to refresh properties list
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error) {
      console.error('Error publishing:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setSelectedProperties([]);
    setSearchQuery('');
    setPublishedLinks([]);
    setShowSuccess(false);
    onClose();
  };

  // Handle copy URL
  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  };

  // Handle QR download
  const handleDownloadQr = () => {
    // fallback: find canvas in DOM if state ref not set
    const canvas = qrCanvas || (document.querySelector('[data-qr-canvas]') as HTMLCanvasElement | null);
    if (!canvas) {
      toast.error('Could not capture QR code');
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'qr-code.png';
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  // Handle share
  const handleShare = (url: string) => {
    if (navigator.share) {
      navigator.share({
        title: 'Property Landing Page',
        url: url
      }).catch(() => {
        handleCopyUrl(url);
      });
    } else {
      handleCopyUrl(url);
    }
  };

  return (
    <div className="fixed inset-0 z-50" style={{ background: 'transparent' }}>
      <div
        ref={modalRef}
        style={{
          position: 'fixed',
          top: `${position.top}px`,
          right: `${position.right}px`
        }}
        className="bg-white rounded-lg shadow-2xl border border-gray-200 w-[calc(100vw-2rem)] sm:w-80 max-h-[calc(100vh-8rem)] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Publish Landing Pages</h2>
            {!showSuccess && (
              <p className="text-xs text-gray-500 mt-0.5">Select properties to create sign-up landing pages</p>
            )}
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors ml-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content - Either selection view or success view */}
        {!showSuccess ? (
          <>
            {/* Search */}
            <div className="px-4 pt-3 pb-2 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search properties..."
                  className="w-full pl-10 bg-gray-50 border-gray-200 h-9 text-sm"
                />
              </div>
            </div>

            {/* Select All */}
            {filteredProperties.length > 0 && (
              <div className="px-4 pb-1 flex-shrink-0">
                <div
                  onClick={() => {
                    const allIds = filteredProperties.map(p => p.id);
                    const allSelected = allIds.every(id => selectedProperties.includes(id));
                    setSelectedProperties(allSelected ? [] : allIds);
                  }}
                  className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded-md transition-colors"
                >
                  <Checkbox
                    checked={filteredProperties.length > 0 && filteredProperties.every(p => selectedProperties.includes(p.id))}
                    className="flex-shrink-0 rounded border-gray-300 data-[state=unchecked]:border-gray-300 data-[state=unchecked]:bg-white data-[state=checked]:bg-[#6C60FF] data-[state=checked]:border-[#6C60FF] data-[state=checked]:text-white focus-visible:ring-0 focus-visible:ring-offset-0"
                    onClick={e => e.stopPropagation()}
                    onCheckedChange={() => {
                      const allIds = filteredProperties.map(p => p.id);
                      const allSelected = allIds.every(id => selectedProperties.includes(id));
                      setSelectedProperties(allSelected ? [] : allIds);
                    }}
                  />
                  <span className="text-sm font-medium text-gray-700">Select All</span>
                </div>
                <div className="border-t border-gray-100 mt-1" />
              </div>
            )}

            {/* Properties List - Scrollable */}
            <div className="overflow-y-auto flex-1 min-h-0">
              <div className="px-4 space-y-1 py-3">
                {filteredProperties.length > 0 ? (
                  filteredProperties.map((property) => (
                    <div
                      key={property.id}
                      onClick={() => handleSelectProperty(property.id)}
                      className={`flex items-center gap-2.5 cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors border-2 ${
                        selectedProperties.includes(property.id)
                          ? 'border-[#6C60FF] bg-purple-50'
                          : 'border-transparent'
                      }`}
                    >
                      <Checkbox
                        checked={selectedProperties.includes(property.id)}
                        onCheckedChange={() => handleSelectProperty(property.id)}
                        className="flex-shrink-0 rounded border-gray-300 data-[state=unchecked]:border-gray-300 data-[state=unchecked]:bg-white data-[state=checked]:bg-[#6C60FF] data-[state=checked]:border-[#6C60FF] data-[state=checked]:text-white focus-visible:ring-0 focus-visible:ring-offset-0"
                        onClick={e => e.stopPropagation()}
                      />
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="h-10 w-10 flex-shrink-0 rounded-md overflow-hidden bg-gray-100">
                          {property.image ? (
                            <img
                              src={property.image}
                              alt={property.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-purple-100 flex items-center justify-center">
                              <span className="text-purple-600 font-semibold text-xs">
                                {property.name.charAt(0)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {property.name}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {property.location}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-500 text-sm">
                    No properties found
                  </div>
                )}
              </div>
            </div>

            {/* Footer - Sticky */}
            <div className="sticky bottom-0 flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white flex-shrink-0">
              <span className="text-xs text-gray-600">
                {selectedProperties.length > 0 ? `${selectedProperties.length} selected` : 'No property selected'}
              </span>
              <Button
                onClick={handlePublish}
                disabled={selectedProperties.length === 0 || isPublishing}
                className="px-5 py-1.5 text-sm bg-[#6C60FF] hover:bg-[#5A4FE5] text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPublishing ? 'Publishing...' : 'Publish'}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Success View */}
            <div className="p-4 space-y-4 flex-1 overflow-y-auto">
              {/* Success Message */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-green-900">
                      {publishedLinks.length} {publishedLinks.length === 1 ? 'property' : 'properties'} published
                    </h3>
                    <p className="text-xs text-green-700 mt-0.5">Landing pages are now live</p>
                  </div>
                </div>
              </div>

              {/* Published Link - show only one */}
              {publishedLinks.length > 0 && (() => {
                const linkData = publishedLinks[0];
                console.log('Rendering link data:', linkData);
                return (
                  <div className="space-y-3">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <LinkIcon className="w-4 h-4 text-green-600" />
                        <span className="text-xs font-medium text-green-900">Landing Page URL</span>
                      </div>
                      <div className="bg-white border border-green-200 rounded-md px-3 py-2 mb-3">
                        <input
                          type="text"
                          value={linkData.link || 'No link generated'}
                          readOnly
                          className="w-full text-xs text-gray-700 bg-transparent border-none outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleCopyUrl(linkData.link)}
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs border-green-600 text-green-700 hover:bg-green-50"
                          disabled={!linkData.link}
                        >
                          <Copy className="w-3 h-3 mr-1.5" />
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs border-green-600 text-green-700 hover:bg-green-50"
                          disabled={!linkData.link}
                          onClick={() => setQrUrl(linkData.link)}
                        >
                          <QrCode className="w-3 h-3 mr-1.5" />
                          QR
                        </Button>
                        <Button
                          onClick={() => handleShare(linkData.link)}
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs border-green-600 text-green-700 hover:bg-green-50"
                          disabled={!linkData.link}
                        >
                          <Share2 className="w-3 h-3 mr-1.5" />
                          Share
                        </Button>
                      </div>
                    </div>

                    {/* Expiry Warning - Always show */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <Clock className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-yellow-700">
                          This link will be active for <span className="font-semibold">24 hours</span> from the time of publishing
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Close Button */}
            <div className="px-4 py-3 border-t border-gray-200 flex-shrink-0">
              <Button
                onClick={handleCancel}
                variant="outline"
                className="w-full"
              >
                Close
              </Button>
            </div>
          </>
        )}
      </div>

      {/* QR Code Modal */}
      {qrUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
          onClick={() => setQrUrl(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 flex flex-col items-center gap-4 w-72"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full">
              <h3 className="text-sm font-semibold text-gray-900">QR Code</h3>
              <button onClick={() => setQrUrl(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 border border-gray-200 rounded-lg">
              <QRCodeCanvas value={qrUrl} size={200} ref={(el) => setQrCanvas(el)} data-qr-canvas="true" />
            </div>
            <p className="text-xs text-gray-500 text-center break-all">{qrUrl}</p>
            <Button
              onClick={handleDownloadQr}
              className="w-full h-9 text-sm bg-[#6C60FF] hover:bg-[#5A4FE5] text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Download QR
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
