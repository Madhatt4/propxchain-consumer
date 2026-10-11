import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfferExpiryLine } from '../OfferExpiryLine';

describe('OfferExpiryLine', () => {
  it('says nothing while the offer has time left or no date is confirmed', () => {
    const { container, rerender } = render(<OfferExpiryLine transactionId="tx_1" expiryOverride={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<OfferExpiryLine transactionId="tx_1" expiryOverride={{ state: 'ok', expiresOn: '2027-03-31', daysLeft: 171 }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('warns within a month, and alerts once expired', () => {
    const { rerender } = render(<OfferExpiryLine transactionId="tx_1" expiryOverride={{ state: 'soon', expiresOn: '2026-11-01', daysLeft: 21 }} />);
    expect(screen.getByTestId('offer-expiry-line')).toHaveTextContent('expires on 1 November 2026');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    rerender(<OfferExpiryLine transactionId="tx_1" expiryOverride={{ state: 'expired', expiresOn: '2026-10-01', daysLeft: -10 }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('expired on 1 October 2026');
  });
});
