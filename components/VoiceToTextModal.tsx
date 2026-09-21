import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Mic, AlertTriangle, Pencil, Sparkles, RotateCcw, Layers, Check, MicOff } from 'lucide-react';
import { toast } from 'sonner';
import mediaAPI from '../services/mediaAPI';

const detectBrowser = () => {
  const ua = navigator.userAgent;
  if (ua.includes('Edg/') || ua.includes('EdgiOS')) return 'edge';
  if (ua.includes('CriOS')) return 'chrome'; // Chrome on iOS
  if (ua.includes('Chrome')) return 'chrome';
  if (ua.includes('FxiOS') || ua.includes('Firefox')) return 'firefox'; // Firefox on iOS
  if (ua.includes('Safari')) return 'safari';
  return 'other';
};

const MIC_INSTRUCTIONS: Record<string, { title: string; steps: string[] }> = {
  chrome: {
    title: 'Enable Microphone in Chrome',
    steps: [
      'Open your iPhone Settings',
      'Scroll down and tap "Chrome"',
      'Enable "Microphone"',
      'Come back to the app and tap "Try Again"',
    ],
  },
  edge: {
    title: 'Enable Microphone in Edge',
    steps: [
      'Tap the three-dot menu at the bottom of Edge',
      'Tap "Settings" → "Site permissions"',
      'Find "Microphone" and set this site to "Allow"',
      'Come back and tap "Try Again"',
    ],
  },
  firefox: {
    title: 'Enable Microphone in Firefox',
    steps: [
      'Open iPhone Settings',
      'Scroll down and tap "Firefox"',
      'Enable "Microphone"',
      'Come back and tap "Try Again"',
    ],
  },
  safari: {
    title: 'Enable Microphone in Safari',
    steps: [
      'Tap the page icon (📄) on the bottom left of the address bar',
      'A menu will open — tap "..."',
      'Find "Microphone" and set it to "Allow"',
      'Come back and tap "Try Again"',
    ],
  },
  other: {
    title: 'Enable Microphone',
    steps: [
      'Open your iPhone Settings',
      'Find your browser app and tap it',
      'Enable "Microphone"',
      'Come back and tap "Try Again"',
    ],
  },
};

interface VoiceToTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  memoryId: string;
  afterPostId?: string | null;
  userProfileImage?: string;
  onMomentsCreated?: (firstPostId?: string) => void;
}

type ModalState = 'initial' | 'recording' | 'review' | 'processing';

const KEYWORD_REGEX = /stasht|stashed/i;
const ADD_PHOTO_REGEX = /\b(?:add|and|at|had)\s+(?:a\s+)?photos?\b/i;
const PHOTO_SLOT_MARKER = '§PHOTO§';
const SAMPLE_RATE = 16000;
const SEGMENT_SEPARATOR = '\n\n--- New Moment Added ---\n\n';
const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024);

// Convert Float32 PCM to Int16 for Deepgram
const float32ToInt16 = (buffer: Float32Array): ArrayBuffer => {
  const int16 = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16.buffer;
};

