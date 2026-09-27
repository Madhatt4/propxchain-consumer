import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import PartnersPage from '../PartnersPage';
import SalesPage from '../SalesPage';
import SupportPage from '../SupportPage';

const mockSendEnquiry = vi.fn();

vi.mock('@/services/enquiry.service', () => ({
  sendEnquiry: (...args: unknown[]) => mockSendEnquiry(...args),
}));

function setField(name: string, value: string): void {
  const el = document.querySelector(`[name="${name}"]`);
  if (!el) throw new Error(`no field named ${name}`);
  fireEvent.change(el, { target: { value } });
}

function submitForm(): void {
  const form = document.querySelector('form');
  if (!form) throw new Error('no form');
  fireEvent.submit(form);
}

describe('public enquiry forms', () => {
  beforeEach(() => {
    mockSendEnquiry.mockReset();
    mockSendEnquiry.mockResolvedValue(undefined);
    // The pages report the outcome with alert(), which this jsdom does not define.
    window.alert = vi.fn();
  });

  it('should email a partner enquiry instead of writing it to a canister', async () => {
    render(<MemoryRouter><PartnersPage /></MemoryRouter>);
    setField('name', 'Sam Partner');
    setField('email', 'sam@example.com');
    setField('company', 'Example Ltd');
    setField('website', 'https://example.com');
    setField('partnerType', 'referral');
    setField('message', 'Hello');

    submitForm();

    await waitFor(() => expect(mockSendEnquiry).toHaveBeenCalledTimes(1));
    expect(mockSendEnquiry).toHaveBeenCalledWith({
      kind: 'partner',
      name: 'Sam Partner',
      email: 'sam@example.com',
      fields: { company: 'Example Ltd', website: 'https://example.com', partnerType: 'referral', message: 'Hello' },
      fax: '',
    });
  });

  it('should email a sales enquiry with its own fields', async () => {
    render(<MemoryRouter><SalesPage /></MemoryRouter>);
    setField('name', 'Sam Sales');
    setField('email', 'sam@example.com');
    setField('userType', 'developer');
    setField('volume', '6-20');

    submitForm();

    await waitFor(() => expect(mockSendEnquiry).toHaveBeenCalledTimes(1));
    expect(mockSendEnquiry.mock.calls[0][0]).toMatchObject({
      kind: 'sales',
      name: 'Sam Sales',
      fields: { userType: 'developer', volume: '6-20' },
    });
  });

  it('should email a support request with its topic and message', async () => {
    render(<MemoryRouter><SupportPage /></MemoryRouter>);
    setField('name', 'Sam Help');
    setField('email', 'sam@example.com');
    setField('subject', 'technical');
    setField('message', 'It broke');

    submitForm();

    await waitFor(() => expect(mockSendEnquiry).toHaveBeenCalledTimes(1));
    expect(mockSendEnquiry.mock.calls[0][0]).toEqual({
      kind: 'support',
      name: 'Sam Help',
      email: 'sam@example.com',
      fields: { subject: 'technical', message: 'It broke' },
      fax: '',
    });
  });

  it('should pass the honeypot through so the server can drop bot submissions', async () => {
    render(<MemoryRouter><SupportPage /></MemoryRouter>);
    setField('name', 'Bot');
    setField('email', 'bot@example.com');
    setField('subject', 'other');
    setField('message', 'spam');
    setField('fax', '0123');

    submitForm();

    await waitFor(() => expect(mockSendEnquiry).toHaveBeenCalledTimes(1));
    expect(mockSendEnquiry.mock.calls[0][0].fax).toBe('0123');
  });

  it('should show the email fallback when sending fails', async () => {
    mockSendEnquiry.mockRejectedValue(new Error('email failed'));
    render(<MemoryRouter><PartnersPage /></MemoryRouter>);
    setField('name', 'Sam Partner');
    setField('email', 'sam@example.com');
    setField('company', 'Example Ltd');
    setField('partnerType', 'referral');

    submitForm();

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('partners@propxchain.com')));
  });
});
