import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ThemeProvider } from '../../contexts/ThemeContext';

import TA10FormPage from '../../pages/TA10FormPage';

const mockGetTA10 = vi.fn();
const mockUpdateTA10 = vi.fn();

vi.mock('@/services/icp.service', () => ({
  icpService: {
    getTA10: (...args: unknown[]) => mockGetTA10(...args),
    updateTA10: (...args: unknown[]) => mockUpdateTA10(...args),
  },
}));

vi.mock('@/components/forms/TA10Form', () => ({
  default: ({ transactionId }: { transactionId: string }) => (
    <div data-testid="ta10-form-stub">{transactionId}</div>
  ),
}));

function renderPage(): void {
  render(
    <ThemeProvider>
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/transaction/TX-9/forms/ta10',
          state: { propertyAddress: 'High Street, Sandy' },
        },
      ]}
    >
      <Routes>
        <Route path="/transaction/:id/forms/ta10" element={<TA10FormPage />} />
      </Routes>
    </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('TA10FormPage', () => {
  beforeEach(() => {
    mockGetTA10.mockReset().mockResolvedValue(null);
    mockUpdateTA10.mockReset().mockResolvedValue(undefined);
  });

  it('should render the form full-page with a back link to the transaction flow', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByTestId('ta10-form-stub')).toBeInTheDocument());
    expect(mockGetTA10).toHaveBeenCalledWith('TX-9');
    const back = screen.getByRole('link', { name: /Back to transaction/i });
    expect(back).toHaveAttribute('href', '/transaction/TX-9/flow');
    expect(screen.getByText('High Street, Sandy')).toBeInTheDocument();
  });

  it('should show a load error instead of the form when the fetch fails', async () => {
    mockGetTA10.mockRejectedValueOnce(new Error('boom'));
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/Could not load the form/)).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('ta10-form-stub')).not.toBeInTheDocument();
  });
});
