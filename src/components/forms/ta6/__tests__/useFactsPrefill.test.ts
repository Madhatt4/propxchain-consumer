// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';

const { mockLoad } = vi.hoisted(() => ({ mockLoad: vi.fn() }));

vi.mock('../../../../services/documentFacts.service', () => ({
  loadCurrentFacts: (...a: unknown[]) => mockLoad(...a),
}));

import { useFactsPrefill } from '../useFactsPrefill';
import { emptyTA6Form } from '../../../../types/ta6.types';
import type { TA6PropertyInformation } from '../../../../types/ta6.types';

const EICR = {
  factKey: 'eicr.satisfactory',
  value: 'true',
  method: 'jev',
  status: 'confirmed',
  storagePath: 'p',
  checkedAt: '2026-10-15T11:00:00.000Z',
  decidedAt: '2026-10-15T11:00:00.000Z',
};

function useHarness(readOnly: boolean) {
  const [form, setForm] = useState<TA6PropertyInformation>({
    ...emptyTA6Form(),
    lastModifiedAt: '2026-10-15T10:00:00.000Z',
  });
  const [dirty, setDirtySteps] = useState<ReadonlySet<number>>(new Set());
  const suggested = useFactsPrefill('tx-1', readOnly, { form, setForm, setDirtySteps });
  return { form, dirty, suggested };
}

describe('useFactsPrefill', () => {
  beforeEach(() => mockLoad.mockReset());

  it('should fill the form once, mark section 11 dirty and report the suggestion', async () => {
    mockLoad.mockResolvedValue([EICR]);

    const { result } = renderHook(() => useHarness(false));

    await waitFor(() => expect(result.current.form.section11.q11_3Eicr).toBe('yes'));
    expect(result.current.dirty.has(11)).toBe(true);
    expect(result.current.suggested.has('11.3')).toBe(true);
    expect(mockLoad).toHaveBeenCalledTimes(1);
  });

  it('should not load or fill anything on a read-only form', async () => {
    mockLoad.mockResolvedValue([EICR]);

    const { result } = renderHook(() => useHarness(true));
    await Promise.resolve();

    expect(mockLoad).not.toHaveBeenCalled();
    expect(result.current.form.section11.q11_3Eicr).toBe('not-answered');
  });
});
