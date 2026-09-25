/**
 * HMLR Register Card — shows the on-chain anchor for the Stage-1 title pull.
 * The register itself lives off-chain; only its hash is anchored (matrix:
 * On+hash), so this card renders title number + fetch time + hash anchor.
 */

import React from 'react';
import { Landmark } from 'lucide-react';
import type { HmlrFetchAudit } from '../../services/transactionAudit';

interface HmlrRegisterCardProps {
  hmlrFetch: HmlrFetchAudit | null;
}

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

function formatDate(ns: number): string {
  const ms = ns > 1e15 ? ns / 1_000_000 : ns;
  return new Date(ms).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const HmlrRegisterCard: React.FC<HmlrRegisterCardProps> = ({ hmlrFetch }) => {
  if (!hmlrFetch) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-slate-400">
        The HMLR title register has not been pulled for this transaction yet
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-slate-800/50">
      <Landmark className="w-5 h-5 text-teal-500 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
          {hmlrFetch.titleNumber || 'Title number pending'}
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Official copy fetched {formatDate(hmlrFetch.fetchedAt)}
        </p>
        <p className="text-xs font-geist-mono text-gray-500 dark:text-slate-400 break-all">
          Anchor: {truncateHash(hmlrFetch.responseHash)}
        </p>
      </div>
    </div>
  );
};

export default HmlrRegisterCard;
