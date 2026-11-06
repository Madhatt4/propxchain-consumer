// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React, { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { useEstateAgentOrg } from '@/hooks/useEstateAgentOrg';

const SCHEME_NAMES: Record<string, string> = {
  PRS: 'Property Redress Scheme',
  TPO: 'The Property Ombudsman',
};

const MAX_NUMBER_LENGTH = 40;

interface RedressRow {
  redress_scheme: string | null;
  redress_number: string | null;
}

const redressKey = (organisationId: string | null): unknown[] => ['agent-redress', organisationId];

/** The agency's scheme and number. A null number means membership is pending. */
function useAgentRedress(organisationId: string | null): RedressRow | undefined {
  const { data } = useQuery({
    queryKey: redressKey(organisationId),
    enabled: !!organisationId,
    queryFn: async (): Promise<RedressRow> => {
      const { data, error } = await supabase
        .from('organisations')
        .select('redress_scheme, redress_number')
        .eq('id', organisationId!)
        .single();
      if (error) throw new Error(`Failed to load redress details: ${error.message}`);
      return data as RedressRow;
    },
  });
  return data;
}

/** Saves the number on the agency's org row (org admins may update it under RLS). */
async function saveRedressNumber(organisationId: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('organisations')
    .update({ redress_number: value })
    .eq('id', organisationId);
  if (error) throw new Error(error.message);
}

interface RedressNumberFormProps {
  onSave: (value: string) => void;
  isSaving: boolean;
  saveFailed: boolean;
}

/** Inline number input; validates length before handing the value up. */
const RedressNumberForm: React.FC<RedressNumberFormProps> = ({ onSave, isSaving, saveFailed }) => {
  const [value, setValue] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setInputError('Enter your membership number');
    } else if (trimmed.length > MAX_NUMBER_LENGTH) {
      setInputError(`Keep it under ${MAX_NUMBER_LENGTH} characters`);
    } else {
      setInputError(null);
      onSave(trimmed);
    }
  };
  const error = inputError ?? (saveFailed ? "Couldn't save the number. Please try again." : null);
  return (
    <>
      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="redress-pending-number" className="sr-only">Membership number</label>
        <input
          id="redress-pending-number"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Membership number"
          className="w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 font-[DM_Sans] text-sm text-gray-900 focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488] sm:max-w-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-50"
        />
        <button type="submit" disabled={isSaving} className="inline-flex min-h-10 items-center justify-center rounded-md bg-[#0D9488] px-4 py-2 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:opacity-60">
          {isSaving ? 'Saving…' : 'Save number'}
        </button>
      </form>
      {error && <p role="alert" className="mt-2 font-[DM_Sans] text-sm text-[#DC2626] dark:text-[#FCA5A5]">{error}</p>}
    </>
  );
};

/**
 * Shown across the agent portal while an agency signed up with "membership
 * pending" and has not yet added its redress scheme number. Renders nothing
 * once a number is on file.
 */
export const RedressPendingBanner: React.FC = () => {
  const { organisationId } = useEstateAgentOrg();
  const redress = useAgentRedress(organisationId);
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (number: string) => saveRedressNumber(organisationId!, number),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: redressKey(organisationId) }),
  });

  if (!organisationId || !redress || redress.redress_number) return null;
  const schemeName = SCHEME_NAMES[redress.redress_scheme ?? ''] ?? 'your redress scheme';

  return (
    <section data-testid="redress-pending-banner" className="mb-6 rounded-lg border border-[#FDBA74] bg-[#FFF7ED] p-4 dark:border-[#9A3412] dark:bg-[#431407]/30">
      <p className="flex items-center gap-2 font-[DM_Sans] text-sm font-medium text-[#9A3412] dark:text-[#FDBA74]">
        <AlertTriangle size={14} aria-hidden /> Redress membership pending
      </p>
      <p className="mt-1 font-[DM_Sans] text-sm text-gray-700 dark:text-gray-200">
        Add your {schemeName} membership number as soon as it arrives. By law, an estate agent must
        belong to a redress scheme to do residential estate agency work.
      </p>
      <RedressNumberForm onSave={(v) => save.mutate(v)} isSaving={save.isPending} saveFailed={save.isError} />
    </section>
  );
};

export default RedressPendingBanner;
