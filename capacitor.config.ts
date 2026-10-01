// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native shell for the iOS and Android apps.
 *
 * The app bundles the built site (`dist-mobile`, from `pnpm build:mobile`)
 * rather than loading propxchain.com live, so it opens on a poor signal and
 * the store reviewers see a working app. A web change therefore reaches the
 * app only with a new store release.
 *
 * `appId` is permanent once the app is published to a store. It is the reverse
 * of the company domain, which PropXchain Ltd controls.
 */
const config: CapacitorConfig = {
  appId: 'com.propxchain.app',
  appName: 'PropXchain',
  webDir: 'dist-mobile',
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
