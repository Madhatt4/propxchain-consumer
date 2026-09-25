import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import OneSearchProductListCard from '../OneSearchProductListCard';
import { getResidentialOneSearchCatalogue } from '../../../services/searchProviderData';

/** Product names carry '(', ')' and '+', which are regex operators. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderCard(
  overrides: Partial<React.ComponentProps<typeof OneSearchProductListCard>> = {},
) {
  const onRequest = vi.fn().mockResolvedValue(true);
  render(
    <OneSearchProductListCard
      areaCapabilities={[]}
      onRequest={onRequest}
      isRequesting={false}
      {...overrides}
    />,
  );
  // The list is behind a disclosure — open it so the tick-boxes exist.
  fireEvent.click(screen.getByRole('button', { expanded: false }));
  return { onRequest };
}

function tickFirstProduct(): void {
  const [first] = getResidentialOneSearchCatalogue();
  fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(escapeRegExp(first.name)) }));
}

describe('OneSearchProductListCard', () => {
  it('should disable the request button until something is ticked', () => {
    renderCard();
    expect(screen.getByRole('button', { name: /^request search/i })).toBeDisabled();
  });

  it('should confirm the request when it reaches OneSearch', async () => {
    const { onRequest } = renderCard();
    tickFirstProduct();
    fireEvent.click(screen.getByRole('button', { name: /^request 1 search$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Request sent./i)).toBeTruthy();
    });
    expect(onRequest).toHaveBeenCalledTimes(1);
  });

  // The whole point of the notification: these products have no price and no
  // paid order, so an undelivered request is lost. Claiming "request sent"
  // would be a lie the customer acts on.
  it('should not claim the request was sent when it did not reach OneSearch', async () => {
    const onRequest = vi.fn().mockResolvedValue(false);
    renderCard({ onRequest });
    tickFirstProduct();
    fireEvent.click(screen.getByRole('button', { name: /^request 1 search$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/couldn.t get your request through/i);
    });
    expect(screen.queryByText(/Request sent./i)).toBeNull();
  });

  it('should keep the selection and offer a retry after a failed request', async () => {
    const onRequest = vi.fn().mockResolvedValue(false);
    renderCard({ onRequest });
    tickFirstProduct();
    fireEvent.click(screen.getByRole('button', { name: /^request 1 search$/i }));

    const retry = await screen.findByRole('button', { name: /^try again$/i });
    expect(screen.getByText('1 selected')).toBeTruthy();

    fireEvent.click(retry);
    await waitFor(() => {
      expect(onRequest).toHaveBeenCalledTimes(2);
    });
    // Same basket both times — the user shouldn't have to re-tick.
    expect(onRequest.mock.calls[1][0]).toEqual(onRequest.mock.calls[0][0]);
  });

  it('should clear the failure notice when a retry succeeds', async () => {
    const onRequest = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    renderCard({ onRequest });
    tickFirstProduct();
    fireEvent.click(screen.getByRole('button', { name: /^request 1 search$/i }));

    fireEvent.click(await screen.findByRole('button', { name: /^try again$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Request sent./i)).toBeTruthy();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
