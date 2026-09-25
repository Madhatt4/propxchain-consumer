import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ThemeProvider } from '../../contexts/ThemeContext';

import TA7FormPage from '../../pages/TA7FormPage';

const mockGetTA7 = vi.fn();
const mockUpdateTA7 = vi.fn();

vi.mock('@/services/icp.service', () => ({
  icpService: {
    getTA7: (...args: unknown[]) => mockGetTA7(...args),
    updateTA7: (...args: unknown[]) => mockUpdateTA7(...args),
  },
}));

vi.mock('@/components/forms/TA7Form', () => ({
  default: ({ transactionId, isLeasehold }: { transactionId: string; isLeasehold: boolean }) => (
    <div data-testid="ta7-form-stub">
      {transactionId}:{String(isLeasehold)}
    </div>
  ),
}));

function renderPage(): void {
  render(
    <ThemeProvider>
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/transaction/TX-3/forms/ta7',
          state: { propertyAddress: 'Flat 2, High Street, Sandy', isLeasehold: true },
        },
      ]}
    >
      <Routes>
        <Route path="/transaction/:id/forms/ta7" element={<TA7FormPage />} />
      </Routes>
    </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('TA7FormPage', () => {
  beforeEach(() => {
    mockGetTA7.mockReset().mockResolvedValue(null);
    mockUpdateTA7.mockReset().mockResolvedValue(undefined);
  });

  it('should render the form full-page with a back link and leasehold flag', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByTestId('ta7-form-stub')).toBeInTheDocument());
    expect(mockGetTA7).toHaveBeenCalledWith('TX-3');
    expect(screen.getByTestId('ta7-form-stub')).toHaveTextContent('TX-3:true');
    const back = screen.getByRole('link', { name: /Back to transaction/i });
    expect(back).toHaveAttribute('href', '/transaction/TX-3/flow');
  });

  it('should show a load error instead of the form when the fetch fails', async () => {
    mockGetTA7.mockRejectedValueOnce(new Error('boom'));
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/Could not load the form/)).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('ta7-form-stub')).not.toBeInTheDocument();
  });
});
