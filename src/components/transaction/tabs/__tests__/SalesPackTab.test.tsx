// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * The Sales pack tab renders the guided, numbered list Marc signed off on
 * 2026-11-15 from the shared readiness hook, and is not a drawer section:
 * it lives as Stage 0 in the flow (decisions in Madhatt4/Propxchain#115).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SalesPackTab } from '../SalesPackTab';
import { TRANSACTION_TABS } from '../transactionTabs.config';
import type { PackItem, PackReadiness } from '@/services/salesPackReadiness';

function pack(items: PackItem[]): PackReadiness {
  return { items, done: items.filter((i) => i.done).length, total: items.length, warnings: [] };
}

const FREEHOLD_ITEMS: PackItem[] = [
  { id: 'materialInfo', label: 'About your property', done: true, missing: [] },
  { id: 'epc', label: 'Energy Performance Certificate (EPC)', done: true, status: 'Rating C, found on the national register' },
  { id: 'titlePulled', label: 'Title register', done: false, status: 'Not pulled yet' },
  { id: 'ta6', label: 'Property information form (TA6)', done: false, status: 'Not started' },
  { id: 'ta10', label: 'Fittings and contents form (TA10)', done: false, status: 'Not started' },
  { id: 'searches', label: 'Property searches', done: false, status: 'Not ordered', searchesState: 'notOrdered' },
  { id: 'idShared', label: 'Proof of identity', done: false, status: 'Not shared yet' },
];

const TA7: PackItem = { id: 'ta7', label: 'Leasehold information form (TA7)', done: false, status: 'Not started' };

const readiness = pack(FREEHOLD_ITEMS);

const MISSING_BAND: Partial<PackItem> = { done: false, missing: ['councilTaxBand'], status: 'Missing: council tax band' };

function withItem(id: PackItem['id'], patch: Partial<PackItem>): PackReadiness {
  return pack(FREEHOLD_ITEMS.map((i) => (i.id === id ? { ...i, ...patch } : i)));
}

const refreshReadiness = vi.fn();
vi.mock('@/hooks/usePackReadiness', () => ({
  usePackReadiness: vi.fn(() => ({ readiness, isLoading: false })),
  useRefreshPackReadiness: () => refreshReadiness,
}));
import { usePackReadiness } from '@/hooks/usePackReadiness';

// The shared £7 pull (also Stage 1's): stubbed so no test reaches Stripe. The
// stub exposes the props the row passes and lets a test report a success.
const pullProps = vi.fn();
vi.mock('../../HMLRTitlePullButton', () => ({
  default: (props: { titleNumber: string; transactionId: string; variant?: string; onSuccess?: () => void }) => {
    pullProps(props);
    return (
      <button type="button" onClick={() => props.onSuccess?.()}>
        Get it for £7 ({props.titleNumber})
      </button>
    );
  },
}));

vi.mock('@/services/materialInfoSave', () => ({ saveMaterialInfoPatch: vi.fn() }));

vi.mock('@/services/web2-document.service', () => ({
  web2DocumentService: {
    getDocumentsByTransaction: vi.fn().mockResolvedValue([]),
    uploadDocument: vi.fn(),
  },
}));

vi.mock('@/services/salesPackDocument.service', () => ({
  SALES_PACK_ACCEPTED_TYPES: ['application/pdf', 'image/jpeg', 'image/png'],
  listSalesPackDocuments: vi.fn().mockResolvedValue([]),
  uploadSalesPackDocument: vi.fn(),
  fetchSalesPackFile: vi.fn(),
}));

function useReadiness(r: PackReadiness): void {
  vi.mocked(usePackReadiness).mockReturnValue({ readiness: r, isLoading: false });
}

function renderTab(onGoToStage?: (stageId: string) => void, readOnly?: boolean): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SalesPackTab transactionId="tx-1" onGoToStage={onGoToStage} readOnly={readOnly} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

function rows(): HTMLElement[] {
  return within(screen.getByRole('list', { name: 'Sales pack steps' })).getAllByRole('listitem');
}

beforeEach(() => {
  vi.clearAllMocks();
  useReadiness(readiness);
});

describe('SalesPackTab order and numbering', () => {
  it('should number not-done rows by position and tick done rows', () => {
    renderTab();
    const list = rows();
    expect(list).toHaveLength(7);
    expect(list[0]).toHaveTextContent('About your property, done');
    expect(list[2]).toHaveTextContent(/^3Title register/);
    expect(list[5]).toHaveTextContent(/^6Property searches/);
    expect(list[6]).toHaveTextContent(/^7Proof of identity/);
  });

  it('should re-flow the numbers when TA7 is shown', () => {
    useReadiness(pack([...FREEHOLD_ITEMS.slice(0, 5), TA7, ...FREEHOLD_ITEMS.slice(5)]));
    renderTab();
    const list = rows();
    expect(list).toHaveLength(8);
    expect(list[5]).toHaveTextContent(/^6Leasehold information form \(TA7\)/);
    expect(list[6]).toHaveTextContent(/^7Property searches/);
    expect(list[7]).toHaveTextContent(/^8Proof of identity/);
  });

  it('should show the done count against the visible rows', () => {
    renderTab();
    expect(screen.getByText('2 of 7')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: 'Sales pack readiness' });
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuemax', '7');
  });
});

