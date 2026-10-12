// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
/**
 * The PropXchain Pro slot.
 *
 * The trade workspaces (conveyancer, estate agent, developer) are proprietary
 * and live in the private monorepo under packages/pro. The production deploy
 * checks that package out into src/pro-private/ before building, and the app
 * serves it at propxchain.com/pro. Every other build (this public repo's CI,
 * a fork, local dev without the private checkout) gets the stub instead.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';

export function resolveProSlot(root: string): string {
  const privateEntry = path.resolve(root, 'src/pro-private/index.tsx');
  return existsSync(privateEntry) ? privateEntry : path.resolve(root, 'src/pro-slot/stub.tsx');
}
