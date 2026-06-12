import { useState, useRef, useEffect } from 'react';
import { X, Loader2, FileText, Upload, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { dashboardAPI } from '../utils/authUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  memoryId?: string;
  postId?: string | null;
}

export function DocuSignSendModal({ isOpen, onClose, memoryId, postId }: Props) {
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusChecked, setStatusChecked] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStatusChecked(false);
    dashboardAPI.docuSignGetStatus()
      .then(res => {
        setIsConnected(res.success && res.data?.connected === true);
        setStatusChecked(true);
      })
      .catch(() => {
        setIsConnected(false);
        setStatusChecked(true);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are supported');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File size must be under 20MB');
      return;
    }
    setPdfFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) { toast.error('Please select a PDF file'); return; }
    if (!recipientName.trim()) { toast.error('Recipient name is required'); return; }
    if (!recipientEmail.trim()) { toast.error('Recipient email is required'); return; }
    if (!emailSubject.trim()) { toast.error('Email subject is required'); return; }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('document', pdfFile);
      formData.append('recipient_name', recipientName.trim());
      formData.append('recipient_email', recipientEmail.trim());
      formData.append('email_subject', emailSubject.trim());
      if (memoryId) formData.append('memory_id', memoryId);
      if (postId) formData.append('post_id', postId);

      const res = await dashboardAPI.docuSignSendEnvelope(formData);
      if (res.success) {
        toast.success('Document sent for signature successfully');
        handleClose();
      } else {
        toast.error(res.error || 'Failed to send document');
      }
    } catch {
      toast.error('Failed to send document for signature');
    }
    setLoading(false);
  };

  const handleClose = () => {
    setRecipientName('');
    setRecipientEmail('');
    setEmailSubject('');
    setPdfFile(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#6C60FF]" />
            <h2 className="text-base font-bold text-gray-900">Send for Signature</h2>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Not connected state */}
        {statusChecked && !isConnected && (
          <div className="px-6 py-8 flex flex-col items-center gap-4 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-400" />
            <div>
              <p className="font-semibold text-gray-900 mb-1">DocuSign Not Connected</p>
              <p className="text-sm text-gray-500">Connect your DocuSign account in the Marketplace before sending documents for signature.</p>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-[#6C60FF] hover:bg-[#5A4FFF] text-white font-semibold text-sm transition-colors"
            >
              Go to Marketplace
            </button>
          </div>
        )}

        {/* Loading state */}
        {!statusChecked && (
          <div className="px-6 py-10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}

        {/* Body */}
        {statusChecked && isConnected && (
        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-4 flex-1">
          {/* PDF Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">
              Document (PDF)<span className="text-red-500">*</span>
            </label>
            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-[#6C60FF] transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {pdfFile ? (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-700">
                  <FileText className="w-4 h-4 text-[#6C60FF]" />
                  <span className="font-medium truncate max-w-[200px]">{pdfFile.name}</span>
                  <span className="text-gray-400">({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <Upload className="w-6 h-6 text-gray-400" />
                  <p className="text-sm text-gray-500">Click to upload PDF <span className="text-gray-400">(max 20MB)</span></p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Recipient Name */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">
              Recipient Name<span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
              placeholder="John Doe"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]"
            />
          </div>

          {/* Recipient Email */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">
              Recipient Email<span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
              placeholder="john@example.com"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]"
            />
          </div>

          {/* Email Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">
              Email Subject<span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={emailSubject}
              onChange={e => setEmailSubject(e.target.value)}
              placeholder="Please sign this document"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]"
            />
          </div>
        </form>
        )}

        {/* Footer — only when connected */}
        {statusChecked && isConnected && (
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-[#6C60FF] hover:bg-[#5A4FFF] disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Sending...' : 'Send for Signature'}
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
