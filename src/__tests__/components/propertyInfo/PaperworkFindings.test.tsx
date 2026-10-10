// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The paperwork list under "Check my answers": what the consents scan found
 * on the seller's own TA6 attachments, read from the stored rows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockLoad = vi.fn();

vi.mock('@/services/documentFindings.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/documentFindings.service')>();
  return { ...actual, loadPaperworkFindings: (...args: unknown[]) => mockLoad(...args) };
});

import { PaperworkFindings } from '../../../components/propertyInfo/PaperworkFindings';

describe('PaperworkFindings', () => {
  beforeEach(() => {
    mockLoad.mockReset();
  });

  it('should list each document with its findings', async () => {
    mockLoad.mockResolvedValue([
      { section: '5.2', title: 'Planning permission for the extension', findings: ['Carries conditions', 'Permission looks lapsed'] },
      { section: '6.1', title: 'Roofing guarantee', findings: ['No sign the guarantee passes to a new owner'] },
    ]);

    render(<PaperworkFindings transactionId="tx_1" />);

    expect(await screen.findByText('Planning permission for the extension')).toBeInTheDocument();
    expect(screen.getByText('Permission looks lapsed')).toBeInTheDocument();
    expect(screen.getByText('Roofing guarantee')).toBeInTheDocument();
    expect(mockLoad).toHaveBeenCalledWith('tx_1');
  });

  it('should render nothing at all when no document has anything to say', async () => {
    mockLoad.mockResolvedValue([]);

    const { container } = render(<PaperworkFindings transactionId="tx_1" />);

    await vi.waitFor(() => expect(mockLoad).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('should say the findings are advisory and that the conveyancer decides', async () => {
    mockLoad.mockResolvedValue([{ section: '5.2', title: 'Alteration paperwork', findings: ['Carries conditions'] }]);

    render(<PaperworkFindings transactionId="tx_1" />);

    expect(await screen.findByText(/Your conveyancer decides/)).toBeInTheDocument();
  });
});
