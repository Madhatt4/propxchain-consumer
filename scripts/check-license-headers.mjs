#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
/**
 * Guard: no tracked file claims to be proprietary.
 *
 * WHY THIS EXISTS
 * ---------------
 * This repo is licensed AGPL-3.0-or-later, but 613 source files opened with a
 * "proprietary and confidential, all rights reserved" notice that contradicted
 * the LICENSE. One sweep replaced them with an SPDX header. New files are
 * usually started by copying a neighbour, so without this check the old notice
 * would creep back in with the first file copied from an old branch.
 *
 * WHAT IT CHECKS
 * --------------
 * Every tracked text file. The phrase is assembled at runtime so this file
 * does not match itself. New source files should open with:
 *
 *   // SPDX-License-Identifier: AGPL-3.0-or-later
 *   // Copyright (C) <year> PropXchain Ltd
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PHRASE = ['Proprietary', 'and', 'confidential'].join(' ');
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|mp4|webm|woff2?|ttf|otf|pdf|wasm|gz|zip)$/i;

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !BINARY.test(f));

const hits = files.filter((f) => {
  try {
    return readFileSync(f, 'utf8').includes(PHRASE);
  } catch {
    return false; // listed but absent from this checkout, e.g. a sparse CI clone
  }
});

if (hits.length > 0) {
  console.error(`License header check FAILED: ${hits.length} file(s) still say "${PHRASE}".`);
  for (const f of hits) console.error(`  ${f}`);
  console.error('\nReplace the notice with:\n  // SPDX-License-Identifier: AGPL-3.0-or-later\n  // Copyright (C) <year> PropXchain Ltd');
  process.exit(1);
}

console.log(`license headers OK — ${files.length} tracked text files, none proprietary`);
