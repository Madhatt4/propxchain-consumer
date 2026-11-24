// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
export const GOOGLE_API_SCRIPT_SRC = 'https://apis.google.com/js/api.js';
export const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';

const GOOGLE_NATIVE_MIME_PREFIX = 'application/vnd.google-apps.';
const PDF_MIME = 'application/pdf';
const PICKER_LOAD_TIMEOUT_MS = 15_000;

const DRIVE_PICKER_MIME_TYPES = [
  PDF_MIME,
  'image/jpeg',
  'image/png',
  `${GOOGLE_NATIVE_MIME_PREFIX}document`,
  `${GOOGLE_NATIVE_MIME_PREFIX}spreadsheet`,
  `${GOOGLE_NATIVE_MIME_PREFIX}presentation`,
];

const LOAD_FAILED_MESSAGE = 'Google Drive could not be opened. Check your connection and try again.';
const SIGN_IN_CANCELLED_MESSAGE = 'Google sign-in was cancelled, so nothing was taken from Drive.';
const SIGN_IN_FAILED_MESSAGE = 'We could not sign you in to Google. Please try again.';
const SCOPE_NOT_GRANTED_MESSAGE =
  'Google did not give PropXchain permission to open the files you choose. Please try again and allow it.';
const GENERIC_FAILURE_MESSAGE = 'Something went wrong with Google Drive. Please try again.';

export type DrivePickerErrorKind = 'load' | 'signin-cancelled' | 'signin-failed' | 'download';

export class DrivePickerError extends Error {
  readonly kind: DrivePickerErrorKind;

  constructor(kind: DrivePickerErrorKind, message: string) {
    super(message);
    this.name = 'DrivePickerError';
    this.kind = kind;
  }
}

export interface DriveConfig {
  apiKey: string;
  clientId: string;
  appId: string;
}

export interface PickedDriveFile {
  id: string;
  name: string;
  mimeType: string;
}

interface TokenResponse {
  access_token?: string;
  scope?: string;
  error?: string;
}

interface TokenClientError {
  type: string;
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  include_granted_scopes: boolean;
  callback: (response: TokenResponse) => void;
  error_callback: (error: TokenClientError) => void;
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}

interface GoogleAccounts {
  oauth2: { initTokenClient: (config: TokenClientConfig) => TokenClient };
}

interface PickerCallbackData {
  action: string;
  docs?: PickedDriveFile[];
}

interface DocsView {
  setMimeTypes: (mimeTypes: string) => DocsView;
  setIncludeFolders: (include: boolean) => DocsView;
  setSelectFolderEnabled: (enabled: boolean) => DocsView;
}

interface PickerBuilder {
  addView: (view: DocsView) => PickerBuilder;
  enableFeature: (feature: string) => PickerBuilder;
  setAppId: (appId: string) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
  setDeveloperKey: (key: string) => PickerBuilder;
  setCallback: (callback: (data: PickerCallbackData) => void) => PickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
}

interface PickerNamespace {
  PickerBuilder: new () => PickerBuilder;
  DocsView: new (viewId: string) => DocsView;
  ViewId: { DOCS: string };
  Feature: { MULTISELECT_ENABLED: string };
  Action: { PICKED: string; CANCEL: string };
}

interface GapiLoadConfig {
  callback: () => void;
  onerror: () => void;
  timeout: number;
  ontimeout: () => void;
}

export interface GoogleWindow {
  gapi?: { load: (library: string, config: GapiLoadConfig) => void };
  google?: { accounts?: GoogleAccounts; picker?: PickerNamespace };
}

export interface DrivePickerDeps {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  win: GoogleWindow;
  loadScript: (src: string) => Promise<void>;
}

export interface PickFromDriveOptions {
  multiple?: boolean;
}

type DriveEnv = Readonly<Record<string, string | undefined>>;

export function readDriveConfig(env: DriveEnv = import.meta.env): DriveConfig | null {
  const apiKey = env.VITE_GOOGLE_PICKER_API_KEY?.trim();
  const clientId = env.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim();
  const appId = env.VITE_GOOGLE_PICKER_APP_ID?.trim();
  return apiKey && clientId && appId ? { apiKey, clientId, appId } : null;
}

const scriptLoads = new Map<string, Promise<void>>();

export function loadScriptOnce(src: string, doc: Document = document): Promise<void> {
  const cached = scriptLoads.get(src);
  if (cached) return cached;
  const pending = new Promise<void>((resolve, reject) => {
    const script = doc.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = (): void => resolve();
    script.onerror = (): void => {
      scriptLoads.delete(src);
      script.remove();
      reject(new DrivePickerError('load', LOAD_FAILED_MESSAGE));
    };
    doc.head.appendChild(script);
  });
  scriptLoads.set(src, pending);
  return pending;
}

function defaultDeps(): DrivePickerDeps {
  return {
    fetch: (url, init) => globalThis.fetch(url, init),
    win: window as unknown as GoogleWindow,
    loadScript: (src) => loadScriptOnce(src),
  };
}

function loadGoogleScripts(deps: DrivePickerDeps): Promise<void[]> {
  return Promise.all([deps.loadScript(GOOGLE_IDENTITY_SCRIPT_SRC), deps.loadScript(GOOGLE_API_SCRIPT_SRC)]);
}

