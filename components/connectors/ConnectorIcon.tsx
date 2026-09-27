import { MessageCircle } from 'lucide-react';
import { brandColors, brandInitials } from './catalog';
import type { ConnectorDef } from './catalog';

const SIZES = {
  md: { box: 'w-11 h-11 rounded-xl', img: 'w-8 h-8', glyph: 'w-6 h-6', text: 'text-base' },
  lg: { box: 'w-24 h-24 rounded-2xl', img: 'w-16 h-16', glyph: 'w-12 h-12', text: 'text-3xl' },
} as const;

/** A connector's square brand tile: its icon image, or initials / a glyph on its brand colour. */
export function ConnectorIcon({ connector, size = 'md' }: { connector: ConnectorDef; size?: keyof typeof SIZES }) {
  const s = SIZES[size];
  const background = brandColors[connector.id];

  if (connector.iconImage) {
    return (
      <div
        className={`${s.box} flex-shrink-0 overflow-hidden border border-gray-100 ${connector.iconFill ? '' : 'flex items-center justify-center'}`}
        style={{ background }}
      >
        <img
          src={connector.iconImage}
          alt=""
          className={connector.iconFill ? 'w-full h-full object-cover' : `${s.img} object-contain`}
        />
      </div>
    );
  }

  return (
    <div
      className={`${s.box} flex items-center justify-center text-white font-bold flex-shrink-0 ${s.text}`}
      style={{ background }}
    >
      {connector.id === 'contact-widget'
        ? <MessageCircle className={s.glyph} aria-hidden="true" />
        : brandInitials[connector.id]}
    </div>
  );
}
