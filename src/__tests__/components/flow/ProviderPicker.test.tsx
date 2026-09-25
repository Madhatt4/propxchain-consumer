import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProviderPicker } from '../../../components/transaction/flow/ProviderPicker';
import { MOCK_AML_PROVIDERS } from '../../../data/mockProviders';

describe('ProviderPicker', () => {
  it('should render all providers sorted by rating descending', () => {
    render(<ProviderPicker providers={MOCK_AML_PROVIDERS} onSelect={vi.fn()} />);
    const names = screen.getAllByTestId('provider-name').map(el => el.textContent);
    expect(names[0]).toBe('ShieldPay'); // 4.8 rating
    expect(names[1]).toBe('Binderr');   // 4.2 rating
    expect(names[2]).toBe('SmartSearch'); // 3.4 rating
  });

  it('should show TOP RATED badge on first provider', () => {
    render(<ProviderPicker providers={MOCK_AML_PROVIDERS} onSelect={vi.fn()} />);
    expect(screen.getByText(/top rated/i)).toBeInTheDocument();
  });

  it('should show zero markup line', () => {
    render(<ProviderPicker providers={MOCK_AML_PROVIDERS} onSelect={vi.fn()} />);
    const markupLines = screen.getAllByText(/zero PropXchain markup/i);
    expect(markupLines.length).toBeGreaterThan(0);
  });

  it('should disclose the search margin instead of zero markup for search providers', () => {
    const searchProviders = MOCK_AML_PROVIDERS.map((p, i) => ({
      ...p,
      id: `search-${i}`,
      category: 'searches' as const,
    }));
    render(
      <ProviderPicker providers={searchProviders} onSelect={vi.fn()} selectedProviderId="search-0" />
    );
    expect(screen.getAllByText(/small search margin/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/zero PropXchain markup/i)).not.toBeInTheDocument();
  });

  it('should call onSelect with provider when Select button clicked', () => {
    const onSelect = vi.fn();
    render(<ProviderPicker providers={MOCK_AML_PROVIDERS} onSelect={onSelect} />);
    const buttons = screen.getAllByRole('button', { name: /select/i });
    fireEvent.click(buttons[0]);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'aml-shieldpay' }));
  });

  it('should highlight selected provider', () => {
    render(<ProviderPicker providers={MOCK_AML_PROVIDERS} onSelect={vi.fn()} selectedProviderId="aml-binderr" />);
    expect(screen.getByText(/selected/i)).toBeInTheDocument();
  });
});
