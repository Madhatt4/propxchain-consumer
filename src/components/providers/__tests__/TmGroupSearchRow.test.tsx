import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TmGroupSearchRow from '../TmGroupSearchRow';

const BASE = { name: 'Landmark Flood', pricePence: 7800, isChecked: false, onToggle: vi.fn() };

describe('TmGroupSearchRow unpriced line', () => {
  it('should ask for a refresh on the first unpriced answer', () => {
    render(<TmGroupSearchRow {...BASE} unavailable suggestRefresh />);

    expect(screen.getByText('Not priced — press Refresh quote')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('should read as not available here once a refresh has been tried', () => {
    render(<TmGroupSearchRow {...BASE} unavailable suggestRefresh={false} />);

    expect(screen.getByText('Not available here')).toBeInTheDocument();
  });

  it('should show the price when the line is priced', () => {
    render(<TmGroupSearchRow {...BASE} />);

    expect(screen.getByText('£78.00')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeEnabled();
  });
});
