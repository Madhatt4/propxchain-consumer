// The consents scan as the slot shows it: findings under the attachment, a
// re-scan when the row's kind or link changes, and nothing when there is
// nothing to say. Kept apart from widgets.test.tsx for the 300-line cap.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { DocumentSlot } from '../widgets/DocumentSlot';
import type { TA6Upload } from '../widgets/ta6Uploader';
import type { DocFinding, DocScanContext } from '../../../../services/docClassify.service';

const PLANNING: DocScanContext = { section: '5.2', kind: 'planning-permission', relatesTo: 'extension', ticked: ['extension'] };
const LAPSED: DocFinding = { key: 'planning_lapsed', label: 'Permission looks lapsed', probability: 1 };
const CONDITIONS: DocFinding = { key: 'conditions_outstanding', label: 'Carries conditions', probability: 0.8 };

function upload(findings: DocFinding[] | null, rescan?: TA6Upload['rescan']): TA6Upload {
  return {
    documentId: '99',
    advisory: Promise.resolve(null),
    classification: Promise.resolve(null),
    findings: Promise.resolve(findings),
    rescan,
  };
}

const file = new File(['pdf-bytes'], 'decision.pdf', { type: 'application/pdf' });

function pick(): void {
  fireEvent.change(screen.getByLabelText('5.2.1 attachment'), { target: { files: [file] } });
}

describe('DocumentSlot consents findings', () => {
  it('should hand the slot context to the uploader with the file', async () => {
    const onUpload = vi.fn().mockResolvedValue(upload([]));
    render(
      <DocumentSlot refCode="5.2.1" prompt={undefined} value={{ status: 'attached', documentId: null }} onChange={() => {}} onUpload={onUpload} scanContext={PLANNING} />,
    );

    pick();

    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(file, PLANNING));
  });

  it('should still call the uploader with the file alone when the slot has no context', async () => {
    const onUpload = vi.fn().mockResolvedValue(upload(null));
    render(
      <DocumentSlot refCode="5.2.1" prompt={undefined} value={{ status: 'attached', documentId: null }} onChange={() => {}} onUpload={onUpload} />,
    );

    pick();

    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(file));
  });

  it('should list each finding under the attachment once the scan settles', async () => {
    const onUpload = vi.fn().mockResolvedValue(upload([CONDITIONS, LAPSED]));
    render(
      <DocumentSlot refCode="5.2.1" prompt={undefined} value={{ status: 'attached', documentId: null }} onChange={() => {}} onUpload={onUpload} scanContext={PLANNING} />,
    );

    pick();

    const list = await screen.findByRole('list', { name: '5.2.1 findings' });
    expect(list).toHaveTextContent('Carries conditions');
    expect(list).toHaveTextContent('Permission looks lapsed');
  });

  it('should show no findings list for a clean document or when the scan was unavailable', async () => {
    const onUpload = vi.fn().mockResolvedValue(upload([]));
    render(
      <DocumentSlot refCode="5.2.1" prompt={undefined} value={{ status: 'attached', documentId: null }} onChange={() => {}} onUpload={onUpload} scanContext={PLANNING} />,
    );

    pick();

    await waitFor(() => expect(onUpload).toHaveBeenCalled());
    expect(screen.queryByRole('list', { name: '5.2.1 findings' })).not.toBeInTheDocument();
  });

  it('should re-scan with the new context when the kind or link changes after an upload', async () => {
    const rescan = vi.fn().mockResolvedValue([LAPSED]);
    const onUpload = vi.fn().mockResolvedValue(upload([], rescan));
    const { rerender } = render(
      <DocumentSlot refCode="5.2.1" prompt={undefined} value={{ status: 'attached', documentId: null }} onChange={() => {}} onUpload={onUpload} scanContext={PLANNING} />,
    );
    pick();
    await waitFor(() => expect(onUpload).toHaveBeenCalled());

    const relinked: DocScanContext = { ...PLANNING, relatesTo: 'loft-conversion' };
    rerender(
      <DocumentSlot refCode="5.2.1" prompt={undefined} value={{ status: 'attached', documentId: '99' }} onChange={() => {}} onUpload={onUpload} scanContext={relinked} />,
    );

    await waitFor(() => expect(rescan).toHaveBeenCalledWith(relinked));
    expect(await screen.findByRole('list', { name: '5.2.1 findings' })).toHaveTextContent('Permission looks lapsed');
  });

  it('should not re-scan before anything has been uploaded in this session', () => {
    const { rerender } = render(
      <DocumentSlot refCode="5.2.1" prompt={undefined} value={{ status: 'attached', documentId: '42' }} onChange={() => {}} onUpload={vi.fn()} scanContext={PLANNING} />,
    );

    rerender(
      <DocumentSlot refCode="5.2.1" prompt={undefined} value={{ status: 'attached', documentId: '42' }} onChange={() => {}} onUpload={vi.fn()} scanContext={{ ...PLANNING, kind: 'other' }} />,
    );

    expect(screen.queryByRole('list', { name: '5.2.1 findings' })).not.toBeInTheDocument();
  });
});
