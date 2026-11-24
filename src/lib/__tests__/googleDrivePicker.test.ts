// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, expect, it, vi } from 'vitest';
import {
  DRIVE_FILE_SCOPE,
  DRIVE_FILES_URL,
  DrivePickerError,
  GOOGLE_API_SCRIPT_SRC,
  GOOGLE_IDENTITY_SCRIPT_SRC,
  driveErrorMessage,
  pickFromDrive,
  readDriveConfig,
  type DrivePickerDeps,
  type GoogleWindow,
  type PickedDriveFile,
} from '../googleDrivePicker';

const CONFIG = { apiKey: 'api-key', clientId: 'client-id.apps.googleusercontent.com', appId: '123456789' };
const TOKEN = 'ya29.test-token';

interface TokenOutcome {
  response?: { access_token?: string; scope?: string; error?: string };
  errorType?: string;
}

interface PickerOutcome {
  action: 'picked' | 'cancel';
  docs?: PickedDriveFile[];
}

interface FakeGoogle {
  win: GoogleWindow;
  initTokenClient: ReturnType<typeof vi.fn>;
  builderCalls: Record<string, unknown[]>;
}

function fakeGoogle(token: TokenOutcome, picked: PickerOutcome): FakeGoogle {
  const builderCalls: Record<string, unknown[]> = {};
  const record = (name: string, value: unknown): void => {
    builderCalls[name] = [...(builderCalls[name] ?? []), value];
  };
  const view = {
    setMimeTypes: (m: string) => (record('setMimeTypes', m), view),
    setIncludeFolders: () => view,
    setSelectFolderEnabled: () => view,
  };
  class PickerBuilder {
    private callback: (data: PickerOutcome) => void = () => undefined;
    addView(): this { return this; }
    enableFeature(f: string): this { record('enableFeature', f); return this; }
    setAppId(id: string): this { record('setAppId', id); return this; }
    setOAuthToken(t: string): this { record('setOAuthToken', t); return this; }
    setDeveloperKey(k: string): this { record('setDeveloperKey', k); return this; }
    setCallback(cb: (data: PickerOutcome) => void): this { this.callback = cb; return this; }
    build(): { setVisible: () => void } {
      return { setVisible: () => queueMicrotask(() => this.callback(picked)) };
    }
  }
  const initTokenClient = vi.fn((config: {
    callback: (r: NonNullable<TokenOutcome['response']>) => void;
    error_callback: (e: { type: string }) => void;
  }) => ({
    requestAccessToken: () => {
      if (token.errorType) config.error_callback({ type: token.errorType });
      else config.callback(token.response ?? {});
    },
  }));
  const win: GoogleWindow = {
    gapi: { load: (_lib, cfg) => cfg.callback() },
    google: {
      accounts: { oauth2: { initTokenClient } },
      picker: {
        PickerBuilder,
        DocsView: function DocsView() { return view; } as unknown as new (viewId: string) => typeof view,
        ViewId: { DOCS: 'all' },
        Feature: { MULTISELECT_ENABLED: 'multiselectEnabled' },
        Action: { PICKED: 'picked', CANCEL: 'cancel' },
      },
    },
  };
  return { win, initTokenClient, builderCalls };
}

function deps(win: GoogleWindow, fetchImpl?: DrivePickerDeps['fetch']): DrivePickerDeps & { fetch: ReturnType<typeof vi.fn> } {
  return {
    win,
    loadScript: vi.fn().mockResolvedValue(undefined),
    fetch: vi.fn(fetchImpl ?? (async () => new Response(new Blob(['%PDF-1.4']), { status: 200 }))),
  };
}

const GRANTED = { response: { access_token: TOKEN, scope: DRIVE_FILE_SCOPE } };
const PDF_DOC: PickedDriveFile = { id: 'file-1', name: 'EPC.pdf', mimeType: 'application/pdf' };
const PNG_DOC: PickedDriveFile = { id: 'file-2', name: 'FENSA.png', mimeType: 'image/png' };
const GOOGLE_DOC: PickedDriveFile = { id: 'doc-3', name: 'Lease notes', mimeType: 'application/vnd.google-apps.document' };

