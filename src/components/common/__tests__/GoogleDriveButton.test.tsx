// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { isNativeApp, pickFromDrive, preloadDrivePicker } = vi.hoisted(() => ({
  isNativeApp: vi.fn(),
  pickFromDrive: vi.fn(),
  preloadDrivePicker: vi.fn(),
}));

vi.mock('../../../lib/native', () => ({ isNativeApp }));
vi.mock('../../../lib/googleDrivePicker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/googleDrivePicker')>()),
  pickFromDrive,
  preloadDrivePicker,
}));

import GoogleDriveButton from '../GoogleDriveButton';
import { DrivePickerError } from '../../../lib/googleDrivePicker';

function setDriveEnv(): void {
  vi.stubEnv('VITE_GOOGLE_PICKER_API_KEY', 'api-key');
  vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', 'client-id');
  vi.stubEnv('VITE_GOOGLE_PICKER_APP_ID', '123456789');
}

function driveButton(): HTMLElement {
  return screen.getByRole('button', { name: /choose from google drive/i });
}

describe('GoogleDriveButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isNativeApp.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should render nothing when the Google env vars are missing', () => {
    vi.stubEnv('VITE_GOOGLE_PICKER_API_KEY', '');
    vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', 'client-id');
    vi.stubEnv('VITE_GOOGLE_PICKER_APP_ID', '123456789');

    const { container } = render(<GoogleDriveButton onFiles={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('should render nothing inside the native phone app', () => {
    setDriveEnv();
    isNativeApp.mockReturnValue(true);

    const { container } = render(<GoogleDriveButton onFiles={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('should pass the downloaded Drive files to onFiles', async () => {
    setDriveEnv();
    const file = new File(['%PDF-1.4'], 'EPC.pdf', { type: 'application/pdf' });
    pickFromDrive.mockResolvedValue([file]);
    const onFiles = vi.fn();
    render(<GoogleDriveButton onFiles={onFiles} multiple />);

    fireEvent.click(driveButton());

    await waitFor(() => expect(onFiles).toHaveBeenCalledWith([file]));
    expect(pickFromDrive).toHaveBeenCalledWith(
      { apiKey: 'api-key', clientId: 'client-id', appId: '123456789' },
      { multiple: true },
    );
  });

  it('should not call onFiles when the person closes the picker without choosing', async () => {
    setDriveEnv();
    pickFromDrive.mockResolvedValue([]);
    const onFiles = vi.fn();
    render(<GoogleDriveButton onFiles={onFiles} />);

    fireEvent.click(driveButton());

    await waitFor(() => expect(driveButton()).not.toBeDisabled());
    expect(onFiles).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should show the sign-in message and re-enable the button when sign-in is cancelled', async () => {
    setDriveEnv();
    pickFromDrive.mockRejectedValue(
      new DrivePickerError('signin-cancelled', 'Google sign-in was cancelled, so nothing was taken from Drive.'),
    );
    render(<GoogleDriveButton onFiles={vi.fn()} />);

    fireEvent.click(driveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(/sign-in was cancelled/i);
    expect(driveButton()).not.toBeDisabled();
  });

  it('should show the download message and reset when a download fails', async () => {
    setDriveEnv();
    pickFromDrive.mockRejectedValue(new DrivePickerError('download', 'We could not download "EPC.pdf" from Google Drive.'));
    const onFiles = vi.fn();
    render(<GoogleDriveButton onFiles={onFiles} />);

    fireEvent.click(driveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('EPC.pdf');
    expect(driveButton()).not.toBeDisabled();
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('should clear an earlier error when the person tries again', async () => {
    setDriveEnv();
    pickFromDrive.mockRejectedValueOnce(new DrivePickerError('load', 'Google Drive could not be opened.'));
    pickFromDrive.mockResolvedValueOnce([]);
    render(<GoogleDriveButton onFiles={vi.fn()} />);
    fireEvent.click(driveButton());
    await screen.findByRole('alert');

    fireEvent.click(driveButton());

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('should start loading the Google scripts when the pointer reaches the button', () => {
    setDriveEnv();
    render(<GoogleDriveButton onFiles={vi.fn()} />);

    fireEvent.pointerEnter(driveButton());

    expect(preloadDrivePicker).toHaveBeenCalled();
  });
});
