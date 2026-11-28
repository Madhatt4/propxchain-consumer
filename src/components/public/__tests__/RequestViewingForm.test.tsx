// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/viewingRequest.service', async () => {
  const actual = await vi.importActual<typeof import('@/services/viewingRequest.service')>('@/services/viewingRequest.service');
  return { ...actual, sendViewingRequest: vi.fn() };
});

import { sendViewingRequest } from '@/services/viewingRequest.service';
import { RequestViewingForm } from '../RequestViewingForm';

const mockSend = vi.mocked(sendViewingRequest);

function renderForm(): void {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RequestViewingForm slug="acme-homes-sg19-abc123" agencyName="Acme Homes" />
    </QueryClientProvider>,
  );
}

function fill(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('RequestViewingForm', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue(undefined);
  });

  it('should say who receives the details before anything is typed', () => {
    renderForm();
    expect(screen.getByText(/Your details go to Acme Homes, the estate agent for this property/)).toBeInTheDocument();
  });

  it('should send what was typed for this property, with marketing consent off unless ticked', async () => {
    renderForm();
    fill('Your name', 'Jane Smith');
    fill('Email', 'jane@example.com');
    fill('Phone (optional)', '07700 900123');
    fill('When could you view? (optional)', 'Saturday morning');
    fill('Message (optional)', 'Is there parking?');
    fireEvent.click(screen.getByRole('button', { name: 'Request a viewing' }));
    await waitFor(() => expect(mockSend).toHaveBeenCalledWith({
      slug: 'acme-homes-sg19-abc123', name: 'Jane Smith', email: 'jane@example.com', phone: '07700 900123',
      preferredTimes: 'Saturday morning', message: 'Is there parking?', marketingConsent: false, website: '',
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('Acme Homes has your request and will contact you to arrange a viewing.');
    expect(screen.queryByRole('button', { name: 'Request a viewing' })).not.toBeInTheDocument();
  });

  it('should pass consent on only when the box is ticked', async () => {
    renderForm();
    fill('Your name', 'Jane Smith');
    fill('Email', 'jane@example.com');
    fireEvent.click(screen.getByRole('checkbox', { name: /Acme Homes may email me about other properties/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Request a viewing' }));
    await waitFor(() => expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ marketingConsent: true })));
  });

  it('should ask for a name and a real email address, and send nothing without them', async () => {
    renderForm();
    fill('Email', 'not-an-email');
    fill('Phone (optional)', 'ring me');
    fireEvent.click(screen.getByRole('button', { name: 'Request a viewing' }));
    expect(await screen.findByText('Enter your name')).toBeInTheDocument();
    expect(screen.getByText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByText('Enter a phone number, or leave this blank')).toBeInTheDocument();
    expect(screen.getByLabelText('Your name')).toHaveAttribute('aria-invalid', 'true');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should keep what was typed and show the reason when sending fails', async () => {
    mockSend.mockRejectedValue(new Error('Your request could not be sent. Please try again.'));
    renderForm();
    fill('Your name', 'Jane Smith');
    fill('Email', 'jane@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Request a viewing' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your request could not be sent. Please try again.');
    expect(screen.getByLabelText('Your name')).toHaveValue('Jane Smith');
  });

  it('should keep the trap field for bots out of the way of people and screen readers', () => {
    renderForm();
    const trap = document.getElementById('viewing-request-website')!;
    expect(trap).toHaveAttribute('tabindex', '-1');
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
