import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const storeDocument = vi.fn();
const removeDocument = vi.fn();
const getFile = vi.fn();
const setLabel = vi.fn();
const getCustomSlotName = vi.fn(() => null);
const setCustomSlotName = vi.fn();
vi.mock('@/services/vaultDocument.service', () => ({
  vaultDocumentService: {
    storeDocument: (...a: unknown[]) => storeDocument(...a),
    removeDocument: (...a: unknown[]) => removeDocument(...a),
    getFile: (...a: unknown[]) => getFile(...a),
    setLabel: (...a: unknown[]) => setLabel(...a),
    getCustomSlotName: () => getCustomSlotName(),
    setCustomSlotName: (...a: unknown[]) => setCustomSlotName(...a),
  },
  validateVaultFile: (file: File) =>
    file.type === 'application/pdf' ? null : 'Please upload a PDF, JPG, or PNG file',
}));

const removeEverywhere = vi.fn();
vi.mock('@/services/transactionWallet.service', () => ({
  transactionWalletService: { removeFromWalletEverywhere: (...a: unknown[]) => removeEverywhere(...a) },
}));

import { WalletDocumentUpload } from '../WalletDocumentUpload';
import { VAULT_SLOTS } from '@/types/vault.types';

const idSlot = VAULT_SLOTS.find((s) => s.id === 'proofOfId')!;
const mortgageSlot = VAULT_SLOTS.find((s) => s.id === 'mortgageOffer')!;
const customSlot = VAULT_SLOTS.find((s) => s.id === 'custom1')!;
const storedDoc = {
  id: 'row-7',
  slotId: 'proofOfId' as const,
  blockchainId: 7,
  fileHash: 'a'.repeat(64),
  fileSize: 10 * 1024,
  mimeType: 'application/pdf',
  uploadedAt: '2026-07-13T10:00:00.000Z',
  objectPath: 'wallet/uid-1/proofOfId-aaaaaaaaaaaa.pdf',
};
const caps = { maxFilesPerSlot: 10, maxTotalBytes: 1000 * 1024 };

