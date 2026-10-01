// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { Capacitor } from '@capacitor/core';

/**
 * True only inside the iOS or Android app (the Capacitor shell). False in every
 * browser, including a phone browser, so the website behaves exactly as before.
 *
 * Use this to choose between the app and the website. Do not use it to hide a
 * feature from the app that the website offers without a written reason.
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}
