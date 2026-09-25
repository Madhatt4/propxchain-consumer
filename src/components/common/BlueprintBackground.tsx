// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Decorative blueprint background — housing estate site plan in aerial view.
 * Fixed behind page content, pointer-events disabled, low opacity.
 * Themed via `currentColor` so the parent can swap light/dark.
 */

import React from 'react';

interface BlueprintBackgroundProps {
  className?: string;
  /**
   * `fixed` (default) — viewport-pinned, used as a page-level watermark.
   * `contained` — absolute within nearest positioned ancestor, used inside
   * a panel (e.g. the auth shell brand aside).
   */
  variant?: 'fixed' | 'contained';
}

const BlueprintBackground: React.FC<BlueprintBackgroundProps> = ({
  className = '',
  variant = 'fixed',
}) => {
  const positioning =
    variant === 'contained' ? 'absolute inset-0' : 'fixed inset-0';
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none ${positioning} z-0 overflow-hidden text-[#5F8A68] dark:text-[#14B8A6] ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full opacity-[0.22] dark:opacity-[0.28]"
      >
        <defs>
          <pattern id="bp-grid-minor" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.3" />
          </pattern>
          <pattern id="bp-grid-major" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#bp-grid-minor)" />
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="currentColor" strokeWidth="0.7" />
          </pattern>
          <pattern id="bp-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="currentColor" strokeWidth="0.6" />
          </pattern>
        </defs>

        {/* drafting-paper grid */}
        <rect width="1600" height="1000" fill="url(#bp-grid-major)" />

        {/* outer site boundary */}
        <rect
          x="60"
          y="60"
          width="1480"
          height="880"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="12 6"
        />

        {/* cul-de-sac road — spine + loop */}
        <g fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M 60 500 L 900 500" />
          <path d="M 60 540 L 900 540" />
          <circle cx="1080" cy="520" r="180" />
          <circle cx="1080" cy="520" r="140" />
          {/* kerb tick marks */}
          {Array.from({ length: 40 }).map((_, i) => (
            <line key={`kerb-${i}`} x1={80 + i * 20} y1="500" x2={80 + i * 20} y2="495" strokeWidth="0.6" />
          ))}
        </g>

        {/* NORTH ROW — 6 plots above road */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const x = 100 + i * 130;
          return (
            <g key={`plot-n-${i}`} stroke="currentColor" fill="none">
              {/* plot boundary */}
              <rect x={x} y="180" width="110" height="300" strokeWidth="1" strokeDasharray="4 3" />
              {/* driveway */}
              <rect x={x + 15} y="440" width="22" height="60" strokeWidth="0.6" fill="url(#bp-hatch)" fillOpacity="0.4" />
              {/* house footprint — semi-detached pair outline */}
              <path
                d={`M ${x + 18} 260 L ${x + 18} 420 L ${x + 92} 420 L ${x + 92} 260 L ${x + 70} 260 L ${x + 70} 240 L ${x + 40} 240 L ${x + 40} 260 Z`}
                strokeWidth="1.3"
              />
              {/* interior wall */}
              <line x1={x + 55} y1="260" x2={x + 55} y2="420" strokeWidth="0.8" />
              {/* plot number */}
              <text
                x={x + 55}
                y="215"
                textAnchor="middle"
                fill="currentColor"
                fontFamily="Geist Mono, monospace"
                fontSize="11"
                fontWeight="500"
              >
                {String(i + 1).padStart(2, '0')}
              </text>
              {/* front garden hatch */}
              <rect
                x={x + 18}
                y="420"
                width="74"
                height="20"
                fill="url(#bp-hatch)"
                fillOpacity="0.3"
                stroke="none"
              />
            </g>
          );
        })}

        {/* SOUTH ROW — 6 plots below road */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const x = 100 + i * 130;
          return (
            <g key={`plot-s-${i}`} stroke="currentColor" fill="none">
              <rect x={x} y="560" width="110" height="300" strokeWidth="1" strokeDasharray="4 3" />
              <rect x={x + 73} y="540" width="22" height="60" strokeWidth="0.6" fill="url(#bp-hatch)" fillOpacity="0.4" />
              {/* detached — single block with porch */}
              <path
                d={`M ${x + 18} 620 L ${x + 18} 790 L ${x + 92} 790 L ${x + 92} 620 Z M ${x + 38} 620 L ${x + 38} 600 L ${x + 72} 600 L ${x + 72} 620`}
                strokeWidth="1.3"
              />
              <line x1={x + 18} y1="720" x2={x + 92} y2="720" strokeWidth="0.8" />
              <text
                x={x + 55}
                y="815"
                textAnchor="middle"
                fill="currentColor"
                fontFamily="Geist Mono, monospace"
                fontSize="11"
                fontWeight="500"
              >
                {String(i + 7).padStart(2, '0')}
              </text>
            </g>
          );
        })}

        {/* cul-de-sac detached homes around the loop */}
        {[
          { cx: 1080, cy: 320, rot: 0 },
          { cx: 1240, cy: 420, rot: 60 },
          { cx: 1240, cy: 620, rot: 120 },
          { cx: 1080, cy: 720, rot: 180 },
          { cx: 920, cy: 620, rot: 240 },
          { cx: 920, cy: 420, rot: 300 },
        ].map((p, i) => (
          <g key={`cul-${i}`} transform={`rotate(${p.rot} ${p.cx} ${p.cy})`} stroke="currentColor" fill="none">
            <rect x={p.cx - 55} y={p.cy - 55} width="110" height="110" strokeWidth="1" strokeDasharray="4 3" />
            <path
              d={`M ${p.cx - 40} ${p.cy - 30} L ${p.cx - 40} ${p.cy + 30} L ${p.cx + 40} ${p.cy + 30} L ${p.cx + 40} ${p.cy - 30} L ${p.cx + 15} ${p.cy - 30} L ${p.cx + 15} ${p.cy - 45} L ${p.cx - 15} ${p.cy - 45} L ${p.cx - 15} ${p.cy - 30} Z`}
              strokeWidth="1.3"
            />
            <text
              x={p.cx}
              y={p.cy + 6}
              textAnchor="middle"
              fill="currentColor"
              fontFamily="Geist Mono, monospace"
              fontSize="10"
              fontWeight="500"
              transform={`rotate(${-p.rot} ${p.cx} ${p.cy})`}
            >
              {String(i + 13).padStart(2, '0')}
            </text>
          </g>
        ))}

        {/* dimension line — top row width callout */}
        <g stroke="currentColor" strokeWidth="0.6" fill="none">
          <line x1="100" y1="140" x2="880" y2="140" />
          <line x1="100" y1="130" x2="100" y2="170" />
          <line x1="880" y1="130" x2="880" y2="170" />
          <text
            x="490"
            y="132"
            textAnchor="middle"
            fill="currentColor"
            fontFamily="Geist Mono, monospace"
            fontSize="11"
          >
            78.0 m
          </text>
        </g>

        {/* tree symbols scattered along boundaries */}
        {[
          [120, 110], [280, 110], [440, 110], [600, 110], [760, 110], [900, 110],
          [120, 900], [280, 900], [440, 900], [600, 900], [760, 900], [900, 900],
          [1450, 140], [1480, 280], [1500, 440], [1500, 600], [1480, 760], [1450, 890],
        ].map(([cx, cy], i) => (
          <g key={`tree-${i}`} stroke="currentColor" fill="none" strokeWidth="0.8">
            <circle cx={cx} cy={cy} r="10" />
            <circle cx={cx} cy={cy} r="5" />
            <line x1={cx - 10} y1={cy} x2={cx + 10} y2={cy} strokeWidth="0.5" />
            <line x1={cx} y1={cy - 10} x2={cx} y2={cy + 10} strokeWidth="0.5" />
          </g>
        ))}

        {/* compass rose — top right */}
        <g transform="translate(1440 120)" stroke="currentColor" fill="none">
          <circle r="32" strokeWidth="1" />
          <circle r="26" strokeWidth="0.4" />
          <path d="M 0 -28 L 6 0 L 0 28 L -6 0 Z" strokeWidth="1" fill="currentColor" fillOpacity="0.15" />
          <path d="M -28 0 L 0 6 L 28 0 L 0 -6 Z" strokeWidth="0.6" />
          <text
            x="0"
            y="-38"
            textAnchor="middle"
            fill="currentColor"
            fontFamily="DM Sans, sans-serif"
            fontSize="11"
            fontWeight="600"
          >
            N
          </text>
        </g>

        {/* scale bar — bottom left */}
        <g transform="translate(100 960)" stroke="currentColor" fill="none">
          <rect width="40" height="8" strokeWidth="0.8" fill="currentColor" fillOpacity="0.3" />
          <rect x="40" width="40" height="8" strokeWidth="0.8" />
          <rect x="80" width="40" height="8" strokeWidth="0.8" fill="currentColor" fillOpacity="0.3" />
          <rect x="120" width="40" height="8" strokeWidth="0.8" />
          <g fontFamily="Geist Mono, monospace" fontSize="9" fill="currentColor" stroke="none">
            <text x="0" y="-4">0</text>
            <text x="78" y="-4" textAnchor="middle">20m</text>
            <text x="160" y="-4" textAnchor="end">40m</text>
          </g>
        </g>

        {/* title block — bottom right */}
        <g transform="translate(1280 900)" stroke="currentColor" fill="none" strokeWidth="0.8">
          <rect width="260" height="80" />
          <line x1="0" y1="26" x2="260" y2="26" />
          <line x1="0" y1="54" x2="260" y2="54" />
          <line x1="130" y1="26" x2="130" y2="80" />
          <g fontFamily="DM Sans, sans-serif" fill="currentColor" stroke="none">
            <text x="10" y="18" fontSize="11" fontWeight="600">PROPXCHAIN · SITE PLAN</text>
            <text x="10" y="44" fontSize="9">DWG / PX-001 · REV A</text>
            <text x="10" y="72" fontSize="9">SCALE 1:500</text>
            <text x="140" y="44" fontSize="9">SHEET 01 / 04</text>
            <text x="140" y="72" fontSize="9" fontFamily="Geist Mono, monospace">A1</text>
          </g>
        </g>
      </svg>
    </div>
  );
};

export default BlueprintBackground;