describe('SalesPackTab next line', () => {
  it('should name the first row that is not done', () => {
    renderTab();
    expect(screen.getByText('Next: Title register')).toBeInTheDocument();
  });

  it('should say the pack is complete when every row is done', () => {
    useReadiness(pack(FREEHOLD_ITEMS.map((i) => ({ ...i, done: true }))));
    renderTab();
    expect(screen.getByText('Pack complete')).toBeInTheDocument();
  });
});

describe('SalesPackTab searches row', () => {
  it.each([
    ['Not ordered', 'notOrdered', false],
    ['Ordered, waiting for results', 'ordered', false],
    ['Results back', 'back', true],
  ] as const)('should show "%s"', (status, searchesState, done) => {
    useReadiness(withItem('searches', { status, searchesState, done }));
    renderTab(vi.fn());
    expect(rows()[5]).toHaveTextContent(status);
  });

  it('should offer "Choose searches" before anything is ordered', () => {
    const go = vi.fn();
    renderTab(go);
    fireEvent.click(screen.getByRole('button', { name: /Choose searches/ }));
    expect(go).toHaveBeenCalledWith('seller-2');
  });

  it('should offer no action while results are awaited', () => {
    useReadiness(withItem('searches', { status: 'Ordered, waiting for results', searchesState: 'ordered' }));
    renderTab(vi.fn());
    expect(screen.queryByRole('button', { name: /Choose searches/ })).toBeNull();
  });
});

describe('SalesPackTab help', () => {
  it('should toggle the four-line help panel from the ? button', () => {
    renderTab();
    const q = screen.getByRole('button', { name: 'What is Title register?' });
    expect(q).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(q);
    expect(q).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(q.getAttribute('aria-controls') ?? '') as HTMLElement;
    for (const label of ['What it is', 'Where you get it', 'Cost', 'Who usually does it']) {
      expect(within(panel).getByText(label)).toBeInTheDocument();
    }
    expect(panel).toHaveTextContent('£7, the HM Land Registry fee.');
    fireEvent.click(q);
    expect(q).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Who usually does it')).toBeNull();
  });
});

