import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Provider } from '../../components/providers/types';
import { ProviderCard } from '../../components/providers/ProviderCard';

const mockProvider: Provider = {
  id: 'test-1',
  name: 'Test Provider',
  logo: 'TP',
  tagline: 'Test tagline',
  tier: 1,
  price: 24.99,
  turnaround: '< 5 minutes',
  rating: 4.5,
  reviews: 100,
  features: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4'],
  highlight: 'Recommended',
  regulated: 'FCA Authorised',
  location: 'Bedford',
};

describe('ProviderCard', () => {
  const defaultProps = {
    provider: mockProvider,
    selected: false,
    onSelect: vi.fn(),
  };

  it('should render provider name, tagline, and price', () => {
    render(<ProviderCard {...defaultProps} />);

    expect(screen.getByText('Test Provider')).toBeDefined();
    expect(screen.getByText('Test tagline')).toBeDefined();
    expect(screen.getByText('£24.99')).toBeDefined();
  });

  it('should render "Select" button when not selected', () => {
    render(<ProviderCard {...defaultProps} selected={false} />);
    expect(screen.getByText('Select')).toBeDefined();
    expect(screen.queryByText('Selected')).toBeNull();
  });

  it('should render "Selected" button with checkmark when selected', () => {
    render(<ProviderCard {...defaultProps} selected={true} />);
    expect(screen.getByText('Selected')).toBeDefined();
    expect(screen.queryByText('Select')).toBeNull();
  });

  it('should render highlight badge when highlight prop exists', () => {
    render(<ProviderCard {...defaultProps} />);
    expect(screen.getByText('Recommended')).toBeDefined();
  });

  it('should not render highlight badge when no highlight', () => {
    const noHighlightProvider = { ...mockProvider, highlight: undefined };
    render(
      <ProviderCard {...defaultProps} provider={noHighlightProvider} />,
    );
    expect(screen.queryByText('Recommended')).toBeNull();
  });

  it('should render location when provided', () => {
    render(<ProviderCard {...defaultProps} />);
    expect(screen.getByText('Bedford')).toBeDefined();
  });

  it('should render distance in miles when distanceMiles is set', () => {
    const distanceProvider = { ...mockProvider, distanceMiles: 12.3 };
    render(
      <ProviderCard {...defaultProps} provider={distanceProvider} />,
    );
    expect(screen.getByText('12.3 mi')).toBeDefined();
    // distanceMiles should override location text
    expect(screen.queryByText('Bedford')).toBeNull();
  });

  it('should render SLA indicator', () => {
    render(<ProviderCard {...defaultProps} />);
    // Default slaLoad is undefined, so should show green indicator
    expect(screen.getByText('Fast turnaround')).toBeDefined();
  });

  it('should show "Compare" when not compared', () => {
    render(
      <ProviderCard
        {...defaultProps}
        isCompared={false}
        onCompareToggle={vi.fn()}
      />,
    );
    expect(screen.getByText('Compare')).toBeDefined();
  });

  it('should show "Comparing" when compared', () => {
    render(
      <ProviderCard
        {...defaultProps}
        isCompared={true}
        onCompareToggle={vi.fn()}
      />,
    );
    expect(screen.getByText('Comparing')).toBeDefined();
  });

  it('should disable compare button when compareDisabled is true and not compared', () => {
    render(
      <ProviderCard
        {...defaultProps}
        isCompared={false}
        onCompareToggle={vi.fn()}
        compareDisabled={true}
      />,
    );
    const compareButton = screen.getByText('Compare').closest('button');
    expect(compareButton?.disabled).toBe(true);
  });

  it('should call onSelect when select button is clicked', () => {
    const onSelect = vi.fn();
    render(<ProviderCard {...defaultProps} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Select'));
    expect(onSelect).toHaveBeenCalledWith('test-1');
  });

  it('should call onCompareToggle when compare button is clicked', () => {
    const onCompareToggle = vi.fn();
    render(
      <ProviderCard
        {...defaultProps}
        isCompared={false}
        onCompareToggle={onCompareToggle}
      />,
    );

    fireEvent.click(screen.getByText('Compare'));
    expect(onCompareToggle).toHaveBeenCalledWith('test-1');
  });
});