describe('WalletDocumentUpload', () => {
  // happy-dom lacks these object-URL helpers.
  beforeEach(() => {
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(() => 'blob:mock');
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn();
  });

  beforeEach(() => vi.clearAllMocks());

  it('should show an upload prompt when the slot is empty', () => {
    render(
      <WalletDocumentUpload slot={idSlot} docs={[]} principal="p" caps={caps} onStored={vi.fn()} onRemoved={vi.fn()} />,
    );
    expect(screen.getByText(/Upload document/i)).toBeInTheDocument();
  });

  it('should show the used / cap count', () => {
    render(
      <WalletDocumentUpload slot={idSlot} docs={[storedDoc]} principal="p" caps={caps} onStored={vi.fn()} onRemoved={vi.fn()} />,
    );
    expect(screen.getByText('1 / 10')).toBeInTheDocument();
  });

  it('should append a "(buyers)" note for the mortgage slot', () => {
    render(
      <WalletDocumentUpload slot={mortgageSlot} docs={[]} principal="p" caps={caps} onStored={vi.fn()} onRemoved={vi.fn()} />,
    );
    expect(screen.getByText('(buyers)')).toBeInTheDocument();
  });

  it('should store a picked file (passing the tier cap) and call onStored', async () => {
    storeDocument.mockResolvedValue(storedDoc);
    const onStored = vi.fn();
    const { container } = render(
      <WalletDocumentUpload slot={idSlot} docs={[]} principal="p" caps={caps} onStored={onStored} onRemoved={vi.fn()} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'p.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(onStored).toHaveBeenCalledWith(storedDoc));
    expect(storeDocument).toHaveBeenCalledWith(file, idSlot, caps, '');
  });

  it('should offer a label input with the slot label as placeholder and pass the typed label on upload', async () => {
    storeDocument.mockResolvedValue({ ...storedDoc, label: 'Barclays March' });
    const { container } = render(
      <WalletDocumentUpload slot={idSlot} docs={[]} principal="p" caps={caps} onStored={vi.fn()} onRemoved={vi.fn()} />,
    );
    const labelInput = screen.getByPlaceholderText('Proof of Identity') as HTMLInputElement;
    expect(labelInput.maxLength).toBe(60);
    fireEvent.change(labelInput, { target: { value: 'Barclays March' } });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'p.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(storeDocument).toHaveBeenCalledWith(file, idSlot, caps, 'Barclays March'));
    await waitFor(() => expect(labelInput.value).toBe('')); // cleared for the next file
  });

  it('should show a stored label as the row title and let it be renamed', async () => {
    setLabel.mockResolvedValue('Title deed');
    render(
      <WalletDocumentUpload slot={idSlot} docs={[{ ...storedDoc, label: 'Barclays March' }]} principal="p" caps={caps} onStored={vi.fn()} onRemoved={vi.fn()} />,
    );
    expect(screen.getByText('Barclays March')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Rename$/i }));
    fireEvent.change(screen.getByDisplayValue('Barclays March'), { target: { value: 'Title deed' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
    await waitFor(() => expect(setLabel).toHaveBeenCalledWith(expect.objectContaining({ id: 'row-7' }), 'Title deed'));
    expect(await screen.findByText('Title deed')).toBeInTheDocument();
  });

  it('should surface a validation error for a bad type without calling the service', async () => {
    const { container } = render(
      <WalletDocumentUpload slot={idSlot} docs={[]} principal="p" caps={caps} onStored={vi.fn()} onRemoved={vi.fn()} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'n.txt', { type: 'text/plain' })] },
    });
    await waitFor(() => expect(screen.getByText(/PDF, JPG, or PNG/)).toBeInTheDocument());
    expect(storeDocument).not.toHaveBeenCalled();
  });

  it('should list each stored file by date, size and type — never a filename — with a Remove control', () => {
    render(
      <WalletDocumentUpload slot={idSlot} docs={[storedDoc]} principal="p" caps={caps} onStored={vi.fn()} onRemoved={vi.fn()} />,
    );
    expect(screen.queryByText(/passport/)).not.toBeInTheDocument();
    expect(screen.getByText(/^Uploaded /)).toBeInTheDocument();
    expect(screen.getByText(/10 KB · PDF/)).toBeInTheDocument();
    expect(screen.getByText(/aaaaaaaa…aaaaaaaa/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove/i })).toBeInTheDocument();
  });

  it('should remove a stored file after confirming and call onRemoved with the row id', async () => {
    removeEverywhere.mockResolvedValue({ revoked: 0 });
    const onRemoved = vi.fn();
    render(
      <WalletDocumentUpload slot={idSlot} docs={[storedDoc]} principal="p" caps={caps} onStored={vi.fn()} onRemoved={onRemoved} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Remove$/i }));
    expect(screen.getByText(/Remove this file from your wallet\?/)).toBeInTheDocument();
    const removeBtns = screen.getAllByRole('button', { name: /^Remove$/i });
    const confirmBtn = removeBtns[removeBtns.length - 1];
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(onRemoved).toHaveBeenCalledWith('proofOfId', 'row-7'));
    expect(removeEverywhere).toHaveBeenCalledWith(storedDoc);
    expect(removeDocument).not.toHaveBeenCalled();
  });

  it('should disable upload and show "Slot full" once the cap is reached', () => {
    render(
      <WalletDocumentUpload slot={idSlot} docs={[storedDoc]} principal="p" caps={{ maxFilesPerSlot: 1, maxTotalBytes: 1000 }} onStored={vi.fn()} onRemoved={vi.fn()} />,
    );
    const uploadBtn = screen.getByRole('button', { name: /Slot full/i });
    expect(uploadBtn).toBeDisabled();
  });

  it('should download a stored file when its Download is clicked', async () => {
    getFile.mockResolvedValue(new Blob(['x'], { type: 'application/pdf' }));
    render(
      <WalletDocumentUpload slot={idSlot} docs={[storedDoc]} principal="p" caps={caps} onStored={vi.fn()} onRemoved={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Download/i }));
    await waitFor(() => expect(getFile).toHaveBeenCalledWith(storedDoc));
  });

  it('should let a custom slot be named, saving the name locally', () => {
    render(
      <WalletDocumentUpload slot={customSlot} docs={[]} principal="p" caps={caps} onStored={vi.fn()} onRemoved={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Name slot/i }));
    fireEvent.change(screen.getByPlaceholderText('Name this slot'), { target: { value: 'My Deed' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));
    expect(setCustomSlotName).toHaveBeenCalledWith('p', 'custom1', 'My Deed');
    expect(screen.getByText('My Deed')).toBeInTheDocument();
  });
});
