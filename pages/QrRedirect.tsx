import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { qrRedirectUrl } from '../utils/qrCodes';

/**
 * /q/<code> reaching the Studio app: a printed QR code scanned on a device still running an old service worker, which
 * answers every page with the app (the new one leaves /q/ to the server). Sent straight on to the web API's /q/
 * redirect (utils/qrCodes qrRedirectUrl: the API host, never this origin, so it can't come back here).
 */
export default function QrRedirect() {
  const { code = '' } = useParams();
  const target = qrRedirectUrl(code, import.meta.env.VITE_API_BASE_URL, window.location.origin);
  useEffect(() => {
    if (target) window.location.replace(target);
  }, [target]);
  if (target) return null;
  return <p className="p-6 text-center text-sm text-gray-600">This QR code link couldn't be opened.</p>;
}
