import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ThemeProvider } from '../../contexts/ThemeContext';

import TA6FormPage from '../../pages/TA6FormPage';
import { emptyTA6Form } from '../../types/ta6.types';
import type { TA6FormProps } from '../../components/forms/TA6Form';

const mockGetTA6 = vi.fn();
const mockHasAcked = vi.fn();
const mockUpdateTA6 = vi.fn();
const mockAcknowledge = vi.fn();

const mockDealSide = vi.fn<() => string | null>(() => 'seller');
vi.mock('@/hooks/useDealSide', () => ({ useDealSide: () => mockDealSide() }));

vi.mock('@/services/icp.service', () => ({
  icpService: {
    getTA6: (...args: unknown[]) => mockGetTA6(...args),
    hasAcknowledgedTA6Wording: (...args: unknown[]) => mockHasAcked(...args),
    updateTA6: (...args: unknown[]) => mockUpdateTA6(...args),
    acknowledgeTA6Wording: (...args: unknown[]) => mockAcknowledge(...args),
  },
}));

vi.mock('@/components/forms/ta6/widgets/ta6Uploader', () => ({
  makeTa6Uploader: () => async () => ({
    documentId: 'doc-1',
    advisory: Promise.resolve(null),
    classification: Promise.resolve(null),
  }),
}));

let lastFormProps: TA6FormProps | null = null;
vi.mock('@/components/forms/TA6Form', () => ({
  default: (props: TA6FormProps) => {
    lastFormProps = props;
    return <div data-testid="ta6-form-stub" />;
  },
}));

function renderPage(): void {
  render(
    <ThemeProvider>
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/transaction/TX-1/forms/ta6',
          state: { postcode: 'SG19 2AB', propertyAddress: 'The Barn House, Sandy' },
        },
      ]}
    >
      <Routes>
        <Route path="/transaction/:id/forms/ta6" element={<TA6FormPage />} />
      </Routes>
    </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('TA6FormPage', () => {
  beforeEach(() => {
    lastFormProps = null;
    mockDealSide.mockReset().mockReturnValue('seller');
    mockGetTA6.mockReset().mockResolvedValue(null);
    mockHasAcked.mockReset().mockResolvedValue(false);
    mockUpdateTA6.mockReset().mockResolvedValue(undefined);
    mockAcknowledge.mockReset().mockResolvedValue(undefined);
  });

  it('should render the form full-page with a back link to the transaction flow', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByTestId('ta6-form-stub')).toBeInTheDocument());
    const back = screen.getByRole('link', { name: /Back to transaction/i });
    expect(back).toHaveAttribute('href', '/transaction/TX-1/flow');
  });

  it('should pass transaction context and acknowledgment state through to the form', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByTestId('ta6-form-stub')).toBeInTheDocument());
    expect(mockGetTA6).toHaveBeenCalledWith('TX-1');
    expect(lastFormProps?.transactionId).toBe('TX-1');
    expect(lastFormProps?.postcode).toBe('SG19 2AB');
    expect(lastFormProps?.propertyAddress).toBe('The Barn House, Sandy');
    expect(lastFormProps?.hasAcknowledged).toBe(false);
    expect(typeof lastFormProps?.uploadFile).toBe('function');
  });

  it('should save via updateTA6 and stay on the page for per-section saves', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByTestId('ta6-form-stub')).toBeInTheDocument());
    await lastFormProps?.onSave(emptyTA6Form());
    expect(mockUpdateTA6).toHaveBeenCalledWith('TX-1', expect.anything());
    expect(screen.getByTestId('ta6-form-stub')).toBeInTheDocument();
  });

  it('should show the all-sections-saved banner when a save completes the form', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('ta6-form-stub')).toBeInTheDocument());

    expect(screen.queryByText(/All sections answered and saved/i)).not.toBeInTheDocument();
  });

  // Typing the form URL must not give the buyer an editable TA6.
  it('should open read-only for the buyer, with no upload or acknowledgment', async () => {
    mockDealSide.mockReturnValue('buyer');
    renderPage();

    await waitFor(() => expect(screen.getByTestId('ta6-form-stub')).toBeInTheDocument());
    expect(lastFormProps?.readOnly).toBe(true);
    expect(lastFormProps?.uploadFile).toBeUndefined();
    expect(lastFormProps?.onAcknowledge).toBeUndefined();
  });

  it("should wait for the viewer's side before showing the form", () => {
    mockDealSide.mockReturnValue(null);
    renderPage();

    expect(screen.queryByTestId('ta6-form-stub')).not.toBeInTheDocument();
  });

  it('should keep the form editable for an agent working the seller side', async () => {
    mockDealSide.mockReturnValue('other');
    renderPage();

    await waitFor(() => expect(screen.getByTestId('ta6-form-stub')).toBeInTheDocument());
    expect(lastFormProps?.readOnly).toBe(false);
  });
});
