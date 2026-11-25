// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { pickFromDrive } = vi.hoisted(() => ({ pickFromDrive: vi.fn() }));

vi.mock('@/lib/native', () => ({ isNativeApp: () => false }));
vi.mock('@/lib/googleDrivePicker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/googleDrivePicker')>()),
  pickFromDrive,
  preloadDrivePicker: vi.fn(),
}));

import { DocumentSlot } from '../widgets/DocumentSlot';
import type { TA6Upload } from '../widgets/ta6Uploader';

const DRIVE_BUTTON = /choose from google drive/i;

function stubDriveEnv(): void {
  vi.stubEnv('VITE_GOOGLE_PICKER_API_KEY', 'api-key');
  vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', 'client-id');
  vi.stubEnv('VITE_GOOGLE_PICKER_APP_ID', '123456789');
}

function stubNoDriveEnv(): void {
  vi.stubEnv('VITE_GOOGLE_PICKER_API_KEY', '');
  vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', '');
  vi.stubEnv('VITE_GOOGLE_PICKER_APP_ID', '');
}

function renderSlot(onUpload: (file: File) => Promise<TA6Upload>): void {
  render(
    <DocumentSlot
      refCode="4.2"
      prompt={undefined}
      value={{ status: 'not-answered', documentId: null }}
      onChange={vi.fn()}
      onUpload={onUpload}
    />,
  );
}

describe('DocumentSlot Google Drive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should not show the Drive button when the Google env vars are missing', () => {
    stubNoDriveEnv();

    renderSlot(vi.fn());

    expect(screen.queryByRole('button', { name: DRIVE_BUTTON })).not.toBeInTheDocument();
  });

  it('should hand a Drive file to the same upload handler as a chosen local file', async () => {
    stubDriveEnv();
    const file = new File(['jpg'], 'cert.jpg', { type: 'image/jpeg' });
    pickFromDrive.mockResolvedValue([file]);
    const onUpload = vi.fn().mockResolvedValue({ documentId: '7', classification: Promise.resolve(null) });
    renderSlot(onUpload);

    fireEvent.click(screen.getByRole('button', { name: DRIVE_BUTTON }));

    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(file));
  });
});
