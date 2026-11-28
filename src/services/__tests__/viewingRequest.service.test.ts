// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke } } }));

import { sendViewingRequest, validateViewingRequest, type ViewingRequestInput } from '../viewingRequest.service';

const REQUEST: ViewingRequestInput = {
  slug: 'acme-homes-sg19-abc123', name: 'Jane Smith', email: 'jane@example.com', phone: '', preferredTimes: '', message: '', marketingConsent: false, website: '',
};

describe('viewingRequest.service', () => {
  beforeEach(() => invoke.mockReset());

  it('should post the request to the enquiry function', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await sendViewingRequest(REQUEST);
    expect(invoke).toHaveBeenCalledWith('estate-agent-enquiry', { body: REQUEST });
  });

  it('should tell the person to wait when too many requests were sent', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'non-2xx', context: { status: 429 } } });
    await expect(sendViewingRequest(REQUEST)).rejects.toThrow('Too many requests have been sent. Please try again in an hour.');
  });

  it('should ask the person to try again on any other failure, including an empty answer', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'non-2xx', context: { status: 502 } } });
    await expect(sendViewingRequest(REQUEST)).rejects.toThrow('Your request could not be sent. Please try again.');
    invoke.mockResolvedValue({ data: {}, error: null });
    await expect(sendViewingRequest(REQUEST)).rejects.toThrow('Your request could not be sent. Please try again.');
  });

  it('should accept a name and email with no phone, and reject blanks and a phone that is not one', () => {
    expect(validateViewingRequest({ name: 'Jane', email: ' jane@example.com ', phone: '' })).toEqual({});
    expect(validateViewingRequest({ name: ' ', email: 'jane@', phone: 'abc' })).toEqual({
      name: 'Enter your name', email: 'Enter your email address', phone: 'Enter a phone number, or leave this blank',
    });
  });
});
