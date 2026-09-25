// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Inline SVG diagrams for the property searches guide. `currentColor`
 * throughout so both work in light and dark themes without a second asset.
 */

import React from 'react';

const SANDY_ITEMS = ['Local authority', 'Drainage & water', 'Environmental', 'Title'];

export const LocationDiagram: React.FC = () => (
  <figure className="my-8">
    <svg
      viewBox="0 0 480 200"
      role="img"
      aria-labelledby="location-diagram-title"
      className="w-full text-[#5F8A68] dark:text-[#9CB8A4]"
    >
      <title id="location-diagram-title">
        The same house needs different searches depending on where it stands
      </title>
      <rect
        x="10"
        y="20"
        width="210"
        height="160"
        rx="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="260"
        y="20"
        width="210"
        height="160"
        rx="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <text x="115" y="45" textAnchor="middle" fill="currentColor" fontSize="13" fontWeight="600">
        Sandy, Bedfordshire
      </text>
      <text x="365" y="45" textAnchor="middle" fill="currentColor" fontSize="13" fontWeight="600">
        Barnsley, South Yorkshire
      </text>
      {SANDY_ITEMS.map((label, i) => (
        <text key={`l-${label}`} x="30" y={78 + i * 20} fill="currentColor" fontSize="11" opacity="0.85">
          ✓ {label}
        </text>
      ))}
      {SANDY_ITEMS.map((label, i) => (
        <text key={`r-${label}`} x="280" y={78 + i * 20} fill="currentColor" fontSize="11" opacity="0.85">
          ✓ {label}
        </text>
      ))}
      <text x="280" y="163" fill="currentColor" fontSize="11" fontWeight="600">
        ✓ Coal mining (CON29M)
      </text>
      <text x="30" y="163" fill="currentColor" fontSize="11" opacity="0.45">
        ✕ Coal mining — no history here
      </text>
    </svg>
    <figcaption className="mt-2 text-center font-[DM_Sans] text-sm text-[#6B7280] dark:text-[#94A3B8]">
      Two identical houses, two different search lists. Former coalfields need a CON29M;
      Bedfordshire does not.
    </figcaption>
  </figure>
);

const TIMELINE_TICKS = [
  { x: 20, label: 'Order' },
  { x: 130, label: 'Results back' },
  { x: 340, label: '6 months' },
  { x: 440, label: 'Expired' },
];

export const ValidityDiagram: React.FC = () => (
  <figure className="my-8">
    <svg
      viewBox="0 0 480 140"
      role="img"
      aria-labelledby="validity-diagram-title"
      className="w-full text-[#5F8A68] dark:text-[#9CB8A4]"
    >
      <title id="validity-diagram-title">
        Search turnaround and validity against a typical transaction
      </title>
      <line x1="20" y1="70" x2="460" y2="70" stroke="currentColor" strokeWidth="1.5" />
      {TIMELINE_TICKS.map((tick) => (
        <g key={tick.label}>
          <line x1={tick.x} y1="62" x2={tick.x} y2="78" stroke="currentColor" strokeWidth="1.5" />
          <text x={tick.x} y="97" textAnchor="middle" fill="currentColor" fontSize="10">
            {tick.label}
          </text>
        </g>
      ))}
      <rect x="20" y="46" width="110" height="12" rx="3" fill="currentColor" opacity="0.5" />
      <text x="75" y="38" textAnchor="middle" fill="currentColor" fontSize="10">
        2–10 working days
      </text>
      <rect x="130" y="46" width="210" height="12" rx="3" fill="currentColor" opacity="0.22" />
      <text x="235" y="38" textAnchor="middle" fill="currentColor" fontSize="10">
        Valid for exchange
      </text>
    </svg>
    <figcaption className="mt-2 text-center font-[DM_Sans] text-sm text-[#6B7280] dark:text-[#94A3B8]">
      Most searches stay valid for six months. A slow chain can outlive them.
    </figcaption>
  </figure>
);
