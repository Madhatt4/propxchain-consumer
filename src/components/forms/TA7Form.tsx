// TA7 Leasehold Information — modernised to match the TA6/TA10 form language:
// friendly header, plain-English help card, grouped cards, teal pills for the
// lease permissions. Logic (expiry auto-calc, autosave-on-blur, client-side
// anomaly flags) unchanged; the exported PDF keeps the formal layout.

import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Info, Lightbulb } from 'lucide-react';
import { Principal } from '@propxchain/core-client';
import {
  TA7LeaseholdInformation,
  emptyTA7Form,
  calculateRemainingLeaseYears,
  getLeaseStatusMessage,
} from '../../types/ta7.types';
import type { PropertyListing } from '../../types/listing.types';
import { prefillTa7FromListing } from '../../services/taFormsPrefill';
import { logger } from '@/utils/logger';
import { getStorePrincipalId } from '@/stores/authStore';
import { FormExportButton } from './FormExportButton';
import { CARD, INPUT, LABEL, PermissionRow, SECTION_TITLE } from './ta7/ta7Ui';
import { ChargesCard, LeaseTermCard, ManagementCard } from './ta7/LeaseCards';
import {
  crossReferenceTA7,
  type CrossReferenceResult,
} from '../../services/formCrossReferenceService';
import {
  getPropertyIntelligence,
  type PropertyIntelligenceReport,
} from '../../services/propertyIntelligenceService';

interface TA7FormProps {
  transactionId: string;
  initialData?: TA7LeaseholdInformation | null;
  onSave: (data: TA7LeaseholdInformation) => Promise<void>;
  readOnly?: boolean;
  isLeasehold: boolean; // Whether the property is leasehold
  /** Property address shown in the exported PDF header. */
  propertyAddress?: string;
  /** Postcode used to fetch the PropertyIntelligenceReport. */
  postcode?: string | null;
  /** Optional override for tests — skip the fetch and cross-reference directly. */
  intelOverride?: PropertyIntelligenceReport | null;
  /** The transaction's listing: fills blank ground rent and service charge
   *  from its material information. Blanks only. */
  listing?: PropertyListing | null;
}

