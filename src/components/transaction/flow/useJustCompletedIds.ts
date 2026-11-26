// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { useCallback, useState } from 'react';

interface StatusItem {
  id: string;
  status: string;
}

interface JustCompletedState {
  statusKey: string;
  statuses: ReadonlyMap<string, string>;
  ids: ReadonlySet<string>;
}

export interface JustCompleted {
  ids: ReadonlySet<string>;
  markDone: (id: string) => void;
}

function statusKeyOf(items: readonly StatusItem[]): string {
  return items.map((i) => `${i.id}=${i.status}`).join('|');
}

function snapshot(items: readonly StatusItem[], ids: ReadonlySet<string>): JustCompletedState {
  return { statusKey: statusKeyOf(items), statuses: new Map(items.map((i) => [i.id, i.status])), ids };
}

function carryJustCompleted(state: JustCompletedState, items: readonly StatusItem[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (item.status !== 'completed') continue;
    const before = state.statuses.get(item.id);
    const isFreshlyCompleted = before !== undefined && before !== 'completed';
    if (isFreshlyCompleted || state.ids.has(item.id)) ids.add(item.id);
  }
  return ids;
}

export function useJustCompletedIds(items: readonly StatusItem[]): JustCompleted {
  const [state, setState] = useState<JustCompletedState>(() => snapshot(items, new Set()));
  let current = state;
  if (statusKeyOf(items) !== state.statusKey) {
    current = snapshot(items, carryJustCompleted(state, items));
    setState(current);
  }
  const markDone = useCallback((id: string) => {
    setState((prev) => {
      if (!prev.ids.has(id)) return prev;
      const ids = new Set(prev.ids);
      ids.delete(id);
      return { ...prev, ids };
    });
  }, []);
  return { ids: current.ids, markDone };
}
