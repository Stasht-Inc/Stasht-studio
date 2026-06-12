import React from 'react';

interface Country {
  code: string;
  name: string;
  dialCode: string;
}

const countries: Country[] = [
  { code: 'IN', name: 'India', dialCode: '+91' },
  { code: 'CA', name: 'Canada', dialCode: '+1' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44' },
  { code: 'CN', name: 'China', dialCode: '+86' },
  { code: 'AU', name: 'Australia', dialCode: '+61' },
  { code: 'FR', name: 'France', dialCode: '+33' },
  { code: 'DE', name: 'Germany', dialCode: '+49' },
  { code: 'JP', name: 'Japan', dialCode: '+81' },
];

// SVG Flag Components
const FlagSVG = ({ code }: { code: string }) => {
  const flags: Record<string, JSX.Element> = {
    IN: ( // India
      <svg width="20" height="15" viewBox="0 0 20 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="20" height="5" fill="#FF9933"/>
        <rect y="5" width="20" height="5" fill="#FFFFFF"/>
        <rect y="10" width="20" height="5" fill="#138808"/>
        <circle cx="10" cy="7.5" r="2" fill="#000080" stroke="#000080" strokeWidth="0.3"/>
      </svg>
    ),
    CA: ( // Canada
      <svg width="24" height="18" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="18" fill="#FFFFFF" stroke="#D3D3D3" strokeWidth="0.5"/>
        <rect width="6" height="18" fill="#FF0000"/>
        <rect x="18" width="6" height="18" fill="#FF0000"/>
        <path d="M12 5L11.2 7.5L9 8L11.2 8.5L12 11L12.8 8.5L15 8L12.8 7.5L12 5Z" fill="#FF0000"/>
        <rect x="10.5" y="8" width="3" height="3" fill="#FF0000"/>
      </svg>
    ),
    GB: ( // United Kingdom
      <svg width="20" height="15" viewBox="0 0 20 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="20" height="15" fill="#012169"/>
        <path d="M0 0L20 15M20 0L0 15" stroke="#FFFFFF" strokeWidth="3"/>
        <path d="M0 0L20 15M20 0L0 15" stroke="#C8102E" strokeWidth="2"/>
        <path d="M10 0V15M0 7.5H20" stroke="#FFFFFF" strokeWidth="5"/>
        <path d="M10 0V15M0 7.5H20" stroke="#C8102E" strokeWidth="3"/>
      </svg>
    ),
    CN: ( // China
      <svg width="20" height="15" viewBox="0 0 20 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="20" height="15" fill="#DE2910"/>
        <path d="M3 3L3.5 4.5L2 4.5L3.5 5.5L3 7L4.5 6L6 7L5.5 5.5L7 4.5L5.5 4.5L3 3Z" fill="#FFDE00"/>
      </svg>
    ),
    AU: ( // Australia
      <svg width="20" height="15" viewBox="0 0 20 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="20" height="15" fill="#012169"/>
        <path d="M15 9L15.3 10L16 9.5L15.5 10.3L16.2 11L15.3 10.7L15 11.5L14.7 10.7L13.8 11L14.5 10.3L14 9.5L14.7 10L15 9Z" fill="#FFFFFF"/>
      </svg>
    ),
    FR: ( // France
      <svg width="20" height="15" viewBox="0 0 20 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="6.67" height="15" fill="#002395"/>
        <rect x="6.67" width="6.67" height="15" fill="#FFFFFF"/>
        <rect x="13.33" width="6.67" height="15" fill="#ED2939"/>
      </svg>
    ),
    DE: ( // Germany
      <svg width="20" height="15" viewBox="0 0 20 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="20" height="5" fill="#000000"/>
        <rect y="5" width="20" height="5" fill="#DD0000"/>
        <rect y="10" width="20" height="5" fill="#FFCE00"/>
      </svg>
    ),
    JP: ( // Japan
      <svg width="20" height="15" viewBox="0 0 20 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="20" height="15" fill="#FFFFFF"/>
        <circle cx="10" cy="7.5" r="4" fill="#BC002D"/>
      </svg>
    ),
  };

  return flags[code] || flags.IN;
};

interface CountrySelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export default function CountrySelect({ value, onChange, className = '', disabled = false }: CountrySelectProps) {
  const selectedCountry = countries.find(c => c.dialCode === value) || countries[0];

  return (
    <div className="relative">
      <select
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
        style={{
          paddingLeft: '2.5rem',
          appearance: 'none',
          backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23666\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.75rem center',
          paddingRight: '2rem'
        }}
      >
        {countries.map((country) => (
          <option key={country.dialCode} value={country.dialCode}>
            {country.dialCode}
          </option>
        ))}
      </select>
      <div className="absolute left-2.5 top-1/2 transform -translate-y-1/2 pointer-events-none flex items-center">
        <FlagSVG code={selectedCountry.code} />
      </div>
    </div>
  );
}
