import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const listLegacy = vi.fn();
const migrateAll = vi.fn();
vi.mock('@/services/vaultMigration.service', () => ({
  vaultMigrationService: {
    listLegacy: (...a: unknown[]) => listLegacy(...a),
    migrateAll: (...a: unknown[]) => migrateAll(...a),
  },
}));

import { WalletMigrationBanner } from '../WalletMigrationBanner';

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('WalletMigrationBanner', () => {
  it('should render nothing when there are no legacy files', async () => {
    listLegacy.mockResolvedValue([]);
    const { container } = render(<WalletMigrationBanner principal="p1" onMigrated={vi.fn()} />);
    await waitFor(() => expect(listLegacy).toHaveBeenCalledWith('p1'));
    expect(container).toBeEmptyDOMElement();
  });

  it('should explain the move and migrate on click', async () => {
    listLegacy.mockResolvedValue([{ localId: 'l1' }, { localId: 'l2' }]);
    migrateAll.mockImplementation(async (_p: string, onEach: (d: unknown) => void) => {
      onEach({ id: 'r1' });
      return { moved: 1, failed: 1 };
    });
    const onMigrated = vi.fn();

    render(<WalletMigrationBanner principal="p1" onMigrated={onMigrated} />);

    expect(await screen.findByText(/2 files are still stored only on this device/i)).toBeInTheDocument();
    expect(screen.getByText(/only a hash was ever written to the blockchain/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /move to my account/i }));
    await waitFor(() => expect(onMigrated).toHaveBeenCalledWith([{ id: 'r1' }]));
    expect(await screen.findByText(/moved 1 · 1 could not be moved/i)).toBeInTheDocument();
  });

  it('should hide for the session on "Not now"', async () => {
    listLegacy.mockResolvedValue([{ localId: 'l1' }]);
    render(<WalletMigrationBanner principal="p1" onMigrated={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /not now/i }));

    expect(screen.queryByText(/still stored only on this device/i)).not.toBeInTheDocument();
    expect(sessionStorage.getItem('wallet:migrationDismissed:p1')).toBe('1');
  });
});
