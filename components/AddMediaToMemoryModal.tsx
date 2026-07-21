import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon, CheckCircle2 } from 'lucide-react';

interface Memory {
  id: string;
  title: string;
  category: string;
  images: MediaImage[];
}

interface MediaImage {
  id: string;
  url: string;
  thumbnail?: string;
  title?: string;
}

interface AddMediaToMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryName: string;
  memories: Memory[];
  onUpload: (files: File[], selectedMemoryId: string, parentImageId?: string) => Promise<void>;
}

export default function AddMediaToMemoryModal({
  isOpen,
  onClose,
  categoryName,
  memories,
  onUpload
}: AddMediaToMemoryModalProps) {
  const [selectedMemoryId, setSelectedMemoryId] = useState<string>(memories[0]?.id || '');
  const [selectedParentImageId, setSelectedParentImageId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleMemorySelect = (memoryId: string) => {
    setSelectedMemoryId(memoryId);
    setSelectedParentImageId(null);
  };

  const handleImageSelect = (imageId: string) => {
    setSelectedParentImageId(prev => prev === imageId ? null : imageId);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !selectedMemoryId) return;

    setIsUploading(true);
    try {
      await onUpload(selectedFiles, selectedMemoryId, selectedParentImageId || undefined);
      setSelectedFiles([]);
      setSelectedParentImageId(null);
      onClose();
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const selectedMemory = memories.find(m => m.id === selectedMemoryId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pt-20 bg-black/70 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[calc(100vh-120px)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#6C60FF]">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">Add to {categoryName}</h3>
            <p className="text-[11px] text-white/90 mt-0.5">Upload & select campaign</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/90 hover:text-white transition-colors ml-3 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {/* Upload Section */}
          <div>
            <div className="text-xs font-medium text-gray-700 mb-2">Upload Files</div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#6C60FF] hover:bg-purple-50/30 transition-all">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,video/*"
              />
              <Upload className="w-8 h-8 text-[#6C60FF] mx-auto mb-1.5" />
              <p className="text-xs text-gray-600 mb-2">Drop files or click to browse</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-[#6C60FF] text-white rounded text-xs font-medium hover:bg-[#5a4fd8] transition-colors"
              >
                Choose Files
              </button>
            </div>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-1.5 bg-gray-50 rounded text-xs">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <ImageIcon className="w-3 h-3 text-[#6C60FF] flex-shrink-0" />
                      <span className="text-gray-700 truncate">{file.name}</span>
                    </div>
                    <button onClick={() => removeFile(index)} className="text-gray-400 hover:text-red-600 ml-2">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Memory Selection */}
          <div>
            <div className="text-xs font-medium text-gray-700 mb-2">Select Campaign</div>
            <div className="space-y-1.5">
              {memories.map((memory) => (
                <div key={memory.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div
                    onClick={() => handleMemorySelect(memory.id)}
                    className={`flex items-center gap-2 p-2 cursor-pointer transition-colors ${
                      selectedMemoryId === memory.id ? 'bg-purple-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        selectedMemoryId === memory.id ? 'border-[#6C60FF] bg-[#6C60FF]' : 'border-gray-300'
                      }`}
                    >
                      {selectedMemoryId === memory.id && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900 truncate">{memory.title}</div>
                      <div className="text-[10px] text-gray-500">{memory.images.length} images</div>
                    </div>
                    {selectedMemoryId === memory.id && <CheckCircle2 className="w-4 h-4 text-[#6C60FF]" />}
                  </div>

                  {/* Images Grid */}
                  {selectedMemoryId === memory.id && memory.images.length > 0 && (
                    <div className="p-2 bg-gray-50 border-t border-gray-200">
                      <p className="text-[10px] text-gray-600 mb-1.5">Click image to add as sub-image (optional)</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {memory.images.slice(0, 8).map((image) => (
                          <div
                            key={image.id}
                            onClick={() => handleImageSelect(image.id)}
                            className={`relative aspect-square rounded overflow-hidden cursor-pointer ${
                              selectedParentImageId === image.id ? 'ring-2 ring-[#6C60FF]' : ''
                            }`}
                          >
                            <img src={image.thumbnail || image.url} alt="" className="w-full h-full object-cover" />
                            {selectedParentImageId === image.id && (
                              <div className="absolute inset-0 bg-[#6C60FF]/30 flex items-center justify-center">
                                <CheckCircle2 className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {memory.images.length > 8 && (
                        <p className="text-[10px] text-gray-500 mt-1">+{memory.images.length - 8} more</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || !selectedMemoryId || isUploading}
            className="px-4 py-1.5 text-xs font-medium text-white bg-[#6C60FF] rounded hover:bg-[#5B52FF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Upload className="w-3 h-3" />
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
