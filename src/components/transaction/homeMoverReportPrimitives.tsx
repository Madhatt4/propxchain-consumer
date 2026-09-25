// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Building blocks shared by the Home Mover Report detail sections: the section
 * frame, muted notes, the "+N more" cap note and the capped entity list.
 */

import React from 'react';

import type { PlanningEntity } from '../../services/propertyIntelligenceService';
import { truncate } from './PropertyIntelSections';
import { MAX_ENTITIES } from './homeMoverReportFormat';
import { STYLES } from './homeMoverReportStyles';

export const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={STYLES.section}>
    <h2 style={STYLES.h2}>{title}</h2>
    {children}
  </div>
);

export const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ ...STYLES.muted, margin: 0 }}>{children}</p>
);

export const MoreNote: React.FC<{ total: number; shown: number }> = ({ total, shown }) =>
  total > shown ? (
    <p style={{ ...STYLES.muted, margin: '2px 0 0' }}>+{total - shown} more — see the online report.</p>
  ) : null;

interface EntityListProps {
  items: PlanningEntity[];
  heading?: string;
  /** What to print after the name, if anything: reference, grade or dataset. */
  extra?: (e: PlanningEntity) => string | null;
  /** Article 4 directions carry a free-text summary worth a second line. */
  withDetail?: boolean;
}

export const EntityList: React.FC<EntityListProps> = ({ items, heading, extra, withDetail }) => {
  if (items.length === 0) return null;
  const shown = items.slice(0, MAX_ENTITIES);
  return (
    <div>
      {heading && <p style={STYLES.subhead}>{heading} ({items.length})</p>}
      <ul style={STYLES.list}>
        {shown.map((e) => {
          const suffix = extra?.(e);
          return (
            <li key={e.entity} style={STYLES.bullet}>
              {e.name}
              {suffix ? <span style={STYLES.muted}> {suffix}</span> : null}
              {withDetail && e.detail ? (
                <span style={{ ...STYLES.muted, display: 'block' }}>{truncate(e.detail, 220)}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <MoreNote total={items.length} shown={shown.length} />
    </div>
  );
};
