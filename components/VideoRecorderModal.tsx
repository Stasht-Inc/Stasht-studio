import { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { getApiBaseUrl } from '../utils/authUtils';

interface VideoRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoReady: (fileUrl: string, fileName: string) => void;
}

const MAX_SECONDS = 60;
const CIRCLE_RADIUS = 44;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

export function VideoRecorderModal({ isOpen, onClose, onVideoReady }: VideoRecorderModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(MAX_SECONDS);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const stopCamera = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    stopCamera();
    setIsRecording(false);
    setTimeLeft(MAX_SECONDS);
    setIsUploading(false);
    setUploadProgress(0);
    setCameraError(null);
    setCameraReady(false);
    onClose();
  }, [stopCamera, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraReady(true);
        setCameraError(null);
      } catch {
        setCameraError('Camera access denied. Please allow camera and microphone access.');
      }
    };

    startCamera();
    return () => stopCamera();
  }, [isOpen, stopCamera]);

  const uploadVideo = useCallback(async (blob: Blob, mimeType: string) => {
    setIsUploading(true);
    setUploadProgress(0);

    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const fileName = `intro_${Date.now()}.${ext}`;
    const formData = new FormData();
    formData.append('video', blob, fileName);

    let progress = 0;
    const progressTimer = setInterval(() => {
      progress = Math.min(90, progress + 1);
      setUploadProgress(progress);
    }, 1000);

    try {
      const token = localStorage.getItem('stasht_token');
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => {
          clearInterval(progressTimer);
          try {
            setUploadProgress(100);
            const data = JSON.parse(xhr.responseText);
            if (data?.fileUrl) onVideoReady(data.fileUrl, fileName);
            resolve();
          } catch { reject(new Error('Invalid response')); }
        };
        xhr.onerror = () => { clearInterval(progressTimer); reject(new Error('Upload failed')); };
        xhr.open('POST', `${getApiBaseUrl()}/memories/upload-video`);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });
      stopCamera();
      onClose();
    } catch (err) {
      console.error('Video upload failed:', err);
      clearInterval(progressTimer);
      setIsUploading(false);
    }
  }, [onVideoReady, stopCamera, onClose]);

  const stopRecording = useCallback(() => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

    const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      uploadVideo(blob, mimeType);
    };

    mediaRecorder.start(100);
    setIsRecording(true);
    setTimeLeft(MAX_SECONDS);

    // Countdown 1s per tick
    countdownRef.current = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    // Auto-stop at 60s
    autoStopRef.current = setTimeout(() => {
      stopRecording();
    }, MAX_SECONDS * 1000);
  }, [uploadVideo, stopRecording]);

  if (!isOpen) return null;

  const elapsed = MAX_SECONDS - timeLeft;
  const strokeOffset = CIRCLE_CIRCUMFERENCE - (elapsed / MAX_SECONDS) * CIRCLE_CIRCUMFERENCE;

  return (
    <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 100002 }}>
      {/* Camera preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Dark overlay at top and bottom */}
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
        <div className="h-24 bg-gradient-to-b from-black/60 to-transparent" />
        <div className="h-48 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-12 pb-4">
        <button
          onClick={handleClose}
          className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {isRecording && (
          <div className="flex items-center gap-2 bg-black/60 rounded-full px-4 py-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white font-mono font-bold text-base">
              {String(timeLeft).padStart(2, '0')}s
            </span>
          </div>
        )}

        {!isRecording && !isUploading && (
          <div className="bg-black/60 rounded-full px-4 py-1.5">
            <span className="text-white/70 text-sm">Max 60s</span>
          </div>
        )}
      </div>

      {/* Center — camera error or uploading */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 gap-4">
        {cameraError && (
          <p className="text-white text-center text-sm bg-black/60 rounded-xl px-4 py-3">{cameraError}</p>
        )}

        {isUploading && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-white text-lg font-semibold">Uploading... {uploadProgress}%</p>
            <div className="w-56 h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#6C60FF] rounded-full transition-all duration-700"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      {!isUploading && (
        <div className="relative z-10 flex flex-col items-center pb-16 gap-3">
          {!isRecording && cameraReady && (
            <p className="text-white/60 text-sm">Tap to start recording</p>
          )}

          {/* Record button with circular progress */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={!cameraReady || !!cameraError}
            className="relative flex items-center justify-center"
          >
            {/* SVG ring — shows elapsed time when recording */}
            <svg width="96" height="96" className="absolute" style={{ transform: 'rotate(-90deg)' }}>
              <circle
                cx="48" cy="48" r={CIRCLE_RADIUS}
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="4"
              />
              {isRecording && (
                <circle
                  cx="48" cy="48" r={CIRCLE_RADIUS}
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth="4"
                  strokeDasharray={CIRCLE_CIRCUMFERENCE}
                  strokeDashoffset={strokeOffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              )}
            </svg>

            {/* Button face */}
            <div className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-transparent">
              {isRecording ? (
                <div className="w-8 h-8 bg-red-500 rounded-md" />
              ) : (
                <div className="w-14 h-14 bg-red-500 rounded-full" />
              )}
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
