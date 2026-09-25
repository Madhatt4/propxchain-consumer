// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState, useEffect } from 'react';
import { logger } from '@/utils/logger';
import { messageService } from '../../services/message.service';
import { ChaseRecipient, RecipientSelectorProps } from '../../types/message.types';
import { User, Mail, Clock, ChevronDown, Loader2, Users, AlertCircle, Edit3, Plus } from 'lucide-react';

export const RecipientSelector: React.FC<RecipientSelectorProps> = ({
  transactionId,
  selectedRecipient,
  onSelectRecipient,
  excludePrincipal,
  disabled = false,
}) => {
  const [recipients, setRecipients] = useState<ChaseRecipient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualPrincipal, setManualPrincipal] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    const loadRecipients = async () => {
      if (!transactionId) {
        setRecipients([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const stakeholders = await messageService.getChaseableStakeholders(transactionId);

        // Filter out excluded principal and non-chaseable stakeholders
        const filtered = stakeholders.filter(
          (s) => s.canChase && (!excludePrincipal || s.principal !== excludePrincipal)
        );

        setRecipients(filtered);

        if (filtered.length === 0 && stakeholders.length > 0) {
          setError('You are the only stakeholder in this transaction. Use manual entry below.');
        }
      } catch (err) {
        logger.error('Error loading recipients:', err);
        setError('Failed to load stakeholders.');
      } finally {
        setIsLoading(false);
      }
    };

    loadRecipients();
  }, [transactionId, excludePrincipal]);

  const handleSelect = (recipient: ChaseRecipient) => {
    onSelectRecipient(recipient);
    setIsOpen(false);
  };

  const handleManualAdd = async () => {
    const trimmed = manualPrincipal.trim();
    if (!trimmed) return;

    setManualError(null);

    // Validate principal format
    try {
      const { Principal } = await import('@propxchain/core-client');
      Principal.fromText(trimmed);
    } catch {
      setManualError('Invalid principal ID format');
      return;
    }

    if (trimmed === excludePrincipal) {
      setManualError("You can't send a message to yourself");
      return;
    }

    // Check if it matches an existing stakeholder
    const existing = recipients.find(r => r.principal === trimmed);
    if (existing) {
      onSelectRecipient(existing);
      setIsOpen(false);
      setManualPrincipal('');
      return;
    }

    // Create a custom ChaseRecipient
    const customRecipient: ChaseRecipient = {
      principal: trimmed,
      name: `${trimmed.slice(0, 8)}...${trimmed.slice(-5)}`,
      role: 'other',
      roleDisplay: 'Custom Recipient',
      canChase: true,
      hasEmail: false,
    };

    onSelectRecipient(customRecipient);
    setIsOpen(false);
    setManualPrincipal('');
  };

  const handleManualKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleManualAdd();
    }
  };

  const getRoleColor = (role: ChaseRecipient['role']) => {
    const colors: Record<ChaseRecipient['role'] | 'conveyancer', string> = {
      buyer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      seller: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      solicitor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      conveyancer: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      estate_agent: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      mortgage_broker: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
      other: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    };
    return colors[role] || colors.other;
  };

  const hasDropdownContent = recipients.length > 0 || !isLoading;

  return (
    <div className="relative">
      {/* Selected recipient button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || isLoading}
        className={`
          w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg border
          ${disabled || isLoading
            ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-not-allowed'
            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 hover:border-emerald-500 cursor-pointer'
          }
          transition-colors
        `}
      >
        {isLoading ? (
          <span className="flex items-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading stakeholders...
          </span>
        ) : selectedRecipient ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
              {selectedRecipient.roleDisplay === 'Custom Recipient' ? (
                <Edit3 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              ) : (
                <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              )}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {selectedRecipient.name}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleColor(selectedRecipient.role)}`}>
                {selectedRecipient.roleDisplay}
              </span>
            </div>
          </div>
        ) : (
          <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Users className="w-4 h-4" />
            {recipients.length > 0
              ? `Select from ${recipients.length} stakeholder${recipients.length > 1 ? 's' : ''} or enter manually...`
              : 'Select a recipient or enter a principal ID...'}
          </span>
        )}
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && hasDropdownContent && (
        <>
          <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 max-h-80 overflow-y-auto">
            {/* Stakeholder list */}
            {recipients.length > 0 && (
              <>
                <div className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50">
                  Transaction Stakeholders
                </div>
                {recipients.map((recipient) => (
                  <button
                    key={recipient.principal}
                    type="button"
                    onClick={() => handleSelect(recipient)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors
                      ${selectedRecipient?.principal === recipient.principal ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}
                    `}
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {recipient.name}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${getRoleColor(recipient.role)}`}>
                          {recipient.roleDisplay}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {recipient.hasEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            Email available
                          </span>
                        )}
                        {recipient.lastActive && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Active {formatRelativeTime(recipient.lastActive)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Error for stakeholders */}
            {error && recipients.length === 0 && (
              <div className="px-4 py-3 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Manual entry section */}
            <div className="border-t border-slate-200 dark:border-slate-700">
              <div className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50">
                Enter Principal ID Manually
              </div>
              <div className="p-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualPrincipal}
                    onChange={(e) => {
                      setManualPrincipal(e.target.value);
                      setManualError(null);
                    }}
                    onKeyDown={handleManualKeyDown}
                    placeholder="e.g. abc12-xyz34-..."
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleManualAdd();
                    }}
                    disabled={!manualPrincipal.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
                {manualError && (
                  <p className="mt-2 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {manualError}
                  </p>
                )}
              </div>
            </div>
          </div>
          {/* Click outside to close */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
        </>
      )}
    </div>
  );
};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
