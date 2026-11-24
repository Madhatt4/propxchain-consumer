// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  googleCalendarUrl,
  icsFile,
  outlookCalendarUrl,
  type CalendarEvent,
} from '@/lib/calendarLinks';

interface AddToCalendarProps {
  event: CalendarEvent;
  fileName?: string;
}

const ITEM_CLASS =
  'block w-full px-3 py-2 text-left text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 focus:bg-gray-100 dark:focus:bg-slate-700 focus:outline-none';

function downloadIcs(content: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function AddToCalendar({ event, fileName = 'completion-date.ics' }: AddToCalendarProps): ReactNode {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const google = googleCalendarUrl(event);
  const outlook = outlookCalendarUrl(event);
  const ics = icsFile(event);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointerDown = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  if (!google || !outlook || !ics) return null;

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
        className="text-sm text-teal-700 dark:text-teal-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
      >
        Add to calendar
      </button>
      {isOpen && (
        <ul
          id={menuId}
          className="absolute left-0 z-10 mt-1 min-w-[12rem] rounded border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-md py-1"
        >
          <li>
            <a href={google} target="_blank" rel="noopener noreferrer" className={ITEM_CLASS} onClick={() => setIsOpen(false)}>
              Google Calendar
            </a>
          </li>
          <li>
            <a href={outlook} target="_blank" rel="noopener noreferrer" className={ITEM_CLASS} onClick={() => setIsOpen(false)}>
              Outlook
            </a>
          </li>
          <li>
            <button
              type="button"
              className={ITEM_CLASS}
              onClick={() => {
                downloadIcs(ics, fileName);
                setIsOpen(false);
              }}
            >
              Apple / other (.ics)
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
