import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { SearchSignOffCard, type SearchSignOffCardProps } from '../SearchSignOffCard';
import type { SearchSignOffRecord } from '@/services/searchSignOff.service';

const HASH = 'b'.repeat(64);

function record(overrides: Partial<SearchSignOffRecord> = {}): SearchSignOffRecord {
  return {
    id: 's1',
    signerUserId: 'buyer-1',
    signerRole: 'buyer',
    searchOrderIds: ['o1', 'o2'],
    notes: null,
    signedAt: '2026-09-27T10:00:00Z',
    recordHash: HASH,
    revokedAt: null,
    revokeReason: null,
    ...overrides,
  };
}

function renderCard(props: Partial<SearchSignOffCardProps> = {}): SearchSignOffCardProps {
  const full: SearchSignOffCardProps = {
    signOffs: [],
    myRole: null,
    myUserId: null,
    resultsBack: 2,
    onSignOff: vi.fn().mockResolvedValue(undefined),
    onRevoke: vi.fn().mockResolvedValue(undefined),
    ...props,
  };
  render(<SearchSignOffCard {...full} />);
  return full;
}

describe('SearchSignOffCard', () => {
  it('should show both signer rows as not signed off to a seller', () => {
    renderCard();

    expect(screen.getAllByText('Not signed off')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /sign off/i })).not.toBeInTheDocument();
  });

  it('should let the buyer sign off with notes', async () => {
    const props = renderCard({ myRole: 'buyer', myUserId: 'buyer-1' });

    fireEvent.change(screen.getByLabelText('Sign-off notes'), { target: { value: 'Looks fine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign off 2 searches' }));

    await waitFor(() => expect(props.onSignOff).toHaveBeenCalledWith('Looks fine'));
  });

  it('should not offer signing before any results are back', () => {
    renderCard({ myRole: 'conveyancer', myUserId: 'conv-1', resultsBack: 0 });

    expect(screen.getByText(/once search results are back/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign off/i })).not.toBeInTheDocument();
  });

  it('should show a live sign-off with its hash, and let only its signer revoke', async () => {
    const props = renderCard({ signOffs: [record()], myRole: 'buyer', myUserId: 'buyer-1' });

    expect(screen.getByText(/On the audit trail · bbbbbbbbbbbb/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Sign-off notes')).not.toBeInTheDocument();
    const revoke = screen.getByRole('button', { name: 'Revoke' });
    expect(revoke).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Reason for revoking'), { target: { value: 'New results' } });
    fireEvent.click(revoke);

    await waitFor(() => expect(props.onRevoke).toHaveBeenCalledWith('s1', 'New results'));
  });

  it("should not let the conveyancer revoke the buyer's sign-off, but let them add their own", () => {
    renderCard({ signOffs: [record()], myRole: 'conveyancer', myUserId: 'conv-1' });

    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign off 2 searches' })).toBeInTheDocument();
  });

  it('should list revoked sign-offs with their reason', () => {
    renderCard({ signOffs: [record({ revokedAt: '2026-09-28T10:00:00Z', revokeReason: 'Wrong pack' })] });

    expect(screen.getByText(/Revoked sign-offs \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Wrong pack/)).toBeInTheDocument();
  });

  it('should show the server refusal when signing fails', async () => {
    renderCard({
      myRole: 'buyer',
      myUserId: 'buyer-1',
      onSignOff: vi.fn().mockRejectedValue(new Error('no search results are back yet')),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sign off 2 searches' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('no search results are back yet');
  });
});
