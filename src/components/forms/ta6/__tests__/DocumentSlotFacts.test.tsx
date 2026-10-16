// Suggested certificate facts on the upload row: "We read this as ...", with
// Confirm / Not right per fact, and nothing at all when there are none.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { DocumentSlot } from '../widgets/DocumentSlot';
import type { TA6Upload } from '../widgets/ta6Uploader';
import type { DocFact } from '../../../../services/documentFacts.service';

const IN_DATE: DocFact = { id: 'f1', factKey: 'gas_safety.in_date', value: 'true', confidence: 0.9, method: 'jev' };
const PASSED: DocFact = { id: 'f2', factKey: 'gas_safety.passed', value: 'true', confidence: 0.94, method: 'jev' };
const CONFIRM_PASSED = 'Confirm: Every gas appliance passed';

function upload(facts: DocFact[], decide: TA6Upload['decide']): TA6Upload {
  return {
    documentId: '42',
    classification: Promise.resolve(null),
    facts: Promise.resolve(facts),
    decide,
  };
}

function renderSlot(result: TA6Upload, onChange = vi.fn()): void {
  render(
    <DocumentSlot
      refCode="11.4"
      prompt={undefined}
      value={{ status: 'not-answered', documentId: null }}
      onChange={onChange}
      onUpload={() => Promise.resolve(result)}
    />,
  );
  const file = new File(['jpg'], 'gas.jpg', { type: 'image/jpeg' });
  fireEvent.change(screen.getByLabelText('11.4 attachment'), { target: { files: [file] } });
}

describe('DocumentSlot suggested facts', () => {
  it('should list each suggested fact with Confirm and Not right', async () => {
    renderSlot(upload([IN_DATE, PASSED], vi.fn()));

    expect(await screen.findByText('We read this as:')).toBeTruthy();
    expect(screen.getByText('Gas safety record is in date (checked today)')).toBeTruthy();
    expect(screen.getByRole('button', { name: CONFIRM_PASSED })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not right: Every gas appliance passed' })).toBeTruthy();
  });

  it('should confirm one fact and show it as confirmed', async () => {
    const decide = vi.fn().mockResolvedValue({ decision: 'confirmed', anchored: true });
    renderSlot(upload([PASSED], decide));

    fireEvent.click(await screen.findByRole('button', { name: CONFIRM_PASSED }));

    await waitFor(() => expect(screen.getByText('Confirmed')).toBeTruthy());
    expect(decide).toHaveBeenCalledWith('f2', 'confirmed');
    expect(screen.queryByRole('button', { name: /Confirm:/ })).toBeNull();
  });

  it('should say when a decision saved but the audit trail entry did not', async () => {
    const decide = vi.fn().mockResolvedValue({ decision: 'rejected', anchored: false });
    renderSlot(upload([PASSED], decide));

    fireEvent.click(await screen.findByRole('button', { name: 'Not right: Every gas appliance passed' }));

    await waitFor(() => expect(screen.getByText(/Marked not right/)).toBeTruthy());
    expect(screen.getByText(/audit trail entry pending/)).toBeTruthy();
  });

  it('should show the refusal and keep the buttons when the save fails', async () => {
    const decide = vi.fn().mockRejectedValue(new Error('Only the seller can confirm these.'));
    renderSlot(upload([PASSED], decide));

    fireEvent.click(await screen.findByRole('button', { name: CONFIRM_PASSED }));

    await waitFor(() => expect(screen.getByText('Only the seller can confirm these.')).toBeTruthy());
    expect(screen.getByRole('button', { name: CONFIRM_PASSED })).toBeTruthy();
  });

  it('should show nothing when the upload has no facts', async () => {
    const onChange = vi.fn();
    renderSlot(upload([], vi.fn()), onChange);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ status: 'attached', documentId: '42' }));
    await Promise.resolve();
    expect(screen.queryByText('We read this as:')).toBeNull();
  });
});
