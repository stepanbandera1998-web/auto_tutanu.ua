import React from 'react';

export const MultiSpokeLogo = ({ className = "", size = 24 }: { className?: string, size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Outer Black Tire */}
    <circle cx="50" cy="50" r="48" fill="black" />
    
    {/* Deep Dish Rim Edge */}
    <circle cx="50" cy="50" r="42" stroke="white" strokeWidth="1.5" />
    <circle cx="50" cy="50" r="40" stroke="white" strokeWidth="0.5" strokeOpacity="0.5" />

    {/* Multi-Spoke Mesh Pattern (20 spokes) */}
    <g stroke="white" strokeWidth="1.2" strokeLinecap="round">
      {Array.from({ length: 20 }).map((_, i) => {
        const angle = i * 18; // 360 / 20 = 18 degrees
        return (
          <g key={i} transform={`rotate(${angle} 50 50)`}>
            {/* Main thin spoke */}
            <line x1="50" y1="12" x2="50" y2="42" />
            {/* Cross-mesh detail for premium look */}
            <path d="M50 25L46 35M50 25L54 35" strokeOpacity="0.4" strokeWidth="0.8" />
          </g>
        );
      })}
    </g>

    {/* Center Hub Area */}
    <circle cx="50" cy="50" r="12" fill="black" stroke="white" strokeWidth="1" />
    <circle cx="50" cy="50" r="8" stroke="white" strokeWidth="0.5" strokeOpacity="0.5" />
    
    {/* Center Cap Detail */}
    <circle cx="50" cy="50" r="3" fill="white" />
    
    {/* Lug Nuts (Small dots around center) */}
    {Array.from({ length: 5 }).map((_, i) => {
      const angle = i * 72;
      return (
        <circle 
          key={i} 
          cx={50 + 6 * Math.cos((angle - 90) * Math.PI / 180)} 
          cy={50 + 6 * Math.sin((angle - 90) * Math.PI / 180)} 
          r="0.8" 
          fill="white" 
        />
      );
    })}

    {/* Premium Banner Overlay */}
    <rect x="5" y="70" width="90" height="14" rx="2" fill="white" />
    <path d="M5 70H95M5 84H95" stroke="black" strokeWidth="0.5" />
    
    {/* Text in banner */}
    <text 
      x="50" 
      y="80" 
      fill="black" 
      fontSize="8" 
      fontWeight="900" 
      textAnchor="middle" 
      fontFamily="'Arial Black', sans-serif"
      letterSpacing="0.5"
    >
      AUTO_TUTANU.UA
    </text>
  </svg>
);
