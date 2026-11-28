// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { supabase } from '@/lib/supabase';

const ENQUIRY_FN = 'estate-agent-enquiry';
const TOO_MANY_REQUESTS = 429;

export interface ViewingRequestInput {
  slug: string;
  name: string;
  email: string;
  phone: string;
  preferredTimes: string;
  message: string;
  marketingConsent: boolean;
  website: string;
}

export type ViewingRequestErrors = Partial<Record<'name' | 'email' | 'phone', string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+() -]{6,30}$/;

export function validateViewingRequest(input: Pick<ViewingRequestInput, 'name' | 'email' | 'phone'>): ViewingRequestErrors {
  const errors: ViewingRequestErrors = {};
  if (input.name.trim() === '') errors.name = 'Enter your name';
  if (!EMAIL_PATTERN.test(input.email.trim())) errors.email = 'Enter your email address';
  if (input.phone.trim() !== '' && !PHONE_PATTERN.test(input.phone.trim())) errors.phone = 'Enter a phone number, or leave this blank';
  return errors;
}

export async function sendViewingRequest(input: ViewingRequestInput): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean }>(ENQUIRY_FN, { body: input });
  if (!error && data?.ok) return;
  const status = (error as { context?: { status?: number } } | null)?.context?.status ?? 0;
  if (status === TOO_MANY_REQUESTS) throw new Error('Too many requests have been sent. Please try again in an hour.');
  throw new Error('Your request could not be sent. Please try again.');
}