describe('SalesPackTab row actions', () => {
  it.each([
    ['Add title number in Stage 1', 'seller-1'],
    ['Start form', 'seller-3'],
  ])('should send "%s" to %s', (label, stageId) => {
    const go = vi.fn();
    renderTab(go);
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(label) })[0]);
    expect(go).toHaveBeenCalledWith(stageId);
  });

  it('should point an unshared proof of ID at the wallet, not at the pack uploader', () => {
    renderTab();
    expect(screen.getByRole('link', { name: /Share from wallet/ })).toHaveAttribute('href', '/transaction/tx-1/flow?tab=wallet');
  });

  it('should render no stage actions when the flow page gives no way to navigate', () => {
    renderTab();
    expect(screen.queryByRole('button', { name: /Get it for £7|Add title number|Start form|Choose searches/ })).toBeNull();
  });

  it('should send a missing address, postcode or price to Stage 1 instead of an inline form', () => {
    useReadiness(withItem('materialInfo', { done: false, missing: ['price'], status: 'Missing: asking price' }));
    const go = vi.fn();
    renderTab(go);
    expect(screen.getByText('Missing: asking price')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Fix in Stage 1/ }));
    expect(go).toHaveBeenCalledWith('seller-1');
  });
});

describe('SalesPackTab title register row', () => {
  it('should start the shared £7 pull from the row with the deal and its title number', () => {
    useReadiness(withItem('titlePulled', { titleNumber: 'GR506405' }));
    renderTab(vi.fn());
    const button = within(rows()[2]).getByRole('button', { name: /Get it for £7/ });
    expect(pullProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ titleNumber: 'GR506405', transactionId: 'tx-1', variant: 'compact' }),
    );
    expect(within(rows()[2]).queryByRole('button', { name: /Add title number/ })).toBeNull();
    expect(button).toBeInTheDocument();
  });

  it('should explain and fall back to Stage 1 when the deal has no title number', () => {
    useReadiness(withItem('titlePulled', { status: 'Not pulled yet. Add your title number first' }));
    const go = vi.fn();
    renderTab(go);
    expect(rows()[2]).toHaveTextContent('Add your title number first');
    expect(pullProps).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Add title number in Stage 1/ }));
    expect(go).toHaveBeenCalledWith('seller-1');
  });

  it('should refresh readiness after a successful pull and keep the button mounted once ticked', () => {
    useReadiness(withItem('titlePulled', { titleNumber: 'GR506405' }));
    const client = new QueryClient();
    const tab = (): JSX.Element => (
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SalesPackTab transactionId="tx-1" onGoToStage={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    const { rerender } = render(tab());
    fireEvent.click(screen.getByRole('button', { name: /Get it for £7/ }));
    expect(refreshReadiness).toHaveBeenCalledTimes(1);
    // The refreshed readiness now ticks the row; the register modal lives in the button.
    useReadiness(withItem('titlePulled', { titleNumber: 'GR506405', done: true, status: 'Pulled from HM Land Registry' }));
    rerender(tab());
    expect(rows()[2]).toHaveTextContent('Title register, done');
    expect(within(rows()[2]).getByRole('button', { name: /Get it for £7/ })).toBeInTheDocument();
  });

  it('should keep the pull mounted on a ticked row while a paid pull is pending on this device', () => {
    localStorage.setItem('propxchain.hmlr.pull.pending', JSON.stringify({
      titleNumber: 'GR506405', transactionId: 'tx-1', startedAt: new Date().toISOString(), sessionId: 'cs_test_1',
    }));
    useReadiness(withItem('titlePulled', { done: true, status: 'Pulled from HM Land Registry' }));
    renderTab(vi.fn());
    expect(within(rows()[2]).getByRole('button', { name: /Get it for £7 \(GR506405\)/ })).toBeInTheDocument();
    expect(pullProps).toHaveBeenLastCalledWith(expect.objectContaining({ titleNumber: 'GR506405', transactionId: 'tx-1' }));
    localStorage.clear();
  });

  it('should offer no pull once the title is already pulled', () => {
    useReadiness(withItem('titlePulled', { titleNumber: 'GR506405', done: true, status: 'Pulled from HM Land Registry' }));
    renderTab(vi.fn());
    expect(screen.queryByRole('button', { name: /Get it for £7/ })).toBeNull();
  });
});

