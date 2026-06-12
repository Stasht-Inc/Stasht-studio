/**
 * Reads the EXIF Orientation tag from a JPEG ArrayBuffer.
 * Returns orientation value 1-8, or 1 (normal) if not found.
 */
function readExifOrientation(buffer: ArrayBuffer): number {
  try {
    const view = new DataView(buffer);

    // Must start with JPEG SOI marker 0xFFD8
    if (view.getUint16(0, false) !== 0xFFD8) return 1;

    let offset = 2;
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset, false);
      offset += 2;

      if (marker === 0xFFE1) {
        // APP1 segment — check for 'Exif\0\0' header
        const segmentLength = view.getUint16(offset, false);
        const exifHeader = view.getUint32(offset + 2, false);
        if (exifHeader !== 0x45786966) {
          // Not Exif, skip segment
          offset += segmentLength;
          continue;
        }

        const tiffStart = offset + 8; // skip length (2) + 'Exif\0\0' (6)
        const byteOrder = view.getUint16(tiffStart, false);
        const littleEndian = byteOrder === 0x4949; // 'II' = little-endian

        const ifdOffset = view.getUint32(tiffStart + 4, littleEndian);
        const ifdStart = tiffStart + ifdOffset;
        const numEntries = view.getUint16(ifdStart, littleEndian);

        for (let i = 0; i < numEntries; i++) {
          const entryOffset = ifdStart + 2 + i * 12;
          const tag = view.getUint16(entryOffset, littleEndian);
          if (tag === 0x0112) {
            // Orientation tag found
            return view.getUint16(entryOffset + 8, littleEndian);
          }
        }
        return 1;
      } else if ((marker & 0xFF00) !== 0xFF00) {
        break; // Not a valid marker
      } else {
        offset += view.getUint16(offset, false); // Skip segment
      }
    }
  } catch {
    // Ignore any parse errors
  }
  return 1;
}

/**
 * Corrects the orientation of a JPEG image file using its EXIF Orientation tag.
 * Draws the image onto a canvas with the correct rotation/flip applied.
 * Always resolves — returns original file if no correction needed or on any error.
 */
export async function correctImageOrientation(file: File): Promise<File> {
  // Only JPEG files carry EXIF orientation data
  if (!file.type.startsWith('image/jpeg') && file.type !== 'image/jpg') {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (!buffer) { resolve(file); return; }

      const orientation = readExifOrientation(buffer);

      // Orientation 1 = already correct, no canvas work needed
      if (orientation <= 1 || orientation > 8) { resolve(file); return; }

      const objectUrl = URL.createObjectURL(new Blob([buffer], { type: file.type }));
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(file); return; }

        const w = img.width;
        const h = img.height;

        // Orientations 5-8 require swapping width/height
        if (orientation >= 5) {
          canvas.width = h;
          canvas.height = w;
        } else {
          canvas.width = w;
          canvas.height = h;
        }

        // Apply 2D transform to correct orientation
        // Reference: https://www.impulseadventure.com/photo/exif-orientation.html
        switch (orientation) {
          case 2: ctx.transform(-1, 0, 0,  1, w, 0); break; // flip horizontal
          case 3: ctx.transform(-1, 0, 0, -1, w, h); break; // 180°
          case 4: ctx.transform( 1, 0, 0, -1, 0, h); break; // flip vertical
          case 5: ctx.transform( 0, 1, 1,  0, 0, 0); break; // transpose
          case 6: ctx.transform( 0, 1,-1,  0, h, 0); break; // 90° CW
          case 7: ctx.transform( 0,-1,-1,  0, h, w); break; // transverse
          case 8: ctx.transform( 0,-1, 1,  0, 0, w); break; // 90° CCW
        }

        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: file.lastModified
          }));
        }, 'image/jpeg', 0.95);
      };

      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
      img.src = objectUrl;
    };

    reader.onerror = () => resolve(file);
    reader.readAsArrayBuffer(file);
  });
}
