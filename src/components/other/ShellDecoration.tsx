import React from 'react';

interface ShellDecorationProps {
  className?: string;
}

export const ShellDecoration: React.FC<ShellDecorationProps> = ({ className }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="scallopGradient" cx="50%" cy="100%" r="100%" fx="50%" fy="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
          <stop offset="40%" stopColor="#FDFD96" stopOpacity="0.7" />
          <stop offset="65%" stopColor="#FFB3DE" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#87CEEB" stopOpacity="0.9" />
        </radialGradient>
      </defs>
      <path
        d="M 50 98
           A 48 48 0 0 1 2 50
           L 2 45
           C 15 35, 25 20, 40 8
           L 45 3
           L 50 10
           L 55 3
           L 60 8
           C 75 20, 85 35, 98 45
           L 98 50
           A 48 48 0 0 1 50 98 Z"
        fill="url(#scallopGradient)"
        stroke="#FFFFFF"
        strokeWidth="1.5"
      />
      <line x1="50" y1="10" x2="10" y2="60" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6" />
      <line x1="50" y1="10" x2="30" y2="70" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6" />
      <line x1="50" y1="10" x2="50" y2="75" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6" />
      <line x1="50" y1="10" x2="70" y2="70" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6" />
      <line x1="50" y1="10" x2="90" y2="60" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
};