const TA7Form: React.FC<TA7FormProps> = ({
  transactionId,
  initialData,
  onSave,
  readOnly = false,
  isLeasehold,
  propertyAddress,
  postcode,
  intelOverride,
  listing,
}) => {
  const [{ form: seedForm, filled: prefilledFields }] = useState(() =>
    prefillTa7FromListing(initialData || emptyTA7Form, listing ?? null),
  );
  const [formData, setFormData] = useState<TA7LeaseholdInformation>(seedForm);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [intelReport, setIntelReport] = useState<PropertyIntelligenceReport | null>(
    intelOverride ?? null,
  );

  useEffect(() => {
    if (intelOverride !== undefined) {
      setIntelReport(intelOverride);
      return;
    }
    if (!postcode) {
      setIntelReport(null);
      return;
    }
    let cancelled = false;
    getPropertyIntelligence(postcode)
      .then((r) => {
        if (!cancelled) setIntelReport(r);
      })
      .catch(() => {
        if (!cancelled) setIntelReport(null);
      });
    return () => {
      cancelled = true;
    };
  }, [postcode, intelOverride]);

  const anomalies = useMemo<CrossReferenceResult[]>(
    () => crossReferenceTA7(formData, intelReport),
    [formData, intelReport],
  );

  const leaseStatus = formData.leaseExpiryDate ? getLeaseStatusMessage(formData.leaseExpiryDate) : null;
  const remainingYears = formData.leaseExpiryDate ? calculateRemainingLeaseYears(formData.leaseExpiryDate) : 0;

  const handleFieldChange = (field: keyof TA7LeaseholdInformation, value: unknown): void => {
    const pidText = getStorePrincipalId() || '';
    let lastModifiedBy: Principal;
    try { lastModifiedBy = pidText ? Principal.fromText(pidText) : Principal.anonymous(); }
    catch { lastModifiedBy = Principal.anonymous(); }
    const updatedData = {
      ...formData,
      [field]: value,
      lastModifiedBy,
      lastModifiedAt: new Date().toISOString(),
    };

    // Auto-calculate expiry date when term changes
    if (field === 'leaseStartDate' || field === 'leaseTermYears') {
      const startDate = (field === 'leaseStartDate' ? value : formData.leaseStartDate) as string;
      const termYears = (field === 'leaseTermYears' ? value : formData.leaseTermYears) as number;
      if (startDate && termYears > 0) {
        const start = new Date(startDate);
        const expiry = new Date(start);
        expiry.setFullYear(start.getFullYear() + termYears);
        updatedData.leaseExpiryDate = expiry.toISOString().split('T')[0];
      }
    }

    setFormData(updatedData);
  };

  const handleSave = async (): Promise<void> => {
    if (readOnly) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(formData);
      setLastSaved(new Date());
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save form');
      logger.error('TA7 save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBlur = (): void => {
    if (!readOnly) void handleSave();
  };

  useEffect(() => {
    if (initialData) setFormData(initialData);
  }, [initialData]);

  if (!isLeasehold) {
    return (
      <div className={CARD}>
        <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-4 dark:bg-blue-900/20">
          <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <div>
            <p className="text-base font-medium text-gray-900 dark:text-slate-100">Freehold Property</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-slate-300">
              The TA7 Leasehold Information Form is only required for leasehold properties. This
              property is registered as freehold.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const statusTone =
    leaseStatus?.status === 'critical'
      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300'
      : leaseStatus?.status === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-300';

  return (
    <div className="space-y-5">
      <div className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">
              Your lease, in plain terms
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
              TA7 Leasehold Information Form
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isSaving && (
              <span className="text-sm font-medium text-teal-600 dark:text-teal-400">Saving...</span>
            )}
            {lastSaved && !isSaving && !saveError && (
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            <FormExportButton
              payload={{ formType: 'TA7', data: formData }}
              context={{ propertyAddress: propertyAddress ?? '', transactionId }}
              filename={`TA7-${transactionId}`}
            />
          </div>
        </div>
      </div>

      {prefilledFields.length > 0 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-relaxed text-blue-800 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300">
          {prefilledFields.join(' and ')} {prefilledFields.length > 1 ? 'were' : 'was'} prepopulated from the
          listing. Prepopulated information must be checked by the seller.
        </div>
      )}

      <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-5 py-4 dark:border-sky-900 dark:bg-sky-900/20">
        <div className="flex items-start gap-4">
          <span
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/50"
            aria-hidden="true"
          >
            <Lightbulb className="h-5 w-5 text-sky-600 dark:text-sky-400" />
          </span>
          <div className="space-y-1 text-sm leading-relaxed">
            <p className="text-base font-semibold text-sky-950 dark:text-sky-200">
              The facts of your lease
            </p>
            <p className="text-sky-900 dark:text-sky-300">
              Everything here comes straight out of your lease paperwork: how long it runs, what
              you pay, who the freeholder is and what the lease lets you do. Dig out the lease
              itself plus your latest ground rent demand and service charge statement, and copy
              the numbers across.
            </p>
          </div>
        </div>
      </div>

      {leaseStatus && (
        <div className={`flex items-start gap-3 rounded-2xl border px-5 py-4 ${statusTone}`}>
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="text-base font-semibold">{remainingYears} years remaining on lease</p>
            <p className="mt-0.5 text-sm leading-relaxed">{leaseStatus.message}</p>
          </div>
        </div>
      )}

      <LeaseTermCard formData={formData} readOnly={readOnly} onField={handleFieldChange} onBlur={handleBlur} anomalies={anomalies} />
      <ChargesCard formData={formData} readOnly={readOnly} onField={handleFieldChange} onBlur={handleBlur} anomalies={anomalies} />

      <ManagementCard formData={formData} readOnly={readOnly} onField={handleFieldChange} onBlur={handleBlur} anomalies={anomalies} />

      <div className={`${CARD} space-y-4`}>
        <h3 className={SECTION_TITLE}>What the lease allows</h3>
        <div>
          <label htmlFor="ta7-restrictions" className={LABEL}>Restrictions and covenants</label>
          <textarea
            id="ta7-restrictions"
            value={formData.restrictions}
            onChange={(e) => handleFieldChange('restrictions', e.target.value)}
            onBlur={handleBlur}
            disabled={readOnly}
            rows={4}
            className={INPUT}
            placeholder="Anything the lease says you cannot do, or must do..."
          />
        </div>
        <div className="space-y-3">
          <PermissionRow
            label="Alterations"
            value={formData.alterationsAllowed}
            readOnly={readOnly}
            onChange={(v) => { handleFieldChange('alterationsAllowed', v); }}
          />
          <PermissionRow
            label="Subletting"
            value={formData.sublettingAllowed}
            readOnly={readOnly}
            onChange={(v) => { handleFieldChange('sublettingAllowed', v); }}
          />
          <PermissionRow
            label="Pets"
            value={formData.petsAllowed}
            readOnly={readOnly}
            onChange={(v) => { handleFieldChange('petsAllowed', v); }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {saveError && (
          <p className="text-sm text-red-600" role="alert">
            {saveError}
          </p>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save form'}
          </button>
        )}
      </div>
    </div>
  );
};

export default TA7Form;
