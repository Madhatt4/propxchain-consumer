// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Trim the built site before it is copied into the iOS and Android apps.
 *
 * `public/videos` holds the marketing hero loops (about 19 MB). The apps have
 * no marketing landing page, so shipping them would only make every install
 * and update bigger. The ICP deploy is unaffected: it builds into `dist`, not
 * `dist-mobile`.
 */
import { rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const bundleDir = process.argv[2] ?? 'dist-mobile';
const pruned = ['videos'];

if (!existsSync(bundleDir)) {
  process.stderr.write(`prune-mobile-bundle: ${bundleDir} does not exist, run the build first\n`);
  process.exit(1);
}

for (const name of pruned) {
  rmSync(join(bundleDir, name), { recursive: true, force: true });
}

process.stdout.write(`prune-mobile-bundle: removed ${pruned.join(', ')} from ${bundleDir}\n`);