describe('SalesPackTab about-your-property inline form', () => {
  it('should show only the missing fields', () => {
    useReadiness(withItem('materialInfo', MISSING_BAND));
    renderTab(vi.fn());
    expect(screen.getByText('Missing: council tax band')).toBeInTheDocument();
    expect(screen.queryByLabelText('Tenure')).toBeNull();
    expect(screen.queryByLabelText('Property type')).toBeNull();
    const bands = Array.from(screen.getByLabelText('Council tax band').querySelectorAll('option')).map((o) => o.textContent);
    expect(bands).toEqual(['Choose', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
  });
});

// The buyer sees the pack, but only the seller's side acts on it
// (lib/dealAccess `salesPack`).
describe('SalesPackTab for the buyer', () => {
  it('should show the rows, progress and help but no way to change them', () => {
    useReadiness(withItem('materialInfo', MISSING_BAND));
    renderTab(vi.fn(), true);
    expect(screen.getByText('About your property')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Sales pack readiness' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('View only');
    expect(screen.queryByText(/Work down the list/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Get it for £7|Start form|Choose searches|Fix in Stage 1/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Share from wallet/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add a document' })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'What is Proof of identity?' }));
    expect(screen.getByText('Who usually does it')).toBeInTheDocument();
  });

  it('should show no status lines and no actions, only ticks, titles and help', () => {
    useReadiness(withItem('titlePulled', { titleNumber: 'GR506405' }));
    renderTab(vi.fn(), true);
    for (const status of ['Not pulled yet', 'Not started', 'Not ordered', 'Not shared yet', 'Rating C, found on the national register']) {
      expect(screen.queryByText(status)).toBeNull();
    }
    expect(screen.queryByRole('button', { name: /Get it for £7|Add title number/ })).toBeNull();
    expect(pullProps).not.toHaveBeenCalled();
    expect(rows()[0]).toHaveTextContent('About your property, done');
    expect(rows()[2]).toHaveTextContent(/^3Title register/);
    fireEvent.click(screen.getByRole('button', { name: 'What is Title register?' }));
    expect(screen.getByText('Who usually does it')).toBeInTheDocument();
  });

  it('should hide the amber missing line from the buyer', () => {
    useReadiness(withItem('materialInfo', MISSING_BAND));
    renderTab(vi.fn(), true);
    expect(screen.queryByText('Missing: council tax band')).toBeNull();
  });

  it('should still show the seller every status line', () => {
    useReadiness(withItem('materialInfo', MISSING_BAND));
    renderTab(vi.fn());
    for (const status of ['Missing: council tax band', 'Not pulled yet', 'Not started', 'Not ordered', 'Not shared yet']) {
      expect(screen.getAllByText(status).length).toBeGreaterThan(0);
    }
  });

  it('should keep the full lead text for the seller', () => {
    renderTab(vi.fn());
    expect(screen.getByText(/Work down the list\. Each step takes you to the right place\./)).toBeInTheDocument();
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

  it('should not offer identity documents as a pack type, since ID is shared from the wallet', () => {
    renderTab();
    const options = Array.from(screen.getByLabelText('Document type').querySelectorAll('option'));
    expect(options.map((o) => o.getAttribute('value'))).not.toContain('identity_document');
    expect(screen.queryByText(/Passport/)).toBeNull();
  });

  it('should no longer say documents are stored on this device', () => {
    renderTab();
    expect(screen.queryByText(/Stored on this device for now/)).toBeNull();
    expect(screen.getByText(/Stored securely with this deal/)).toBeInTheDocument();
  });
});

describe('tab registry', () => {
  it('should not register sales-pack as a drawer section — it lives as Stage 0 in the flow', () => {
    expect(TRANSACTION_TABS.map((t) => t.id)).not.toContain('sales-pack');
  });
});
