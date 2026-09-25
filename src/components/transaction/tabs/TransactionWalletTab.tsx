// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * TransactionWalletTab — the deal's "Transaction Wallet" tab. Hosts Documents
 * (PropXchain Wallet files sent to this deal) and — only when a VC verifier is
 * configured (wallet spec decision 7) — Credentials. Files and credentials are
 * different things sharing one home.
 */
import { useState } from 'react';
import { walletVcMode } from '@/services/walletVc.service';
import { FileText, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TransactionTabProps } from './transactionTabs.config';
import { WalletVcTab } from './WalletVcTab';
import { TransactionDocumentsTab } from './TransactionDocumentsTab';

type SubTab = 'documents' | 'credentials';

function SubTabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium ${
        active
          ? 'border-teal-600 text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

export function TransactionWalletTab(props: TransactionTabProps): JSX.Element {
  const [sub, setSub] = useState<SubTab>('documents');
  const hasCredentials = walletVcMode() !== 'unavailable';
  if (!hasCredentials) return <TransactionDocumentsTab {...props} />;
  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border">
        <SubTabButton
          active={sub === 'documents'}
          onClick={() => setSub('documents')}
          icon={FileText}
          label="Documents"
        />
        <SubTabButton
          active={sub === 'credentials'}
          onClick={() => setSub('credentials')}
          icon={ShieldCheck}
          label="Credentials"
        />
      </div>
      {sub === 'documents' ? <TransactionDocumentsTab {...props} /> : <WalletVcTab {...props} />}
    </div>
  );
}

export default TransactionWalletTab;
