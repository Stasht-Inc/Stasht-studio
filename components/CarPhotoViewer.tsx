import { ChevronLeft, ChevronRight, Image as ImageIcon, X } from 'lucide-react';

interface CarPhotoViewerProps {
  car: any;
  photoIndex: number | null;
  onPhotoIndexChange: (index: number) => void;
  onClose: () => void;
  // Injected from the published page (module-level helpers there).
  imageLarge: (url: string) => string;
  linkedLabel: (car: any) => string;
}

// Full-screen car photo viewer opened from a published campaign: filmstrip + photo + spec
// sheet, no comments.
//
// Layout: on desktop (lg+) it is three columns and only the spec panel scrolls. On a phone
// the photo sits on top of the specs and the WHOLE overlay scrolls — the spec panel used to
// be `shrink-0 overflow-y-auto` inside a non-scrolling `fixed inset-0`, so it never got a
// height limit to scroll within and anything below the fold (the last specs and the
// "View Full Listing" button) was unreachable (Chris, 2026-09-21: "I can't scroll on mobile").
export default function CarPhotoViewer({ car, photoIndex, onPhotoIndexChange, onClose, imageLarge, linkedLabel }: CarPhotoViewerProps) {
  const carImages: string[] = (Array.isArray(car.images) && car.images.length)
    ? car.images
    : (car.cover_image ? [car.cover_image] : []);
  const total = carImages.length;
  const idx = Math.min(photoIndex ?? 0, Math.max(0, total - 1));
  const go = (n: number) => onPhotoIndexChange(total > 0 ? (((n % total) + total) % total) : 0);
  const specs: [string, any][] = [
    ['Mileage', (car.mileage != null && car.mileage !== '') ? `${Number(car.mileage).toLocaleString()} mi` : null],
    ['Stock #', car.stock_number],
    ['Engine', car.engine],
    ['Body Style', car.body_style],
    ['Exterior Color', car.exterior_color],
    ['Interior Color', car.interior_color],
    ['Fuel Type', car.fuel_type],
    ['Transmission', car.transmission],
    ['Drivetrain', car.drivetrain],
    ['Trim', car.trim_details],
  ];
  const shownSpecs = specs.filter(([, v]) => v != null && v !== '');
  const linkedText = linkedLabel(car);

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col lg:flex-row overflow-y-auto overscroll-contain lg:overflow-hidden">
      <div className="hidden lg:flex flex-col w-24 shrink-0 overflow-y-auto bg-black/80 p-2 gap-2">
        {carImages.map((src, i) => (
          <button key={i} type="button" onClick={() => onPhotoIndexChange(i)}
            className={`shrink-0 w-full aspect-[4/3] rounded-md overflow-hidden border-2 ${i === idx ? 'border-[#6C60FF]' : 'border-transparent opacity-60 hover:opacity-100'}`}>
            <img src={src} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      <div className="relative shrink-0 lg:shrink lg:flex-1 flex items-center justify-center h-[55dvh] lg:h-auto lg:min-h-0">
        <div className="absolute top-4 left-4 right-16 text-white text-sm z-10">{car.title} · {idx + 1} of {total}</div>
        {/* Fixed on phones so Close stays reachable after the overlay has scrolled */}
        <button type="button" onClick={onClose} aria-label="Close"
          className="fixed lg:absolute top-4 right-4 z-20 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm">
          <X className="w-5 h-5" />
        </button>
        {total > 1 && (
          <button type="button" onClick={() => go(idx - 1)} aria-label="Previous"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20">
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {total > 0 ? (
          <img src={imageLarge(carImages[idx])} alt={car.title} className="max-h-[55dvh] lg:max-h-[92vh] max-w-full object-contain" />
        ) : (
          <div className="text-gray-500"><ImageIcon className="w-12 h-12" /></div>
        )}
        {total > 1 && (
          <button type="button" onClick={() => go(idx + 1)} aria-label="Next"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20">
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>
      <div className="w-full lg:w-96 shrink-0 bg-[#0b0b0b] text-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:overflow-y-auto">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {car.condition && <span className="inline-flex rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-2.5 py-1">{car.condition}</span>}
          {linkedText && <span className="inline-flex rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold px-2.5 py-1">{linkedText}</span>}
        </div>
        <h3 className="text-lg font-semibold">{car.title}</h3>
        {car.description && <p className="text-gray-300 text-sm leading-relaxed mt-2 mb-6">{car.description}</p>}
        {shownSpecs.length > 0 && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/10 pt-5">
            {shownSpecs.map(([label, value]) => (
              <div key={label}>
                <p className="text-[12px] uppercase tracking-wide text-gray-500">{label}</p>
                <p className="text-sm font-medium text-white break-words">{value}</p>
              </div>
            ))}
          </div>
        )}
        {car.listing_url && (
          <a href={car.listing_url} target="_blank" rel="noopener noreferrer"
            className="mt-6 block w-full text-center bg-[#6C60FF] hover:bg-[#5b50e6] text-white text-sm font-medium rounded-lg py-2.5 transition-colors">
            View Full Listing
          </a>
        )}
      </div>
    </div>
  );
}
