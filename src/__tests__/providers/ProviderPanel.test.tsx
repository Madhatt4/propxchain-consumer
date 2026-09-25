import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Provider } from '../../components/providers/types';
import { ProviderPanel } from '../../components/providers/ProviderPanel';

const mockProviders: Provider[] = [
  {
    id: 'p1',
    name: 'Provider One',
    logo: 'P1',
    tagline: 'First provider',
    tier: 1,
    price: 19.99,
    turnaround: '< 5 minutes',
    rating: 4.8,
    reviews: 200,
    features: ['Feature A', 'Feature B', 'Feature C', 'Feature D'],
    regulated: 'FCA Authorised',
  },
  {
    id: 'p2',
    name: 'Provider Two',
    logo: 'P2',
    tagline: 'Second provider',
    tier: 2,
    price: 29.99,
    turnaround: '24 hours',
    rating: 4.2,
    reviews: 80,
    features: ['Feature E', 'Feature F', 'Feature G', 'Feature H'],
    regulated: 'CQS Accredited',
  },
];

const defaultProps = {
  title: 'AML & Identity Check',
  subtitle: 'Choose your AML provider',
  stageNumber: 1,
  description: 'Select a provider for identity verification.',
  providers: mockProviders,
  onSelect: vi.fn(),
  onContinue: vi.fn(),
};

describe('ProviderPanel', () => {
  it('should render title and subtitle', () => {
    render(<ProviderPanel {...defaultProps} />);

    expect(screen.getByText('AML & Identity Check')).toBeDefined();
    expect(screen.getByText('Choose your AML provider')).toBeDefined();
    // stageNumber is intentionally NOT rendered by ProviderPanel — the parent
    // StageCard already shows "Stage N · <title>", so the panel's own
    // stage-number circle was removed as a duplicate. The prop is retained
    // for call-site compatibility only.
  });

  it('should render badge when provided', () => {
    render(<ProviderPanel {...defaultProps} badge="Required" />);
    expect(screen.getByText('Required')).toBeDefined();
  });

  it('should render price guarantee banner text', () => {
    render(<ProviderPanel {...defaultProps} />);
    expect(screen.getByText(/Same price as going direct/)).toBeDefined();
  });

  it('should render provider cards grid', () => {
    render(<ProviderPanel {...defaultProps} />);

    expect(screen.getByText('Provider One')).toBeDefined();
    expect(screen.getByText('Provider Two')).toBeDefined();
  });

  it('should show "No providers available" when providers array is empty', () => {
    render(<ProviderPanel {...defaultProps} providers={[]} />);
    expect(screen.getByText('No providers available')).toBeDefined();
  });

  it('should show loading skeleton when isLoading is true', () => {
    const { container } = render(
      <ProviderPanel {...defaultProps} isLoading={true} />,
    );

    // Skeleton has animate-pulse class
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);

    // Provider cards should not render during loading
    expect(screen.queryByText('Provider One')).toBeNull();
  });

  it('should show error message when error is set', () => {
    render(
      <ProviderPanel
        {...defaultProps}
        error="Failed to load providers"
      />,
    );
    expect(screen.getByText('Failed to load providers')).toBeDefined();
  });

  it('should show retry button when error and onRetry provided', () => {
    const onRetry = vi.fn();
    render(
      <ProviderPanel
        {...defaultProps}
        error="Something went wrong"
        onRetry={onRetry}
      />,
    );

    const retryButton = screen.getByText('Retry');
    expect(retryButton).toBeDefined();

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('should show skip button when skippable is true', () => {
    const onSkip = vi.fn();
    render(
      <ProviderPanel
        {...defaultProps}
        skippable={true}
        onSkip={onSkip}
      />,
    );

    expect(screen.getByText('Skip this step')).toBeDefined();

    fireEvent.click(screen.getByText('Skip this step'));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('should show confirmation bar when a provider is selected', () => {
    render(
      <ProviderPanel {...defaultProps} selectedId="p1" />,
    );

    // Confirmation bar shows provider name and continue button
    expect(screen.getByText('Continue')).toBeDefined();
  });

  it('should show selected provider name and price in confirmation bar', () => {
    render(
      <ProviderPanel {...defaultProps} selectedId="p1" />,
    );

    // The confirmation bar should display the selected provider's name and formatted price
    // Provider One appears in the card AND the confirmation bar
    const providerNameElements = screen.getAllByText('Provider One');
    expect(providerNameElements.length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText('£19.99 inc VAT')).toBeDefined();
  });
});
