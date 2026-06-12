import { useState, useEffect } from "react";

interface PdfThumbnailProps {
  url: string;
  className?: string;
}

const S3_HOST = 'stasht-data.s3.us-east-2.amazonaws.com';

function toProxied(url: string): string {
  return url;
}

export function PdfThumbnail({ url, className = "" }: PdfThumbnailProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(toProxied(url));
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(`${objectUrl}#toolbar=0&navpanes=0&view=FitH&page=1`);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  const icon = (pulse = false) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`w-14 h-14 text-[#6C60FF] mb-2 ${pulse ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-[#F0EEFF] ${className}`}>
        {icon()}
        <span className="text-xs font-semibold text-[#6C60FF] uppercase tracking-widest">PDF</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-[#F0EEFF] ${className}`}>
      {/* Loading placeholder until blob URL is ready */}
      {!blobUrl && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[#F0EEFF]">
          {icon(true)}
          <span className="text-xs font-semibold text-[#6C60FF] uppercase tracking-widest">PDF</span>
        </div>
      )}
      {/* Scale-down iframe using blob URL — no Content-Disposition issues */}
      {blobUrl && (
        <iframe
          src={blobUrl}
          title="PDF preview"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "250%",
            height: "250%",
            transform: "scale(0.4)",
            transformOrigin: "top left",
            pointerEvents: "none",
            border: "none",
            backgroundColor: "white",
          }}
        />
      )}
    </div>
  );
}
