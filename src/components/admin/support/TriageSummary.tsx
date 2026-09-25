// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * What triage thought of a ticket, shown to whoever is about to answer it.
 *
 * Every figure is labelled as a read, not a fact: the category carries the
 * probability it was chosen with, and the three judgement calls are shown as
 * percentages rather than as ticks. An admin overruling any of them is the
 * normal case, so nothing here is presented as settled.
 */
import React from 'react';
import { categoryLabel } from '../../../services/supportTicket.service';
import { asPercent, isUntriaged, readTriage, urgencyLabel } from './triage';

interface TriageSummaryProps {
  triage: Record<string, unknown> | null;
}

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-4 py-1">
    <dt className="text-sm text-gray-600 dark:text-gray-400">{label}</dt>
    <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</dd>
  </div>
);

const TriageSummary: React.FC<TriageSummaryProps> = ({ triage }) => {
  const read = readTriage(triage);

  if (read.error) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Triage did not run on this ticket ({read.error}). Answer it on its own merits.
      </p>
    );
  }

  if (isUntriaged(read)) {
    return <p className="text-sm text-gray-600 dark:text-gray-400">This ticket was raised untriaged.</p>;
  }

  const category = read.category
    ? `${categoryLabel(read.category.value)}${
        read.category.probability === null ? '' : ` · ${asPercent(read.category.probability)}`
      }`
    : '—';

  return (
    <dl className="divide-y divide-gray-200 dark:divide-gray-700">
      <Row label="Category" value={category} />
      <Row
        label="Urgency"
        value={read.urgency === null ? 'Not scored' : `${read.urgency}/3 · ${urgencyLabel(read.urgency)}`}
      />
      <Row label="Blocks the transaction" value={asPercent(read.blocksTransaction)} />
      <Row label="Describes a bug" value={asPercent(read.isBug)} />
      <Row label="Answerable from Help" value={asPercent(read.answerableFromHelp)} />
    </dl>
  );
};

export default TriageSummary;
