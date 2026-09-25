import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import TA10Form from '../TA10Form';

vi.mock('../FormExportButton', () => ({
  FormExportButton: () => <div data-testid="form-export-stub" />,
}));

vi.mock('@/stores/authStore', () => ({
  getStorePrincipalId: () => '',
}));

describe('TA10Form', () => {
  it('should render every default room open with its fittings visible', () => {
    render(<TA10Form transactionId="TX-1" onSave={vi.fn()} />);

    expect(screen.getByText('Kitchen')).toBeInTheDocument();
    expect(screen.getByText('Outdoor and garden')).toBeInTheDocument();
    // Rooms are open by default — kitchen items visible without a click.
    expect(screen.getByText('Oven/Hob')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Included' }).length).toBeGreaterThan(10);
  });

  it('should toggle an item to included and reflect the staying count', () => {
    render(<TA10Form transactionId="TX-1" onSave={vi.fn()} />);

    const group = screen.getByRole('group', { name: 'Oven/Hob included or excluded' });
    const included = group.querySelector('button');
    expect(included).not.toBeNull();
    fireEvent.click(included!);
    expect(included).toHaveAttribute('aria-pressed', 'true');
  });

  it('should add a custom item with an open editable name field', () => {
    render(<TA10Form transactionId="TX-1" onSave={vi.fn()} />);

    fireEvent.click(screen.getAllByRole('button', { name: /Add another item in this room/ })[0]);
    expect(screen.getByPlaceholderText('Item name')).toBeInTheDocument();
  });

  it('should save the whole form when Save form is clicked', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<TA10Form transactionId="TX-1" onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save form' }));
    await screen.findByText(/Saved/);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].rooms.length).toBeGreaterThan(0);
  });

  it('should hide editing affordances in read-only mode', () => {
    render(<TA10Form transactionId="TX-1" onSave={vi.fn()} readOnly />);

    expect(screen.queryByRole('button', { name: 'Save form' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add another item/ })).not.toBeInTheDocument();
  });
});
