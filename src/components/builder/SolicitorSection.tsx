// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Collapsible solicitor section — shows details or appointment form.
 */

import { Users, ChevronDown, ChevronUp, Pencil } from 'lucide-react';

import type { DevelopmentSite } from '@/services/sites.service';
import AppointSolicitorForm from '@/components/builder/AppointSolicitorForm';

interface SolicitorSectionProps {
  site: DevelopmentSite;
  isOpen: boolean;
  isEditing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onSaved: (firm: string, contact: string, email: string) => void;
  onCancel: () => void;
}

export default function SolicitorSection({
  site,
  isOpen,
  isEditing,
  onToggle,
  onEdit,
  onSaved,
  onCancel,
}: SolicitorSectionProps): JSX.Element {
  const hasSolicitor = Boolean(site.appointed_solicitor_firm);

  return (
    <div className="mt-6 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-[#0D9488]" />
          <span className="font-[Fraunces] text-base font-semibold text-[var(--text-main)]">
            Appointed solicitor
          </span>
          {!hasSolicitor && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-[DM_Sans] text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Not set
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-[var(--text-muted)]" />
        ) : (
          <ChevronDown className="h-5 w-5 text-[var(--text-muted)]" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-[var(--border-color)] px-5 py-4">
          {isEditing || !hasSolicitor ? (
            <AppointSolicitorForm
              siteId={site.id}
              initialFirm={site.appointed_solicitor_firm ?? ''}
              initialContact={site.appointed_solicitor_contact ?? ''}
              initialEmail={site.appointed_solicitor_email ?? ''}
              onSaved={onSaved}
              onCancel={onCancel}
            />
          ) : (
            <div className="flex items-start justify-between">
              <dl className="space-y-2">
                <div>
                  <dt className="font-[DM_Sans] text-xs text-[var(--text-secondary)]">
                    Firm
                  </dt>
                  <dd className="font-[DM_Sans] text-sm font-medium text-[var(--text-main)]">
                    {site.appointed_solicitor_firm}
                  </dd>
                </div>
                {site.appointed_solicitor_contact && (
                  <div>
                    <dt className="font-[DM_Sans] text-xs text-[var(--text-secondary)]">
                      Contact
                    </dt>
                    <dd className="font-[DM_Sans] text-sm font-medium text-[var(--text-main)]">
                      {site.appointed_solicitor_contact}
                    </dd>
                  </div>
                )}
                {site.appointed_solicitor_email && (
                  <div>
                    <dt className="font-[DM_Sans] text-xs text-[var(--text-secondary)]">
                      Email
                    </dt>
                    <dd className="font-[DM_Sans] text-sm text-[var(--text-main)]">
                      {site.appointed_solicitor_email}
                    </dd>
                  </div>
                )}
              </dl>
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border-color)] px-3 py-1.5 font-[DM_Sans] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-section)]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
