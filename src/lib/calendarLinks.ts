// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

export interface CalendarEvent {
  title: string;
  date: string;
  details?: string;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/;
const ICS_LINE_LIMIT = 73;

function parseDate(date: string): Date | null {
  const match = DATE_PATTERN.exec(date);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isSameDay =
    parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  return isSameDay ? parsed : null;
}

function isoDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

function nextDay(at: Date): Date {
  return new Date(at.getTime() + 24 * 60 * 60 * 1000);
}

function compactDay(at: Date): string {
  return isoDay(at).replace(/-/g, '');
}

export function googleCalendarUrl(event: CalendarEvent): string | null {
  const start = parseDate(event.date);
  if (!start) return null;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${compactDay(start)}/${compactDay(nextDay(start))}`,
  });
  if (event.details) params.set('details', event.details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(event: CalendarEvent): string | null {
  const start = parseDate(event.date);
  if (!start) return null;
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: isoDay(start),
    enddt: isoDay(nextDay(start)),
    allday: 'true',
  });
  if (event.details) params.set('body', event.details);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function foldLine(line: string): string {
  const chars = Array.from(line);
  if (chars.length <= ICS_LINE_LIMIT) return line;
  const chunks: string[] = [];
  for (let i = 0; i < chars.length; i += ICS_LINE_LIMIT) {
    chunks.push(chars.slice(i, i + ICS_LINE_LIMIT).join(''));
  }
  return chunks.join('\r\n ');
}

function stamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

export function icsFile(event: CalendarEvent, now: Date = new Date()): string | null {
  const start = parseDate(event.date);
  if (!start) return null;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PropXchain//Add to calendar//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${compactDay(start)}-${slug(event.title)}@propxchain.com`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;VALUE=DATE:${compactDay(start)}`,
    `DTEND;VALUE=DATE:${compactDay(nextDay(start))}`,
    `SUMMARY:${escapeText(event.title)}`,
  ];
  if (event.details) lines.push(`DESCRIPTION:${escapeText(event.details)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

export function completionCalendarEvent(propertyAddress: string | null | undefined, date: string): CalendarEvent {
  return {
    title: `Completion: ${propertyAddress?.trim() || 'your move'}`,
    date,
    details: 'The agreed completion date for your move, from PropXchain.',
  };
}

export function isCalendarDate(date: string | null | undefined): date is string {
  return Boolean(date && parseDate(date));
}