describe('readDriveConfig', () => {
  it('should return null when any of the three env vars is missing', () => {
    const env = { VITE_GOOGLE_PICKER_API_KEY: 'k', VITE_GOOGLE_OAUTH_CLIENT_ID: 'c', VITE_GOOGLE_PICKER_APP_ID: '' };

    const result = readDriveConfig(env);

    expect(result).toBeNull();
  });

  it('should return the config when all three env vars are set', () => {
    const env = { VITE_GOOGLE_PICKER_API_KEY: 'k', VITE_GOOGLE_OAUTH_CLIENT_ID: 'c', VITE_GOOGLE_PICKER_APP_ID: '9' };

    const result = readDriveConfig(env);

    expect(result).toEqual({ apiKey: 'k', clientId: 'c', appId: '9' });
  });
});

describe('pickFromDrive', () => {
  it('should load both Google scripts before asking for a token', async () => {
    const google = fakeGoogle(GRANTED, { action: 'cancel' });
    const d = deps(google.win);

    await pickFromDrive(CONFIG, {}, d);

    expect(d.loadScript).toHaveBeenCalledWith(GOOGLE_IDENTITY_SCRIPT_SRC);
    expect(d.loadScript).toHaveBeenCalledWith(GOOGLE_API_SCRIPT_SRC);
  });

  it('should request only the drive.file scope', async () => {
    const google = fakeGoogle(GRANTED, { action: 'cancel' });

    await pickFromDrive(CONFIG, {}, deps(google.win));

    const tokenConfig = google.initTokenClient.mock.calls[0][0];
    expect(tokenConfig.scope).toBe(DRIVE_FILE_SCOPE);
    expect(tokenConfig.scope).toBe('https://www.googleapis.com/auth/drive.file');
    expect(tokenConfig.include_granted_scopes).toBe(false);
    expect(tokenConfig.client_id).toBe(CONFIG.clientId);
  });

  it('should configure the picker with the app id, token, api key and accepted file types', async () => {
    const google = fakeGoogle(GRANTED, { action: 'cancel' });

    await pickFromDrive(CONFIG, { multiple: true }, deps(google.win));

    expect(google.builderCalls.setAppId).toEqual([CONFIG.appId]);
    expect(google.builderCalls.setOAuthToken).toEqual([TOKEN]);
    expect(google.builderCalls.setDeveloperKey).toEqual([CONFIG.apiKey]);
    expect(google.builderCalls.enableFeature).toEqual(['multiselectEnabled']);
    expect(String(google.builderCalls.setMimeTypes[0]).split(',')).toEqual(
      expect.arrayContaining(['application/pdf', 'image/jpeg', 'image/png']),
    );
  });

  it('should not enable multiselect when multiple is not asked for', async () => {
    const google = fakeGoogle(GRANTED, { action: 'cancel' });

    await pickFromDrive(CONFIG, {}, deps(google.win));

    expect(google.builderCalls.enableFeature).toBeUndefined();
  });

  it('should download each picked file with the bearer token and return File objects', async () => {
    const google = fakeGoogle(GRANTED, { action: 'picked', docs: [PDF_DOC, PNG_DOC] });
    const d = deps(google.win);

    const files = await pickFromDrive(CONFIG, { multiple: true }, d);

    expect(d.fetch).toHaveBeenCalledWith(`${DRIVE_FILES_URL}/file-1?alt=media&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(d.fetch).toHaveBeenCalledWith(`${DRIVE_FILES_URL}/file-2?alt=media&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(files).toHaveLength(2);
    expect(files[0]).toBeInstanceOf(File);
    expect(files.map((f) => [f.name, f.type])).toEqual([
      ['EPC.pdf', 'application/pdf'],
      ['FENSA.png', 'image/png'],
    ]);
  });

  it('should export a Google Docs-native file to PDF through the export endpoint', async () => {
    const google = fakeGoogle(GRANTED, { action: 'picked', docs: [GOOGLE_DOC] });
    const d = deps(google.win);

    const [file] = await pickFromDrive(CONFIG, {}, d);

    expect(d.fetch).toHaveBeenCalledWith(`${DRIVE_FILES_URL}/doc-3/export?mimeType=application%2Fpdf`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(file.name).toBe('Lease notes.pdf');
    expect(file.type).toBe('application/pdf');
  });

  it('should return no files and download nothing when the picker is cancelled', async () => {
    const google = fakeGoogle(GRANTED, { action: 'cancel' });
    const d = deps(google.win);

    const files = await pickFromDrive(CONFIG, {}, d);

    expect(files).toEqual([]);
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it('should reject as signin-cancelled when the Google sign-in popup is closed', async () => {
    const google = fakeGoogle({ errorType: 'popup_closed' }, { action: 'cancel' });

    const result = pickFromDrive(CONFIG, {}, deps(google.win));

    await expect(result).rejects.toMatchObject({ kind: 'signin-cancelled' });
  });

  it('should reject as signin-cancelled when the person denies access', async () => {
    const google = fakeGoogle({ response: { error: 'access_denied' } }, { action: 'cancel' });

    const result = pickFromDrive(CONFIG, {}, deps(google.win));

    await expect(result).rejects.toMatchObject({ kind: 'signin-cancelled' });
  });

  it('should reject as signin-failed when the drive.file permission was not granted', async () => {
    const google = fakeGoogle({ response: { access_token: TOKEN, scope: 'email' } }, { action: 'cancel' });
    const d = deps(google.win);

    const result = pickFromDrive(CONFIG, {}, d);

    await expect(result).rejects.toMatchObject({ kind: 'signin-failed' });
    expect(google.builderCalls.setOAuthToken).toBeUndefined();
  });

  it('should reject as download with the file name when Drive returns an error status', async () => {
    const google = fakeGoogle(GRANTED, { action: 'picked', docs: [PDF_DOC] });
    const d = deps(google.win, async () => new Response('nope', { status: 403 }));

    const result = pickFromDrive(CONFIG, {}, d);

    await expect(result).rejects.toMatchObject({ kind: 'download', message: expect.stringContaining('EPC.pdf') });
  });

  it('should reject as download when the network request throws', async () => {
    const google = fakeGoogle(GRANTED, { action: 'picked', docs: [PDF_DOC] });
    const d = deps(google.win, async () => {
      throw new TypeError('Failed to fetch');
    });

    const result = pickFromDrive(CONFIG, {}, d);

    await expect(result).rejects.toMatchObject({ kind: 'download' });
  });

  it('should reject as load when the Google scripts fail to load', async () => {
    const google = fakeGoogle(GRANTED, { action: 'cancel' });
    const d = deps(google.win);
    d.loadScript = vi.fn().mockRejectedValue(new DrivePickerError('load', 'x'));

    const result = pickFromDrive(CONFIG, {}, d);

    await expect(result).rejects.toMatchObject({ kind: 'load' });
    expect(google.initTokenClient).not.toHaveBeenCalled();
  });

  it('should reject as load when the picker library is missing after the scripts load', async () => {
    const d = deps({ gapi: { load: (_lib, cfg) => cfg.callback() }, google: {} });

    const result = pickFromDrive(CONFIG, {}, d);

    await expect(result).rejects.toMatchObject({ kind: 'load' });
  });
});

describe('driveErrorMessage', () => {
  it('should return the Drive error message for a DrivePickerError', () => {
    const message = driveErrorMessage(new DrivePickerError('signin-cancelled', 'Google sign-in was cancelled.'));

    expect(message).toBe('Google sign-in was cancelled.');
  });

  it('should return a generic message for anything else', () => {
    const message = driveErrorMessage(new Error('internal detail'));

    expect(message).not.toContain('internal detail');
  });
});
