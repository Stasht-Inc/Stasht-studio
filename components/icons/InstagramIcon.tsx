import React from 'react';

interface InstagramIconProps {
  className?: string;
}

export const InstagramIcon: React.FC<InstagramIconProps> = ({ className = "w-4 h-4" }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Instagram gradient background */}
      <defs>
        <linearGradient id="instagram-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" style={{ stopColor: '#FD5949', stopOpacity: 1 }} />
          <stop offset="50%" style={{ stopColor: '#D6249F', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#285AEB', stopOpacity: 1 }} />
        </linearGradient>
      </defs>

      {/* Background rounded square */}
      <rect x="0" y="0" width="24" height="24" rx="6" fill="url(#instagram-gradient)"/>

      {/* Instagram camera icon */}
      <g transform="translate(12, 12) scale(0.8) translate(-12, -12)">
        <path
          d="M12 8.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5zm0 5.5a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5z"
          fill="white"
        />
        <path
          d="M16.5 7.25h.01"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M15.5 3h-7A5.5 5.5 0 0 0 3 8.5v7A5.5 5.5 0 0 0 8.5 21h7a5.5 5.5 0 0 0 5.5-5.5v-7A5.5 5.5 0 0 0 15.5 3zm4.5 12.5a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 15.5v-7A4.5 4.5 0 0 1 8.5 4h7A4.5 4.5 0 0 1 20 8.5v7z"
          fill="white"
        />
      </g>
    </svg>
  );
};
