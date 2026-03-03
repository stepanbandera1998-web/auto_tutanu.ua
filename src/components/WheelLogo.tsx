import React from 'react';

export const WheelLogo = ({ className = "", size = 24 }: { className?: string, size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Outer Black Tire Circle */}
    <circle cx="50" cy="50" r="48" fill="#1A1A1A" />
    
    {/* Inner White Rim Area */}
    <circle cx="50" cy="50" r="40" fill="white" />
    
    {/* Rim Edge Detail Line */}
    <circle cx="50" cy="50" r="38" stroke="#1A1A1A" strokeWidth="1.5" />

    {/* Spokes - 5 spokes pattern */}
    <g fill="#1A1A1A">
      {[0, 72, 144, 216, 288].map((angle) => (
        <g key={angle} transform={`rotate(${angle} 50 50)`}>
          {/* Main Spoke Body */}
          <path d="M47 15H53L52 42H48L47 15Z" />
          {/* Spoke Center Line (Subtle) */}
          <rect x="49.5" y="18" width="1" height="18" fill="white" fillOpacity="0.2" />
        </g>
      ))}
    </g>

    {/* Center Hub */}
    <circle cx="50" cy="50" r="9" fill="white" stroke="#1A1A1A" strokeWidth="1.5" />
    <circle cx="50" cy="50" r="5" fill="white" stroke="#1A1A1A" strokeWidth="0.5" />
    
    {/* Lug Nuts (5) */}
    {[0, 72, 144, 216, 288].map((angle) => (
      <circle 
        key={angle} 
        cx={50 + 3.5 * Math.cos((angle - 90) * Math.PI / 180)} 
        cy={50 + 3.5 * Math.sin((angle - 90) * Math.PI / 180)} 
        r="1" 
        fill="#1A1A1A" 
      />
    ))}

    {/* White Banner that cuts through */}
    <rect x="0" y="62" width="100" height="18" fill="white" />
    
    {/* Banner Border Lines (Horizontal) */}
    <path d="M5 62H95" stroke="#1A1A1A" strokeWidth="1.2" />
    <path d="M5 80H95" stroke="#1A1A1A" strokeWidth="1.2" />
    
    {/* Text in banner */}
    <text 
      x="50" 
      y="74" 
      fill="#1A1A1A" 
      fontSize="10" 
      fontWeight="900" 
      textAnchor="middle" 
      fontFamily="'Arial Black', 'Arial', sans-serif"
      letterSpacing="-0.2"
    >
      AUTO_TUTANU.UA
    </text>
  </svg>
);
