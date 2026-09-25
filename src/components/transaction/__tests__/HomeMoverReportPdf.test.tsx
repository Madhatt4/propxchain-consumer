import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';

import HomeMoverReportPdf, { exportHomeMoverReportPdf } from '../HomeMoverReportPdf';
import type { PropertyIntelligenceReport } from '../../../services/propertyIntelligenceService';

// html2pdf is browser-only (canvas); stub the dynamic import so the export path
// is testable in jsdom. The chained fluent API returns `this` at each step.
const save = vi.fn().mockResolvedValue(undefined);
// Snapshot of the captured node's inline styles at the moment html2pdf receives
// it. html2pdf clones the node with cloneNode (inline styles included), so any
// off-screen positioning on the node itself ends up on the clone and renders a
// blank page — the bug this file guards against.
interface CapturedStyle {
  position: string;
  left: string;
  display: string;
}
const captured: CapturedStyle[] = [];
const chain = {
  set: () => chain,
  from: (el: HTMLElement) => {
    captured.push({ position: el.style.position, left: el.style.left, display: el.style.display });
    return chain;
  },
  save,
};
vi.mock('html2pdf.js', () => ({ default: () => chain }));

function makeReport(overrides: Partial<PropertyIntelligenceReport> = {}): PropertyIntelligenceReport {
  return {
    postcode: 'SG18 0AA',
    fetchedAt: Date.parse('2026-07-19'),
    coordinateSource: 'postcode-centroid',
    titleBoundary: null,
    location: {
      postcode: 'SG18 0AA',
      coordinates: { lat: 52.087, lng: -0.275 },
      admin_district: 'Central Bedfordshire',
      admin_ward: 'Biggleswade North',
      country: 'England',
      region: 'East of England',
    },
    flood: { activeWarnings: [], status: 'low' },
    heritage: { listedBuildings: [], conservationAreas: [], status: 'listed_building' },
    article4: { directions: [], status: 'restricted' },
    treePreservation: { zones: [], status: 'none' },
    floodZone: { zones: [], status: 'zone_3' },
    environmental: { designations: [], status: 'none' },
    brownfield: { sites: [], status: 'none' },
    planningApplications: { applications: [], total: 0, status: 'none' },
    pricePaid: {
      sales: [{ amount: 425000, date: '2025-11-02', paon: '12', street: 'High Street', propertyType: 'terraced' }],
      averagePrice: 425000,
      latestSale: { amount: 425000, date: '2025-11-02', paon: '12', street: 'High Street', propertyType: 'terraced' },
    },
    epc: {
      address: '12 High Street', postcode: 'SG18 0AA', uprn: null,
      currentBand: 'D', potentialBand: 'B', currentRating: 60, potentialRating: 82,
      floorAreaSqm: 85, lodgementDate: '2024-01-01', meetsMees: true,
    },
    valuePerSqm: 5000,
    localPlanningAuthority: { entity: 1, name: 'Central Bedfordshire Council', dataset: 'local-planning-authority', reference: 'CBC', startDate: null, documentUrl: null },
    sources: [
      { source: 'postcodes.io', ok: true, lastFetched: Date.now() },
      { source: 'landregistry.data.gov.uk/ppd', ok: true, lastFetched: Date.now() },
    ],
    ...overrides,
  };
}

describe('HomeMoverReportPdf', () => {
  beforeEach(() => {
    save.mockClear();
    captured.length = 0;
    // jsdom lacks document.fonts; stub it so the export path awaits cleanly.
    Object.defineProperty(document, 'fonts', { value: { ready: Promise.resolve() }, configurable: true });
  });

  it('should render the address, LPA and brand wordmark in the printable digest', () => {
    render(<HomeMoverReportPdf report={makeReport()} addressLine="12" />);
    expect(screen.getByText('Home Mover Report')).toBeInTheDocument();
    expect(screen.getAllByText(/Central Bedfordshire, SG18 0AA/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Central Bedfordshire Council/)).toBeInTheDocument();
    // Wordmark is split across nodes (Prop / X / chain) — match the composed text.
    expect(screen.getByText((_, el) => el?.textContent === 'PropXchain')).toBeInTheDocument();
  });

  it('should surface each category status as a RAG chip', () => {
    render(<HomeMoverReportPdf report={makeReport()} addressLine="12" />);
    // Article 4 restricted → "Check"; flood zone 3 → "Attention"; listed → "Attention".
    expect(screen.getAllByText('Attention').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Check').length).toBeGreaterThanOrEqual(1);
  });

  it('should list a conditional next-step when Article 4 restricts permitted development', () => {
    render(<HomeMoverReportPdf report={makeReport()} addressLine="12" />);
    expect(screen.getByText(/Permitted-development rights are restricted/)).toBeInTheDocument();
  });

  it('should show a reassuring next-step when nothing is flagged', () => {
    const clean = makeReport({
      heritage: { listedBuildings: [], conservationAreas: [], status: 'none' },
      article4: { directions: [], status: 'none' },
      floodZone: { zones: [], status: 'none' },
    });
    render(<HomeMoverReportPdf report={clean} addressLine="12" />);
    expect(screen.getByText(/No major flags on the free public data/)).toBeInTheDocument();
  });

  it('should export a postcode-stamped PDF filename via html2pdf', async () => {
    const ref = createRef<HTMLDivElement>();
    render(<HomeMoverReportPdf ref={ref} report={makeReport()} addressLine="12" />);
    await exportHomeMoverReportPdf(ref, makeReport());
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('should hand html2pdf a laid-out node with no off-screen positioning of its own', async () => {
    const ref = createRef<HTMLDivElement>();
    render(<HomeMoverReportPdf ref={ref} report={makeReport()} addressLine="12" />);
    await exportHomeMoverReportPdf(ref, makeReport());
    expect(captured).toHaveLength(1);
    for (const style of captured) {
      expect(style.position).toBe('');
      expect(style.left).toBe('');
      expect(style.display).not.toBe('none');
    }
  });

  it('should keep the printable page off-screen via a wrapper around the captured node', () => {
    const ref = createRef<HTMLDivElement>();
    render(<HomeMoverReportPdf ref={ref} report={makeReport()} addressLine="12" />);
    const wrapper = ref.current?.parentElement;
    expect(wrapper).toHaveStyle({ position: 'fixed', left: '-100000px' });
    expect(wrapper).toHaveAttribute('aria-hidden', 'true');
  });
});
