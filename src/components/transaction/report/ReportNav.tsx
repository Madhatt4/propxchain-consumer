// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The report's section bar. It sticks to the top while the reader scrolls and
 * marks the section in view. Links are plain in-page anchors, so they work
 * with the keyboard, without JavaScript and in the browser's back button.
 */

import { useEffect, useState, type ReactElement } from 'react';

import type { ReportSectionId } from './reportFindings';
import { R } from './reportStyles';

export interface NavItem {
  id: ReportSectionId;
  label: string;
}

export function ReportNav({ items }: { items: NavItem[] }): ReactElement {
  const [current, setCurrent] = useState<ReportSectionId>(items[0]?.id ?? 'summary');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const id = visible[0]?.target.id.replace(/^report-/, '') as ReportSectionId | undefined;
        if (id) setCurrent(id);
      },
      { rootMargin: '-64px 0px -60% 0px' },
    );
    for (const item of items) {
      const el = document.getElementById(`report-${item.id}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="Report sections" className={`sticky top-0 z-10 border-y ${R.rule} bg-[#FAFAF8] dark:bg-[#0B1120]`}>
      <ol className="flex gap-1 overflow-x-auto px-4 sm:px-7 lg:px-10">
        {items.map((item) => {
          const isCurrent = item.id === current;
          return (
            <li key={item.id}>
              <a
                href={`#report-${item.id}`}
                aria-current={isCurrent ? 'location' : undefined}
                className={`block whitespace-nowrap border-b-2 px-3 py-3 font-[DM_Sans] text-sm font-medium transition-colors ${
                  isCurrent
                    ? 'border-[#0D9488] text-[#0F766E] dark:text-[#14B8A6]'
                    : `border-transparent ${R.ink2} hover:text-[#1A1A1A] dark:hover:text-white`
                }`}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
