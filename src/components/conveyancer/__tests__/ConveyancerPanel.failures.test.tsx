import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ConveyancerPanel from '../ConveyancerPanel';
import { conveyancerService } from '../../../services/conveyancer.service';

/**
 * Instructing a firm could fail two ways and both were invisible: a thrown
 * error was logged to a console nobody had open, and a `success: false` result
 * fell through the `if` with no `else` at all — not even a log. The button
 * un-stuck and the screen was unchanged, which is exactly what a dead button
 * looks like.
 */

vi.mock('../../../services/conveyancer.service', () => ({
  conveyancerService: {
    searchFirms: vi.fn(),
    instructFirm: vi.fn(),
    getMatterStatus: vi.fn(),
  },
}));

const FIRM = {
  id: 'firm-1',
  name: 'Smith & Co Solicitors',
  address: '1 High Street, Bedford',
  rating: 4.5,
  reviewCount: 20,
  distance: 2,
  specialties: [],
  responseTime: '24h',
  phone: '01234 567890',
  cqsAccredited: true,
};

function renderPanel() {
  return render(<ConveyancerPanel transactionId="tx-1" propertyPostcode="MK40 1NN" />);
}

async function search() {
  fireEvent.click(await screen.findByRole('button', { name: /^Search$/i }));
}

describe('ConveyancerPanel — failed actions are visible', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(conveyancerService.searchFirms).mockResolvedValue({ success: true, firms: [FIRM] });
  });

  it('should say so when the firm search is refused rather than returning nothing', async () => {
    // `success: false` previously fell through with no else — the most silent
    // of the three paths, because it did not even log.
    vi.mocked(conveyancerService.searchFirms).mockResolvedValue({
      success: false,
      error: 'No panel firms cover MK40 1NN',
    });
    renderPanel();

    await search();

    expect(await screen.findByRole('alert')).toHaveTextContent('No panel firms cover MK40 1NN');
  });

  it('should say so when the search throws', async () => {
    vi.mocked(conveyancerService.searchFirms).mockRejectedValue(new Error('Failed to fetch'));
    renderPanel();

    await search();

    // Not "Failed to fetch" — the fallback names what the user was doing.
    expect(await screen.findByRole('alert')).toHaveTextContent(/look up firms for MK40 1NN/i);
  });

  it('should say so when instructing a firm is refused, and not claim it was instructed', async () => {
    vi.mocked(conveyancerService.instructFirm).mockResolvedValue({
      success: false,
      error: 'That firm is not accepting new matters',
    });
    renderPanel();
    await search();

    fireEvent.click(await screen.findByRole('button', { name: /instruct/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That firm is not accepting new matters',
    );
    // The "Instructed" badge must not appear — the whole risk is a user
    // believing a solicitor has been engaged when nothing was sent.
    expect(screen.queryByText(/^Instructed$/)).not.toBeInTheDocument();
  });

  it('should name the firm and confirm nothing was sent when instruction throws', async () => {
    vi.mocked(conveyancerService.instructFirm).mockRejectedValue(new Error('Failed to fetch'));
    renderPanel();
    await search();

    fireEvent.click(await screen.findByRole('button', { name: /instruct/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Smith & Co Solicitors/);
    expect(alert).toHaveTextContent(/Nothing has been sent to them/i);
  });

  it('should fall back when the service returns a non-string error, not render an object', async () => {
    // `result.error || fallback` used to pass the payload straight to React.
    // An object child throws "Objects are not valid as a React child" — a blank
    // screen where a handled failure should be. Both the throw path and the
    // success:false path now normalise through actionErrorMessage.
    vi.mocked(conveyancerService.searchFirms).mockResolvedValue({
      success: false,
      error: { code: 500, detail: 'upstream' } as unknown as string,
    });
    renderPanel();

    await search();

    expect(await screen.findByRole('alert')).toHaveTextContent(/look up firms for MK40 1NN/i);
  });

  it('should clear a previous failure when the user tries again', async () => {
    vi.mocked(conveyancerService.searchFirms)
      .mockResolvedValueOnce({ success: false, error: 'Lookup unavailable' })
      .mockResolvedValue({ success: true, firms: [FIRM] });
    renderPanel();

    await search();
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await search();

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('should stay silent when everything works', async () => {
    vi.mocked(conveyancerService.instructFirm).mockResolvedValue({
      success: true,
      matterRef: 'M-123',
    });
    renderPanel();
    await search();

    fireEvent.click(await screen.findByRole('button', { name: /instruct/i }));

    await waitFor(() => {
      expect(screen.getByText('Instructed')).toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
