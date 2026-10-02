// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { isNativeApp, scanDocument } = vi.hoisted(() => ({
  isNativeApp: vi.fn(),
  scanDocument: vi.fn(),
}));

vi.mock('../../../lib/native', () => ({ isNativeApp }));
vi.mock('../../../lib/nativeScan', () => ({ scanDocument }));

import ScanButton from '../ScanButton';

describe('ScanButton', () => {
  beforeEach(() => {
    isNativeApp.mockReset();
    scanDocument.mockReset();
  });

  it('renders nothing outside the native app', () => {
    isNativeApp.mockReturnValue(false);
    const { container } = render(<ScanButton onFile={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the button in the native app', () => {
    isNativeApp.mockReturnValue(true);
    render(<ScanButton onFile={vi.fn()} />);
    expect(screen.getByRole('button', { name: /scan with camera/i })).toBeTruthy();
  });

  it('passes the scanned file to onFile', async () => {
    isNativeApp.mockReturnValue(true);
    const file = new File(['abc'], 'scan.jpg', { type: 'image/jpeg' });
    scanDocument.mockResolvedValue(file);
    const onFile = vi.fn();
    render(<ScanButton onFile={onFile} />);
    fireEvent.click(screen.getByRole('button', { name: /scan with camera/i }));
    await waitFor(() => expect(onFile).toHaveBeenCalledWith(file));
  });

  it('does nothing when the person cancels', async () => {
    isNativeApp.mockReturnValue(true);
    scanDocument.mockResolvedValue(null);
    const onFile = vi.fn();
    render(<ScanButton onFile={onFile} />);
    fireEvent.click(screen.getByRole('button', { name: /scan with camera/i }));
    await waitFor(() => expect(scanDocument).toHaveBeenCalled());
    expect(onFile).not.toHaveBeenCalled();
  });

  it('shows an alert when the camera fails', async () => {
    isNativeApp.mockReturnValue(true);
    scanDocument.mockRejectedValue(new Error('denied'));
    render(<ScanButton onFile={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /scan with camera/i }));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