export function preloadDrivePicker(deps: DrivePickerDeps = defaultDeps()): void {
  loadGoogleScripts(deps).catch(() => undefined);
}

async function loadGoogle(deps: DrivePickerDeps): Promise<{ accounts: GoogleAccounts; picker: PickerNamespace }> {
  await loadGoogleScripts(deps);
  const gapi = deps.win.gapi;
  if (!gapi) throw new DrivePickerError('load', LOAD_FAILED_MESSAGE);
  await new Promise<void>((resolve, reject) => {
    const fail = (): void => reject(new DrivePickerError('load', LOAD_FAILED_MESSAGE));
    gapi.load('picker', { callback: resolve, onerror: fail, timeout: PICKER_LOAD_TIMEOUT_MS, ontimeout: fail });
  });
  const accounts = deps.win.google?.accounts;
  const picker = deps.win.google?.picker;
  if (!accounts?.oauth2 || !picker) throw new DrivePickerError('load', LOAD_FAILED_MESSAGE);
  return { accounts, picker };
}

function hasDriveFileScope(response: TokenResponse): boolean {
  return (response.scope ?? '').split(/\s+/).includes(DRIVE_FILE_SCOPE);
}

function requestDriveToken(accounts: GoogleAccounts, clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_FILE_SCOPE,
      include_granted_scopes: false,
      callback: (response) => {
        if (response.error === 'access_denied') {
          reject(new DrivePickerError('signin-cancelled', SIGN_IN_CANCELLED_MESSAGE));
        } else if (!response.access_token) {
          reject(new DrivePickerError('signin-failed', SIGN_IN_FAILED_MESSAGE));
        } else if (!hasDriveFileScope(response)) {
          reject(new DrivePickerError('signin-failed', SCOPE_NOT_GRANTED_MESSAGE));
        } else {
          resolve(response.access_token);
        }
      },
      error_callback: (error) => {
        const isCancelled = error.type === 'popup_closed';
        reject(
          new DrivePickerError(
            isCancelled ? 'signin-cancelled' : 'signin-failed',
            isCancelled ? SIGN_IN_CANCELLED_MESSAGE : SIGN_IN_FAILED_MESSAGE,
          ),
        );
      },
    });
    client.requestAccessToken({ prompt: '' });
  });
}

function showPicker(
  picker: PickerNamespace,
  config: DriveConfig,
  token: string,
  isMultiple: boolean,
): Promise<PickedDriveFile[]> {
  return new Promise((resolve) => {
    const view = new picker.DocsView(picker.ViewId.DOCS)
      .setMimeTypes(DRIVE_PICKER_MIME_TYPES.join(','))
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);
    let builder = new picker.PickerBuilder()
      .addView(view)
      .setAppId(config.appId)
      .setOAuthToken(token)
      .setDeveloperKey(config.apiKey)
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED) resolve(data.docs ?? []);
        else if (data.action === picker.Action.CANCEL) resolve([]);
      });
    if (isMultiple) builder = builder.enableFeature(picker.Feature.MULTISELECT_ENABLED);
    builder.build().setVisible(true);
  });
}

function isGoogleNative(mimeType: string): boolean {
  return mimeType.startsWith(GOOGLE_NATIVE_MIME_PREFIX);
}

function driveDownloadUrl(file: PickedDriveFile): string {
  const id = encodeURIComponent(file.id);
  return isGoogleNative(file.mimeType)
    ? `${DRIVE_FILES_URL}/${id}/export?mimeType=${encodeURIComponent(PDF_MIME)}`
    : `${DRIVE_FILES_URL}/${id}?alt=media&supportsAllDrives=true`;
}

function downloadFailed(file: PickedDriveFile): DrivePickerError {
  return new DrivePickerError('download', `We could not download "${file.name}" from Google Drive. Please try again.`);
}

async function downloadDriveFile(
  file: PickedDriveFile,
  token: string,
  fetchFn: DrivePickerDeps['fetch'],
): Promise<File> {
  let response: Response;
  try {
    response = await fetchFn(driveDownloadUrl(file), { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw downloadFailed(file);
  }
  if (!response.ok) throw downloadFailed(file);
  const blob = await response.blob();
  if (isGoogleNative(file.mimeType)) {
    const name = /\.pdf$/i.test(file.name) ? file.name : `${file.name}.pdf`;
    return new File([blob], name, { type: PDF_MIME });
  }
  return new File([blob], file.name, { type: file.mimeType || blob.type });
}

export async function pickFromDrive(
  config: DriveConfig,
  options: PickFromDriveOptions = {},
  deps: DrivePickerDeps = defaultDeps(),
): Promise<File[]> {
  const { accounts, picker } = await loadGoogle(deps);
  const token = await requestDriveToken(accounts, config.clientId);
  const picked = await showPicker(picker, config, token, options.multiple ?? false);
  return Promise.all(picked.map((file) => downloadDriveFile(file, token, deps.fetch)));
}

export function driveErrorMessage(error: unknown): string {
  return error instanceof DrivePickerError ? error.message : GENERIC_FAILURE_MESSAGE;
}
