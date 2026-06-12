import { useState, useRef, useEffect } from 'react';
import { X, RotateCw, Zap, ZapOff, Image as ImageIcon } from 'lucide-react';

interface CameraInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (files: File[]) => void;
}

type CameraMode = 'SLO-MO' | 'VIDEO' | 'PHOTO' | 'PORTRAIT' | 'PANO';

export function CameraInterface({ isOpen, onClose, onCapture }: CameraInterfaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [selectedMode, setSelectedMode] = useState<CameraMode>('PHOTO');
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [lastCapturedImage, setLastCapturedImage] = useState<string | null>(null);

  // Initialize camera when component opens
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    try {
      // Stop any existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Could not access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleFlipCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleToggleFlash = () => {
    setFlashEnabled(prev => !prev);

    // Try to enable/disable flash if supported
    if (stream) {
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any;

      if (capabilities.torch) {
        track.applyConstraints({
          advanced: [{ torch: !flashEnabled } as any]
        }).catch(err => console.log('Flash not supported:', err));
      }
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
      if (!blob) return;

      // Create file from blob
      const timestamp = Date.now();
      const file = new File([blob], `camera-photo-${timestamp}.jpg`, { type: 'image/jpeg' });

      // Create preview URL
      const imageUrl = URL.createObjectURL(blob);
      setLastCapturedImage(imageUrl);
      setCapturedImages(prev => [imageUrl, ...prev]);

      // Call the onCapture callback with the file
      onCapture([file]);
    }, 'image/jpeg', 0.95);
  };

  const handleOpenGallery = () => {
    // Create file input to select from gallery
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.style.display = 'none';

    // Append to DOM (required for mobile browsers to work on first click)
    document.body.appendChild(input);

    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        onCapture(files);
      }
      // Clean up - remove from DOM
      document.body.removeChild(input);
    };

    // Also clean up if user cancels
    input.addEventListener('cancel', () => {
      document.body.removeChild(input);
    });

    input.click();
  };

  const handleModeChange = (mode: CameraMode) => {
    setSelectedMode(mode);
    // Note: Different modes would require different implementation
    // For now, we're only implementing PHOTO mode
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] bg-black">
      {/* Video Preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Hidden canvas for capturing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Controls */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Close camera"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        {/* Flip Camera Button */}
        <button
          onClick={handleFlipCamera}
          className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Flip camera"
        >
          <RotateCw className="w-5 h-5 text-white" />
        </button>

        {/* Flash Toggle */}
        <button
          onClick={handleToggleFlash}
          className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
          aria-label={flashEnabled ? "Disable flash" : "Enable flash"}
        >
          {flashEnabled ? (
            <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />
          ) : (
            <ZapOff className="w-5 h-5 text-white" />
          )}
        </button>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 pb-safe">
        {/* Mode Selection */}
        <div className="flex items-center justify-center gap-4 mb-6 px-4">
          {(['SLO-MO', 'VIDEO', 'PHOTO', 'PORTRAIT', 'PANO'] as CameraMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              className={`px-3 py-1.5 text-sm font-medium transition-all ${
                selectedMode === mode
                  ? 'text-yellow-400 scale-110'
                  : 'text-white/60'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Capture Controls */}
        <div className="flex items-center justify-between px-8 pb-8">
          {/* Gallery Thumbnail */}
          <button
            onClick={handleOpenGallery}
            className="w-12 h-12 rounded-lg border-2 border-white/80 overflow-hidden active:scale-95 transition-transform bg-white/10 backdrop-blur-sm"
            aria-label="Open gallery"
          >
            {lastCapturedImage ? (
              <img
                src={lastCapturedImage}
                alt="Last captured"
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageIcon className="w-6 h-6 text-white/60 mx-auto my-auto" />
            )}
          </button>

          {/* Capture Button */}
          <button
            onClick={handleCapture}
            className="w-20 h-20 rounded-full border-4 border-white bg-white/20 backdrop-blur-sm active:scale-95 transition-transform flex items-center justify-center"
            aria-label="Capture photo"
          >
            <div className="w-16 h-16 rounded-full bg-white" />
          </button>

          {/* Rotate/Switch Camera */}
          <button
            onClick={handleFlipCamera}
            className="w-12 h-12 rounded-full border-2 border-white/80 bg-black/30 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Switch camera"
          >
            <RotateCw className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
