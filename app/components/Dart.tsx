// Pinned's identity: a steel-tip dart (silver barrel, red flights). A dart pins things.

import {useId} from 'react'

/** The dart, drawn pointing down-left like the reference. `size` is the square edge in px. */
export function Dart({size = 28, className = ''}: {size?: number; className?: string}) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={`steel-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f4f4" />
          <stop offset="0.45" stopColor="#b9bcc0" />
          <stop offset="0.7" stopColor="#8d9196" />
          <stop offset="1" stopColor="#d9dbde" />
        </linearGradient>
        <linearGradient id={`flight-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff4b47" />
          <stop offset="1" stopColor="#c8171d" />
        </linearGradient>
      </defs>
      <g transform="rotate(45 32 32)">
        {/* tip */}
        <path d="M32 61 L31.2 46 L32.8 46 Z" fill="#9aa0a6" />
        {/* barrel with grooves */}
        <rect x="29.4" y="31" width="5.2" height="16" rx="2.4" fill={`url(#steel-${id})`} />
        {[34, 37, 40, 43].map((y) => (
          <rect key={y} x="29.4" y={y} width="5.2" height="0.9" fill="#6f747a" opacity="0.7" />
        ))}
        {/* shaft */}
        <rect x="31" y="15" width="2" height="17" rx="1" fill="#d8262c" />
        {/* flights */}
        <path d="M32 3 L42 13 L32 21 Z" fill={`url(#flight-${id})`} />
        <path d="M32 3 L22 13 L32 21 Z" fill={`url(#flight-${id})`} opacity="0.85" />
        <path d="M32 3 L32 21" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="0.8" />
      </g>
    </svg>
  )
}

/** Hero art: a dartboard of API versions with the dart landing on the boundary ring. */
export function HeroBoard() {
  return (
    <div className="pinned-board relative mx-auto aspect-square w-full max-w-[380px]" aria-hidden>
      <svg viewBox="0 0 400 400" className="h-full w-full">
        <defs>
          <radialGradient id="board-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="1" stopColor="#ff4b47" stopOpacity="0.08" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="200" r="196" fill="url(#board-glow)" />
        {[
          [170, '#fafaf8', 'v1'],
          [135, '#ffffff', '2021-03-25'],
          [100, '#fafaf8', '2023-05-03'],
          [66, '#fff1f0', '2025-02-19'],
          [32, '#ffffff', '2026'],
        ].map(([r, fill, label], i) => (
          <g key={String(label)}>
            <circle cx="200" cy="200" r={Number(r)} fill={String(fill)} stroke={i === 3 ? '#e5383b' : '#e9e9e7'} strokeWidth={i === 3 ? 2 : 1.2} strokeDasharray={i === 3 ? '5 4' : undefined} />
            <text x="200" y={200 - Number(r) + 15} textAnchor="middle" className="fill-[#787774] font-mono text-[10px]">
              {String(label)}
            </text>
          </g>
        ))}
        <line x1="30" y1="200" x2="370" y2="200" stroke="#e9e9e7" />
        <line x1="200" y1="30" x2="200" y2="370" stroke="#e9e9e7" />
      </svg>
      {/* the dart lands on the 2025-02-19 ring */}
      <div className="pinned-dart absolute" style={{left: '58%', top: '20%'}}>
        <Dart size={150} />
      </div>
      <div className="pinned-tag absolute left-[62%] top-[50%] rounded-full border border-[#f3c4c3] bg-white px-3 py-1 font-mono text-[11px] text-[#c8171d] shadow-[var(--shadow-diagram)]">
        default: raw → published
      </div>
    </div>
  )
}
