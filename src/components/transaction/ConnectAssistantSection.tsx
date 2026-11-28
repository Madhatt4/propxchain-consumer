// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React from 'react';
import { Loader2, Plus } from 'lucide-react';
import type { AssistantGrant } from '../../services/assistantConnect.service';

export const CONNECTOR_URL = 'https://mcp.propxchain.com/mcp';

interface ConnectAssistantSectionProps {
  assistants: AssistantGrant[];
  addingPrincipal: string | null;
  isBusy: boolean;
  onAdd: (assistant: AssistantGrant) => void;
}

function shortPrincipal(principal: string): string {
  return principal.length > 13 ? `${principal.slice(0, 5)}…${principal.slice(-5)}` : principal;
}

const ConnectAssistantSection: React.FC<ConnectAssistantSectionProps> = ({ assistants, addingPrincipal, isBusy, onAdd }) => (
  <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-700" data-testid="connect-assistant">
    <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 mb-1 font-['DM_Sans']">Connect your AI assistant</p>
    {assistants.length === 0 ? (
      <p className="text-xs text-stone-500 dark:text-stone-400 font-['DM_Sans']">
        Add PropXchain as a connector in claude.ai ({CONNECTOR_URL}), sign in, then come back here to add it to this deal.
      </p>
    ) : (
      <ul className="space-y-2">
        {assistants.map((assistant) => (
          <li
            key={assistant.principal}
            className="rounded-lg border border-stone-200 dark:border-stone-700 p-3 flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-stone-900 dark:text-stone-100 font-['DM_Sans']">{assistant.label}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-mono" title={assistant.principal}>
                {shortPrincipal(assistant.principal)}
              </p>
            </div>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onAdd(assistant)}
              className="shrink-0 inline-flex items-center gap-1 text-xs rounded-md border border-teal-600/50 text-teal-700 dark:text-teal-300 px-2 py-1 hover:bg-teal-50 dark:hover:bg-teal-900/30 disabled:opacity-60"
            >
              {addingPrincipal === assistant.principal ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              Add to this deal
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export default ConnectAssistantSection;
