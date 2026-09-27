// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

export interface PrerenderPage {
  route: string;
  title: string;
  description: string;
  main: string;
  category?: string;
  catName?: string;
  published?: string;
  modified?: string;
  crumb?: string;
}
export const resourcePages: PrerenderPage[];
