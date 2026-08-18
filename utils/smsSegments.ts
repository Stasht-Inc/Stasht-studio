/**
 * Backend wraps every SMS in a greeting + attribution + STOP footer
 * (LeadDeliveryService::buildSmsBody). We can't know the exact names'
 * lengths client-side, so budget a fixed conservative overhead.
 */
export const SMS_WRAPPER_OVERHEAD = 140;
export const SMS_MAX_BODY = 1600; // matches backend validation

const GSM7 = /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑܧ¿äöñüà^{}\\[~\]|€]*$/;

export function smsSegmentInfo(body: string): {
  chars: number;          // user-typed characters
  effective: number;      // chars + wrapper overhead
  encoding: 'GSM-7' | 'UCS-2';
  perSegment: number;     // 153 or 67 (multipart sizes)
  segments: number;
} {
  const encoding = GSM7.test(body) ? 'GSM-7' : 'UCS-2';
  const perSegment = encoding === 'GSM-7' ? 153 : 67;
  const effective = body.length + SMS_WRAPPER_OVERHEAD;
  return {
    chars: body.length,
    effective,
    encoding,
    perSegment,
    segments: body.length === 0 ? 0 : Math.ceil(effective / perSegment),
  };
}
