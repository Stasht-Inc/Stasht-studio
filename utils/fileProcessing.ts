// File processing utilities for upload optimization

export interface ProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp' | 'png';
}

export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'processing' | 'compressing' | 'complete' | 'error';
  error?: string;
}

// Compress and resize image files
export const compressImage = (
  file: File,
  options: ProcessingOptions = {}
): Promise<{ compressedFile: Blob; thumbnail: string }> => {
  return new Promise((resolve, reject) => {
    const {
      maxWidth = 1920,
      maxHeight = 1080,
      quality = 0.8,
      format = 'jpeg'
    } = options;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let { width, height } = img;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      
      // Create thumbnail (smaller version)
      const thumbnailCanvas = document.createElement('canvas');
      const thumbnailCtx = thumbnailCanvas.getContext('2d');
      const thumbnailSize = 300;
      
      const thumbnailWidth = width > height ? thumbnailSize : (width * thumbnailSize) / height;
      const thumbnailHeight = height > width ? thumbnailSize : (height * thumbnailSize) / width;
      
      thumbnailCanvas.width = thumbnailWidth;
      thumbnailCanvas.height = thumbnailHeight;
      thumbnailCtx?.drawImage(img, 0, 0, thumbnailWidth, thumbnailHeight);
      
      const thumbnailDataUrl = thumbnailCanvas.toDataURL(`image/${format}`, quality);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({
              compressedFile: blob,
              thumbnail: thumbnailDataUrl
            });
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        `image/${format}`,
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

// Process video files (extract thumbnail)
export const processVideo = (file: File): Promise<{ thumbnail: string }> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(5, video.duration / 2); // Seek to middle or 5 seconds
    };

    video.onseeked = () => {
      canvas.width = Math.min(video.videoWidth, 300);
      canvas.height = (canvas.width * video.videoHeight) / video.videoWidth;
      
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
      
      URL.revokeObjectURL(video.src);
      resolve({ thumbnail });
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to process video'));
    };

    video.src = URL.createObjectURL(file);
    video.load();
  });
};

// Format file size
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Generate unique file ID
export const generateFileId = (): string => {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Check if file type is supported
export const isSupportedFileType = (file: File): boolean => {
  const supportedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/mov',
    'video/avi',
    'video/webm'
  ];
  return supportedTypes.includes(file.type);
};

// Get file category based on type
export const getFileCategory = (file: File): 'image' | 'video' => {
  return file.type.startsWith('video/') ? 'video' : 'image';
};