export const VoiceToTextModal: React.FC<VoiceToTextModalProps> = ({
  isOpen,
  onClose,
  memoryId,
  afterPostId,
  userProfileImage,
  onMomentsCreated,
}) => {
  const [modalState, setModalState] = useState<ModalState>('initial');
  const [segments, setSegments] = useState<string[]>(['']);
  const [interimText, setInterimText] = useState('');
  const [processingStatus, setProcessingStatus] = useState('');
  const [showMicBlockedPopup, setShowMicBlockedPopup] = useState(false);
  const [segmentPhotoStates, setSegmentPhotoStates] = useState<Record<number, 'pending' | string>>({});
  const photoUrlsRef = useRef<string[]>([]);

  // Review state
  const [reviewText, setReviewText] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const segmentsRef = useRef<string[]>(['']);
  const streamRef = useRef<MediaStream | null>(null);
  const keywordDetectedRef = useRef(false);
  const addPhotoTriggeredRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const segmentPhotosRef = useRef<Record<number, File>>({});
  const pendingPhotoSegmentIdxRef = useRef<number>(-1);

  useEffect(() => {
    if (!isOpen) {
      stopAll();
      setModalState('initial');
      setSegments(['']);
      setInterimText('');
      setProcessingStatus('');
      setReviewText('');
      setIsEditing(false);
      segmentsRef.current = [''];
      segmentPhotosRef.current = {};
      pendingPhotoSegmentIdxRef.current = -1;
      addPhotoTriggeredRef.current = false;
      photoUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
      photoUrlsRef.current = [];
      setSegmentPhotoStates({});
    }
  }, [isOpen]);

  // Auto-focus textarea when edit mode is turned on
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const stopAll = () => {
    try { processorRef.current?.disconnect(); } catch (_) {}
    try { audioContextRef.current?.close(); } catch (_) {}
    try {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
    } catch (_) {}
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch (_) {}
  };

  const updateSegments = (newSegments: string[]) => {
    segmentsRef.current = newSegments;
    setSegments([...newSegments]);
  };

  const removePhoto = (idx: number) => {
    const url = segmentPhotoStates[idx];
    if (typeof url === 'string') {
      URL.revokeObjectURL(url);
      photoUrlsRef.current = photoUrlsRef.current.filter(u => u !== url);
    }
    setSegmentPhotoStates(prev => { const n = { ...prev }; delete n[idx]; return n; });
    delete segmentPhotosRef.current[idx];
  };

  const handlePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const idx = pendingPhotoSegmentIdxRef.current;
    if (idx >= 0) {
      segmentPhotosRef.current = { ...segmentPhotosRef.current, [idx]: file };
      const url = URL.createObjectURL(file);
      photoUrlsRef.current.push(url);
      setSegmentPhotoStates(prev => ({ ...prev, [idx]: url }));
    }
    e.target.value = '';
    toast.success('Photo added to moment!');
  };

  const handleTranscript = (text: string, isFinal: boolean) => {
    if (!text.trim()) return;

    const keywordMatch = text.match(KEYWORD_REGEX);

    if (keywordMatch) {
      if (!keywordDetectedRef.current) {
        keywordDetectedRef.current = true;

        const keywordStart = keywordMatch.index!;
        const keywordEnd = keywordStart + keywordMatch[0].length;
        const beforeKeyword = text.substring(0, keywordStart).trim();
        const afterKeyword = text.substring(keywordEnd).trim().replace(/^[.,!?;:\-–—]+\s*/, '');

        const current = [...segmentsRef.current];
        if (beforeKeyword) {
          current[current.length - 1] = (
            current[current.length - 1] + ' ' + beforeKeyword
          ).trim();
        }
        current.push(afterKeyword);
        updateSegments(current);
        setInterimText('');
      }
      if (isFinal) {
        keywordDetectedRef.current = false;
      }
    } else if (isFinal) {
      keywordDetectedRef.current = false;
      const current = [...segmentsRef.current];
      current[current.length - 1] = (
        current[current.length - 1] + ' ' + text
      ).trim();
      updateSegments(current);
      setInterimText('');
    } else {
      setInterimText(text);
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Microphone is not supported. Please use HTTPS or a supported browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY?.trim();
      if (!apiKey) {
        toast.error('Deepgram API key not configured.');
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      const params = new URLSearchParams({
        model: 'nova-2',
        language: 'en',
        smart_format: 'true',
        interim_results: 'true',
        punctuate: 'true',
        encoding: 'linear16',
        sample_rate: String(SAMPLE_RATE),
        channels: '1',
      });

      const socket = new WebSocket(
        `wss://api.deepgram.com/v1/listen?${params.toString()}`,
        ['token', apiKey]
      );
      socketRef.current = socket;

      socket.onopen = () => {
        const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (socket.readyState === WebSocket.OPEN) {
            const pcm = float32ToInt16(e.inputBuffer.getChannelData(0));
            socket.send(pcm);
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const transcript = data?.channel?.alternatives?.[0]?.transcript || '';
          const isFinal = data?.is_final ?? false;
          if (transcript) {
            handleTranscript(transcript, isFinal);
          }
        } catch (_) {}
      };

      socket.onerror = () => {
        toast.error('Live transcription error. Please try again.');
      };

      segmentsRef.current = [''];
      keywordDetectedRef.current = false;
      setSegments(['']);
      setInterimText('');
      setModalState('recording');

    } catch (err: any) {
      console.error('🎤 startRecording error:', err?.name, err?.message, err);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setShowMicBlockedPopup(true);
      } else {
        toast.error(`Could not start recording: ${err?.message || err?.name || 'Unknown error'}`);
      }
    }
  };

  // Stop audio and go straight to review with live Deepgram transcript
  const stopRecording = () => {
    try { processorRef.current?.disconnect(); } catch (_) {}
    try { audioContextRef.current?.close(); } catch (_) {}
    try {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
    } catch (_) {}
    streamRef.current?.getTracks().forEach(t => t.stop());

    const liveSegments = segmentsRef.current.map(s => s.replace(PHOTO_SLOT_MARKER, '').trim()).filter(Boolean);

    if (liveSegments.length === 0) {
      toast.error('No speech detected. Please try again.');
      segmentsRef.current = [''];
      setSegments(['']);
      setModalState('initial');
      return;
    }

    setReviewText(liveSegments.join(SEGMENT_SEPARATOR));
    setIsEditing(false);
    setModalState('review');
  };

  // Take the (possibly edited) review text and create moments
  const analyzeAndCreate = async () => {
    const rawSegments = reviewText
      .split(/---\s*New Moment Added\s*---/i)
      .map(s => s.trim())
      .filter(Boolean);

    if (rawSegments.length === 0) {
      toast.error('No content to analyze. Please check your transcript.');
      return;
    }

    setProcessingStatus('');
    setModalState('processing');

    let placeholderFile: File | null = null;

    let created = 0;
    let firstPostId: string | undefined;

    for (let i = 0; i < rawSegments.length; i++) {
      const segmentText = rawSegments[i].replace(PHOTO_SLOT_MARKER, '').trim();
      setProcessingStatus(`Creating moment ${i + 1} of ${rawSegments.length}...`);

      // Use photo from voice command if captured, otherwise fall back to placeholder
      let segmentFile: File | null = segmentPhotosRef.current[i] || null;
      if (!segmentFile) {
        if (!placeholderFile) {
          try {
            const imgResponse = await fetch('/no-image-placeholder.svg');
            const blob = await imgResponse.blob();
            placeholderFile = new File([blob], 'no-image-placeholder.svg', { type: 'image/svg+xml' });
          } catch {
            console.warn('Could not fetch placeholder image');
          }
        }
        segmentFile = placeholderFile;
      }

      try {
        const result = await mediaAPI.addMoment({
          memoryId,
          files: segmentFile ? [segmentFile] : [],
          imageDetails: {
            0: {
              description: segmentText,
              title: '',
              date: new Date().toISOString().split('T')[0],
              location: '',
            },
          },
          afterPostId: afterPostId || undefined,
        });

        if (result?.success) {
          created++;
          if (!firstPostId) {
            const d = result?.data;
            firstPostId = (
              d?.images?.[0]?.id?.toString() ||
              d?.image?.id?.toString() ||
              d?.id?.toString() ||
              d?.[0]?.id?.toString()
            );
          }
        } else {
          console.error(`Moment ${i + 1} failed:`, result?.error);
        }
      } catch (err) {
        console.error(`Failed to create moment ${i + 1}:`, err);
      }
    }

    if (created > 0) {
      toast.success(`${created} moment${created > 1 ? 's' : ''} created successfully!`);
      onMomentsCreated?.(firstPostId);
      onClose();
    } else {
      toast.error('Failed to create moments. Please try again.');
      setModalState('review');
    }
  };

  const displayTranscript = segments
    .map((seg, i) => {
      if (i === segments.length - 1) {
        const suffix = interimText ? (seg ? ' ' : '') + interimText : '';
        return seg + suffix;
      }
      return seg;
    })
    .join('\n\n── New Moment Added ──\n\n');

  if (!isOpen) return null;


  return createPortal(
    <>
      {/* File input for "add photo" — positioned off-screen (not display:none) so iOS/Android native picker triggers correctly */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoSelected}
        style={{ position: 'fixed', bottom: 0, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none', zIndex: -1 }}
      />

      {/* ── INITIAL STATE ── */}
      {modalState === 'initial' && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md mx-auto shadow-2xl overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
              <h2 className="text-[18px] font-semibold text-gray-900">Add Voice to Text Memo</h2>
              <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 pb-6 space-y-4">
              <div className="border border-[#B0BAFF] bg-[#EEF0FF] rounded-xl p-4 mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-[#5B6CF5] flex-shrink-0" />
                  <span className="text-[15px] font-semibold text-[#5B6CF5]">Reminder:</span>
                </div>
                <ul className="space-y-1 pl-1">
                  {[
                    <span key={0}>Say <strong>"stasht"</strong> during recording</span>,
                    'System detects keyword',
                    'Splits audio at that point',
                    'Creates new voice memo (new moment)',
                    'Continues recording seamlessly',
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-[15px] text-[#5B6CF5]">
                      <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-[#5B6CF5] flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-sm font-medium text-gray-700 pt-1">Voice Recording</p>
              <button
                onClick={startRecording}
                className="w-full h-12 rounded-xl bg-[#6C60FF] text-white text-[16px] font-semibold flex items-center justify-center gap-2 hover:bg-[#5B52FF] active:scale-[0.98] transition-all"
              >
                <Mic className="w-4 h-4" />
                Start Recording
              </button>
              <button
                onClick={onClose}
                className="w-full h-12 rounded-xl border border-gray-200 text-gray-700 text-[16px] font-medium hover:bg-gray-50 active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RECORDING STATE ── */}
      {modalState === 'recording' && (
        <>
          {/* Mobile: full screen */}
          <div className="fixed inset-0 z-[9999] bg-white flex flex-col sm:hidden">
            <div className="flex items-center justify-between px-6 pt-10 pb-4 bg-white flex-shrink-0 border-b border-gray-200">
              <h2 className="text-[18px] font-semibold text-gray-900">Add Voice to Text Memo</h2>
              <button onClick={() => { stopAll(); onClose(); }} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="bg-gray-100 mx-4 mt-4 rounded-2xl overflow-y-auto p-4 mb-4 border border-gray-300" style={{ minHeight: 520, maxHeight: 520 }}>
              {/* Transcript text + photo button inline with last segment */}
              {segments.every(s => !s.trim()) && !interimText.trim() ? (
                <>
                  {/* Button at top when nothing spoken yet */}
                  <button
                    onClick={() => {
                      pendingPhotoSegmentIdxRef.current = 0;
                      setSegmentPhotoStates(prev => ({ ...prev, [0]: 'pending' }));
                      photoInputRef.current?.click();
                    }}
                    disabled={segmentPhotoStates[0] === 'pending'}
                    className="w-full h-10 rounded-xl text-white text-sm font-semibold flex items-center justify-center active:scale-[0.98] transition-all mb-3 disabled:opacity-60"
                    style={{ backgroundColor: '#f6339a' }}
                  >
                    {segmentPhotoStates[0] === 'pending' ? 'Adding photo...' : 'Tap to add photo'}
                  </button>
                  <p className="text-[16px] text-gray-400 italic">Start Talking</p>
                </>
              ) : (
                <div>
                  {segments.map((seg, segIdx) => {
                    const isLast = segIdx === segments.length - 1;
                    const displaySeg = isLast
                      ? seg + (interimText ? (seg ? ' ' : '') + interimText : '')
                      : seg;
                    const photoState = segmentPhotoStates[segIdx];
                    return (
                      <React.Fragment key={segIdx}>
                        {segIdx > 0 && (
                          <p className="text-center text-gray-900 text-base my-3">── New Moment Added ──</p>
                        )}

                        {/* Show thumbnail for ANY segment that has a photo */}
                        {typeof photoState === 'string' && (
                          <div className="mb-2">
                            <img src={photoState} alt="Added photo" className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
                          </div>
                        )}

                        {/* Show button only for last segment when no photo yet */}
                        {isLast && typeof photoState !== 'string' && (
                          <button
                            onClick={() => {
                              pendingPhotoSegmentIdxRef.current = segIdx;
                              setSegmentPhotoStates(prev => ({ ...prev, [segIdx]: 'pending' }));
                              photoInputRef.current?.click();
                            }}
                            disabled={photoState === 'pending'}
                            className="w-full h-10 rounded-xl text-white text-sm font-semibold flex items-center justify-center active:scale-[0.98] transition-all mb-2 disabled:opacity-60"
                            style={{ backgroundColor: '#f6339a' }}
                          >
                            {photoState === 'pending' ? 'Adding photo...' : 'Tap to add photo'}
                          </button>
                        )}

                        <span className="text-[16px] text-gray-800 whitespace-pre-wrap leading-relaxed">
                          {displaySeg.replace(PHOTO_SLOT_MARKER, '').trim()}
                        </span>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-4 pb-10 flex-shrink-0">
              <button onClick={stopRecording} className="w-full h-12 rounded-xl bg-[#6C60FF] text-white text-[16px] font-semibold flex items-center justify-center gap-2 hover:bg-[#5B52FF] active:scale-[0.98] transition-all">
                <Mic className="w-4 h-4" />
                End Recording
              </button>
            </div>
          </div>

          {/* Desktop: centered card */}
          <div className="fixed inset-0 z-[9999] hidden sm:flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md mx-auto shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
                <h2 className="text-[18px] font-semibold text-gray-900">Add Voice to Text Memo</h2>
                <button onClick={() => { stopAll(); onClose(); }} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="px-6 pt-4 pb-6 space-y-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 overflow-y-auto" style={{ minHeight: 240, maxHeight: 380 }}>
                  {displayTranscript.trim() ? (
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{displayTranscript}</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Start Talking</p>
                  )}
                </div>
                <button onClick={stopRecording} className="w-full h-12 rounded-xl bg-[#6C60FF] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#5B52FF] active:scale-[0.98] transition-all">
                  <Mic className="w-4 h-4" />
                  End Recording
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── REVIEW STATE ── */}
      {modalState === 'review' && (
        <>
          {/* Mobile: full screen */}
          <div className="fixed inset-0 z-[9999] bg-white flex flex-col sm:hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-10 pb-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-[20px] font-semibold text-gray-900">Review Transcript</h2>
                <p className="text-[14px] text-gray-400 mt-0.5">Edit your script or go straight to analyzing</p>
              </div>
              <button
                onClick={() => { setModalState('initial'); setReviewText(''); setIsEditing(false); }}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Info strip */}
            <div className="flex items-center justify-center px-6 py-2.5 bg-[#F5F4FF] border-b border-[#E8E6FF] flex-shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#6C60FF]" />
                <span className="text-[14px] font-semibold text-[#6C60FF]">Moments split by "stasht"</span>
              </div>
            </div>

            {/* Transcript label + edit toggle */}
            <div className="flex items-center justify-between px-6 pt-4 pb-2 flex-shrink-0">
              <span className="text-[14px] font-semibold text-gray-500 uppercase tracking-wide">Transcript</span>
              <button
                onClick={() => setIsEditing(prev => !prev)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 border text-[14px] font-semibold transition-all
                  ${isEditing
                    ? 'bg-[#6C60FF] border-[#6C60FF] text-white'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-[#6C60FF] hover:text-[#6C60FF]'
                  }`}
              >
                {isEditing ? <><Check className="w-3.5 h-3.5" /> Done</> : <><Pencil className="w-3.5 h-3.5" /> Edit</>}
              </button>
            </div>

            {/* Transcript box */}
            <div className="flex-1 overflow-hidden px-6 pb-2 min-h-0">
              {isEditing ? (
                <div className="flex flex-col h-full gap-4 overflow-y-auto pb-2">
                  {reviewText.split(/---\s*New Moment Added\s*---/i).map((seg, i, arr) => (
                    <React.Fragment key={i}>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        {arr.length > 1 && (
                          <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wide">Moment {i + 1}</span>
                        )}
                        <textarea
                          ref={i === 0 ? textareaRef : undefined}
                          value={seg.trim()}
                          onChange={(e) => {
                            const parts = reviewText.split(/---\s*New Moment Added\s*---/i);
                            parts[i] = e.target.value;
                            setReviewText(parts.join('\n\n--- New Moment Added ---\n\n'));
                          }}
                          className="resize-none rounded-xl border p-4 text-[16px] leading-relaxed bg-white border-[#6C60FF] text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20"
                          rows={3}
                          spellCheck
                        />
                        {typeof segmentPhotoStates[i] === 'string' && (
                          <div className="relative w-20 h-20 flex-shrink-0">
                            <img src={segmentPhotoStates[i] as string} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                            <button
                              onClick={() => removePhoto(i)}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800 text-white rounded-full flex items-center justify-center"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      {i < arr.length - 1 && (
                        <p className="text-center text-gray-500 text-[14px] font-medium flex-shrink-0">── New Moment Added ──</p>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div className="w-full h-full overflow-y-auto rounded-xl border bg-gray-50 border-gray-200 p-4">
                  {reviewText.split(/---\s*New Moment Added\s*---/i).map((seg, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && (
                        <p className="text-center text-gray-900 text-base my-3">── New Moment Added ──</p>
                      )}
                      <div>
                        <p className="text-[16px] text-gray-700 leading-relaxed whitespace-pre-wrap">{seg.trim()}</p>
                        {typeof segmentPhotoStates[i] === 'string' && (
                          <div className="mt-2 mb-1">
                            <img
                              src={segmentPhotoStates[i] as string}
                              alt={`Moment ${i + 1} photo`}
                              className="w-28 h-28 object-cover rounded-lg border border-gray-200"
                            />
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>

            {/* Separator hint */}
            <div className="px-6 py-1 flex-shrink-0">
              <p className="text-[12px] text-gray-400 text-center">
                Moments are separated by <code className="bg-gray-100 px-1 rounded text-[12px]">--- New Moment Added ---</code>
              </p>
            </div>

            {/* Action buttons */}
            <div className="px-6 pb-10 pt-2 space-y-3 flex-shrink-0">
              <button
                onClick={analyzeAndCreate}
                disabled={!reviewText.trim() || isEditing}
                className="w-full h-12 rounded-xl bg-[#6C60FF] text-white text-[16px] font-semibold flex items-center justify-center gap-2 hover:bg-[#5B52FF] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Mic className="w-4 h-4" />
                Complete Process
              </button>
              <button
                onClick={() => { stopAll(); segmentsRef.current = ['']; setSegments(['']); setReviewText(''); setIsEditing(false); setModalState('initial'); }}
                className="w-full h-12 rounded-xl border border-gray-200 text-gray-600 text-[16px] font-medium flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-[0.98] transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Re-record
              </button>
            </div>
          </div>

          {/* Desktop: centered card */}
          <div className="fixed inset-0 z-[9999] hidden sm:flex items-center justify-center bg-black/50 p-4">
            <div
              className="bg-white rounded-2xl w-full max-w-md mx-auto shadow-2xl overflow-hidden flex flex-col"
              style={{ maxHeight: '88vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
                <div>
                  <h2 className="text-[18px] font-semibold text-gray-900">Review Transcript</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Edit your script or go straight to analyzing</p>
                </div>
                <button
                  onClick={() => { setModalState('initial'); setReviewText(''); setIsEditing(false); }}
                  className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Info strip */}
              <div className="flex items-center justify-center px-6 py-2.5 bg-[#F5F4FF] border-b border-[#E8E6FF] flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#6C60FF]" />
                  <span className="text-xs font-semibold text-[#6C60FF]">Moments split by "stasht"</span>
                </div>
              </div>

              {/* Transcript label + edit toggle */}
              <div className="flex items-center justify-between px-6 pt-4 pb-2 flex-shrink-0">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Transcript</span>
                <button
                  onClick={() => setIsEditing(prev => !prev)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 border text-[12px] font-semibold transition-all
                    ${isEditing
                      ? 'bg-[#6C60FF] border-[#6C60FF] text-white'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-[#6C60FF] hover:text-[#6C60FF]'
                    }`}
                >
                  {isEditing ? <><Check className="w-3.5 h-3.5" /> Done</> : <><Pencil className="w-3.5 h-3.5" /> Edit</>}
                </button>
              </div>

              {/* Transcript box */}
              <div className="flex-1 overflow-hidden px-6 pb-2 min-h-0">
                {isEditing ? (
                  <div className="flex flex-col h-full gap-4 overflow-y-auto pb-2">
                    {reviewText.split(/---\s*New Moment Added\s*---/i).map((seg, i, arr) => (
                      <React.Fragment key={i}>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          {arr.length > 1 && (
                            <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wide">Moment {i + 1}</span>
                          )}
                          <textarea
                            ref={i === 0 ? textareaRef : undefined}
                            value={seg.trim()}
                            onChange={(e) => {
                              const parts = reviewText.split(/---\s*New Moment Added\s*---/i);
                              parts[i] = e.target.value;
                              setReviewText(parts.join('\n\n--- New Moment Added ---\n\n'));
                            }}
                            className="resize-none rounded-xl border p-4 text-sm leading-relaxed bg-white border-[#6C60FF] text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20"
                            rows={3}
                            spellCheck
                          />
                          {typeof segmentPhotoStates[i] === 'string' && (
                            <div className="relative w-16 h-16 flex-shrink-0">
                              <img src={segmentPhotoStates[i] as string} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                              <button
                                onClick={() => removePhoto(i)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800 text-white rounded-full flex items-center justify-center"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        {i < arr.length - 1 && (
                          <p className="text-center text-gray-500 text-xs font-medium flex-shrink-0">── New Moment Added ──</p>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                ) : (
                  <div className="w-full h-full overflow-y-auto rounded-xl border bg-gray-50 border-gray-200 p-4" style={{ minHeight: 200 }}>
                    {reviewText.split(/---\s*New Moment Added\s*---/i).map((seg, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && (
                          <p className="text-center text-gray-900 text-base my-3">── New Moment Added ──</p>
                        )}
                        <div>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{seg.trim()}</p>
                          {typeof segmentPhotoStates[i] === 'string' && (
                            <div className="mt-2 mb-1">
                              <img
                                src={segmentPhotoStates[i] as string}
                                alt={`Moment ${i + 1} photo`}
                                className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                              />
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>

              {/* Separator hint */}
              <div className="px-6 py-1 flex-shrink-0">
                <p className="text-[12px] text-gray-400 text-center">
                  Moments are separated by <code className="bg-gray-100 px-1 rounded text-[12px]">--- New Moment Added ---</code>
                </p>
              </div>

              {/* Action buttons */}
              <div className="px-6 pb-6 pt-2 space-y-3 flex-shrink-0">
                <button
                  onClick={analyzeAndCreate}
                  disabled={!reviewText.trim() || isEditing}
                  className="w-full h-12 rounded-xl bg-[#6C60FF] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#5B52FF] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Mic className="w-4 h-4" />
                  Complete Process
                </button>
                <button
                  onClick={() => { stopAll(); segmentsRef.current = ['']; setSegments(['']); setReviewText(''); setIsEditing(false); setModalState('initial'); }}
                  className="w-full h-12 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-[0.98] transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  Re-record
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── PROCESSING STATE ── */}
      {modalState === 'processing' && (
        <>
          {/* Mobile: full screen */}
          <div className="fixed inset-0 z-[9999] bg-white flex flex-col sm:hidden">
            <div className="flex items-center justify-between px-6 pt-10 pb-4 flex-shrink-0 border-b border-gray-200">
              <h2 className="text-[18px] font-semibold text-gray-900">Add Voice to Text Memo</h2>
              <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center space-y-5 px-6">
              <div className="w-10 h-10 border-4 border-[#6C60FF] border-t-transparent rounded-full animate-spin" />
              <div className="text-center space-y-2">
                <p className="text-[20px] font-semibold text-gray-900">Analysing your recording</p>
                <p className="text-[16px] text-gray-500 leading-relaxed">
                  In the process of converting your text memo into moments. Hang tight, we are almost done
                </p>
              </div>
              <div className="w-full space-y-2">
                <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-[#6C60FF] h-1.5 rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
                <p className="text-xs text-gray-500 text-center">{processingStatus || 'Processing recording..'}</p>
              </div>
            </div>
          </div>

          {/* Desktop: centered card */}
          <div className="fixed inset-0 z-[9999] hidden sm:flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md mx-auto shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
                <h2 className="text-[18px] font-semibold text-gray-900">Add Voice to Text Memo</h2>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="flex flex-col items-center justify-center py-16 space-y-5 px-6">
                <div className="w-10 h-10 border-4 border-[#6C60FF] border-t-transparent rounded-full animate-spin" />
                <div className="text-center space-y-2">
                  <p className="text-base font-semibold text-gray-900">Analysing your recording</p>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    In the process of converting your text memo into moments. Hang tight, we are almost done
                  </p>
                </div>
                <div className="w-full space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-[#6C60FF] h-1.5 rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                  <p className="text-xs text-gray-500 text-center">{processingStatus || 'Processing recording..'}</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {/* Mic Blocked Popup */}
      {showMicBlockedPopup && (() => {
        const browser = detectBrowser();
        const info = MIC_INSTRUCTIONS[browser];
        return (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm mx-auto shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-red-50 px-6 pt-6 pb-4 flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                  <MicOff className="w-7 h-7 text-red-500" />
                </div>
                <h3 className="text-[17px] font-semibold text-gray-900">{info.title}</h3>
                <p className="text-sm text-gray-500">Your browser has blocked microphone access. Follow these steps to enable it:</p>
              </div>
              {/* Steps */}
              <div className="px-6 py-4 space-y-3">
                {info.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#6C60FF] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-sm text-gray-700 leading-snug">{step}</p>
                  </div>
                ))}
              </div>
              {/* Buttons */}
              <div className="px-6 pb-6 space-y-2">
                <button
                  onClick={() => { setShowMicBlockedPopup(false); startRecording(); }}
                  className="w-full h-12 rounded-xl bg-[#6C60FF] text-white text-[15px] font-semibold hover:bg-[#5B52FF] active:scale-[0.98] transition-all"
                >
                  Try Again
                </button>
                <button
                  onClick={() => setShowMicBlockedPopup(false)}
                  className="w-full h-12 rounded-xl border border-gray-200 text-gray-700 text-[15px] font-medium hover:bg-gray-50 active:scale-[0.98] transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>,
    document.body
  );
};
