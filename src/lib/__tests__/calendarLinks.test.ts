// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { googleCalendarUrl, icsFile, outlookCalendarUrl } from '../calendarLinks';

const NOW = new Date(Date.UTC(2026, 10, 24, 9, 30, 15));

describe('googleCalendarUrl', () => {
  it('should encode the title and details and use an all-day range ending the next day', () => {
    const url = googleCalendarUrl({ title: 'Completion: 1 High St, Sandy & Co', date: '2026-12-15', details: 'Agreed date; see PropXchain' });

    const parsed = new URL(url ?? '');
    expect(parsed.origin + parsed.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(parsed.searchParams.get('action')).toBe('TEMPLATE');
    expect(parsed.searchParams.get('text')).toBe('Completion: 1 High St, Sandy & Co');
    expect(parsed.searchParams.get('dates')).toBe('20261215/20261216');
    expect(parsed.searchParams.get('details')).toBe('Agreed date; see PropXchain');
    expect(url).not.toContain('Sandy & Co');
  });

  it('should roll the end date over a month and a year boundary', () => {
    expect(googleCalendarUrl({ title: 'x', date: '2026-01-31' })).toContain('dates=20260131%2F20260201');
    expect(googleCalendarUrl({ title: 'x', date: '2026-12-31' })).toContain('dates=20261231%2F20270101');
  });

  it('should handle the leap day', () => {
    expect(googleCalendarUrl({ title: 'x', date: '2028-02-28' })).toContain('20280228%2F20280229');
    expect(googleCalendarUrl({ title: 'x', date: '2028-02-29' })).toContain('20280229%2F20280301');
  });

  it('should omit details when none are given', () => {
    expect(googleCalendarUrl({ title: 'x', date: '2026-12-15' })).not.toContain('details');
  });

  it('should accept an ISO datetime by using its date part', () => {
    expect(googleCalendarUrl({ title: 'x', date: '2026-12-15T00:00:00.000Z' })).toContain('20261215');
  });

  it.each(['', 'not a date', '2026-13-01', '2026-02-30', '15/12/2026'])(
    'should return null for the invalid date %j',
    (date) => {
      expect(googleCalendarUrl({ title: 'x', date })).toBeNull();
    },
  );
});

describe('outlookCalendarUrl', () => {
  it('should build an all-day compose link with the next day as the end', () => {
    const url = outlookCalendarUrl({ title: 'Completion: your move', date: '2026-12-31', details: 'Body, text' });

    const parsed = new URL(url ?? '');
    expect(parsed.origin + parsed.pathname).toBe('https://outlook.live.com/calendar/0/deeplink/compose');
    expect(parsed.searchParams.get('subject')).toBe('Completion: your move');
    expect(parsed.searchParams.get('startdt')).toBe('2026-12-31');
    expect(parsed.searchParams.get('enddt')).toBe('2027-01-01');
    expect(parsed.searchParams.get('allday')).toBe('true');
    expect(parsed.searchParams.get('body')).toBe('Body, text');
  });

  it('should return null for an invalid date', () => {
    expect(outlookCalendarUrl({ title: 'x', date: '2026-00-10' })).toBeNull();
  });
});

describe('icsFile', () => {
  it('should produce a CRLF-terminated VCALENDAR with all-day date values', () => {
    const ics = icsFile({ title: 'Completion', date: '2026-12-31', details: 'Details' }, NOW) ?? '';

    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(ics).toContain('VERSION:2.0\r\n');
    expect(ics).toContain('DTSTAMP:20261124T093015Z\r\n');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231\r\n');
    expect(ics).toContain('DTEND;VALUE=DATE:20270101\r\n');
    expect(ics).toContain('SUMMARY:Completion\r\n');
    expect(ics).toMatch(/UID:[^\r\n]+@propxchain\.com\r\n/);
  });

  it('should escape commas, semicolons, backslashes and newlines in text fields', () => {
    const ics = icsFile({ title: 'A, B; C', date: '2026-12-15', details: 'line1\nline2\\end' }, NOW) ?? '';

    expect(ics).toContain('SUMMARY:A\\, B\\; C\r\n');
    expect(ics).toContain('DESCRIPTION:line1\\nline2\\\\end\r\n');
  });

  it('should omit DESCRIPTION when there are no details', () => {
    expect(icsFile({ title: 'x', date: '2026-12-15' }, NOW)).not.toContain('DESCRIPTION');
  });

  it('should fold lines longer than 75 characters', () => {
    const ics = icsFile({ title: 'x', date: '2026-12-15', details: 'a'.repeat(200) }, NOW) ?? '';

    const lines = ics.split('\r\n');
    expect(lines.every((line) => line.length <= 75)).toBe(true);
    expect(lines.some((line) => line.startsWith(' a'))).toBe(true);
  });

  it('should return null for an invalid date', () => {
    expect(icsFile({ title: 'x', date: '2026-02-30' }, NOW)).toBeNull();
  });
});
