// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * The Sales pack tab renders the readiness meter from the shared hook and is
 * registered in the tab registry as a free (starter) tab — decisions in
 * Madhatt4/Propxchain#115.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { SalesPackTab } from '../SalesPackTab';
import { TRANSACTION_TABS } from '../transactionTabs.config';
import type { PackReadiness } from '@/services/salesPackReadiness';

const readiness: PackReadiness = {
  items: [
    { id: 'materialInfo', label: 'Material information complete', done: true },
    { id: 'epc', label: 'EPC rating on the listing', done: true },
    { id: 'titlePulled', label: 'Title register pulled (HMLR)', done: false },
    { id: 'ta6', label: 'TA6 property information form', done: false },
    { id: 'idShared', label: 'Proof of ID shared from your wallet (never inside the pack)', done: false },
  ],
  done: 2,
  total: 5,
  warnings: [],
};

vi.mock('@/hooks/usePackReadiness', () => ({
  usePackReadiness: vi.fn(() => ({ readiness, isLoading: false })),
}));
import { usePackReadiness } from '@/hooks/usePackReadiness';

vi.mock('@/services/web2-document.service', () => ({
  web2DocumentService: {
    getDocumentsByTransaction: vi.fn().mockResolvedValue([]),
    uploadDocument: vi.fn(),
  },
}));

function renderTab(onGoToStage?: (stageId: string) => void): void {
  render(
    <MemoryRouter>
      <SalesPackTab
        transactionId="tx-1"
        locked={false}
        requiredTier="starter"
        onGoToStage={onGoToStage}
      />
    </MemoryRouter>,
  );
}

describe('SalesPackTab row actions', () => {
  it('should send an unfinished material-info row to Stage 1', () => {
    const go = vi.fn();
    const done = { ...readiness, items: readiness.items.map((i) => (i.id === 'materialInfo' ? { ...i, done: false } : i)) };
    vi.mocked(usePackReadiness).mockReturnValueOnce({ readiness: done, isLoading: false });
    renderTab(go);
    fireEvent.click(screen.getByRole('button', { name: 'Complete in Stage 1' }));
    expect(go).toHaveBeenCalledWith('seller-1');
  });

  it('should not offer a Stage 1 link when material info is already complete', () => {
    renderTab(vi.fn());
    expect(screen.queryByRole('button', { name: 'Complete in Stage 1' })).toBeNull();
  });

  it('should point an unshared proof of ID at the wallet, not at the pack uploader', () => {
    renderTab();
    expect(screen.getByRole('link', { name: 'Share from wallet' })).toHaveAttribute('href', '/transaction/tx-1/flow?tab=wallet');
  });
});

describe('SalesPackTab', () => {
  it('should show the done fraction from the readiness hook', () => {
    renderTab();
    expect(screen.getByText('2 of 5')).toBeInTheDocument();
  });

  it('should render one row per readiness item with its completion state', () => {
    renderTab();
    expect(screen.getByText('Material information complete')).toBeInTheDocument();
    expect(screen.getByText('Title register pulled (HMLR)')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: 'Sales pack readiness' });
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
  });

  it('should offer the extra-documents slot', () => {
    renderTab();
    expect(screen.getByRole('button', { name: 'Add a document' })).toBeInTheDocument();
  });
});

describe('SalesPackTab register warnings', () => {
  it('should show a register clash as an alert above the items', () => {
    vi.mocked(usePackReadiness).mockReturnValueOnce({
      readiness: { ...readiness, warnings: ['Tenure: the HMLR register says "freehold" but the listing says "leasehold". Check which is right before sharing the pack.'] },
      isLoading: false,
    });
    renderTab();
    expect(screen.getByRole('alert')).toHaveTextContent('register says "freehold"');
  });

  it('should show no alert when the registers agree', () => {
    renderTab();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('SalesPackTab other documents', () => {
  it('should disable adding until a document type is chosen', () => {
    renderTab();
    expect(screen.getByRole('button', { name: 'Add a document' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Document type'), { target: { value: 'sales_pack_floor_plan' } });
    expect(screen.getByRole('button', { name: 'Add a document' })).toBeEnabled();
  });

  it('should route an identity document to the wallet instead of the pack', () => {
    renderTab();
    fireEvent.change(screen.getByLabelText('Document type'), { target: { value: 'identity_document' } });
    expect(screen.queryByRole('button', { name: 'Add a document' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Upload to Transaction Wallet' })).toHaveAttribute('href', '/transaction/tx-1/flow?tab=wallet');
    expect(screen.getByText(/never go in the pack/)).toBeInTheDocument();
  });
});

describe('tab registry', () => {
  it('should not register sales-pack as a drawer section — it lives as Stage 0 in the flow', () => {
    expect(TRANSACTION_TABS.map((t) => t.id)).not.toContain('sales-pack');
  });
});
