// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * CheckMyAnswersPanel — renders one `form-check` result. Presentational only:
 * it fetches nothing and decides nothing.
 *
 * Two lists, never merged. The deterministic findings come first and carry no
 * probability, because they are facts the code settled ("you answered Yes and
 * left the detail blank"); putting a percentage beside one would invite the
 * seller to argue with arithmetic. The model's flags follow, each with the
 * percentage that produced its severity, so the seller can see how sure the
 * advice is before acting on it.
 */
import { Link } from 'react-router-dom';
import type { ReactElement } from 'react';
import { AlertTriangle, ClipboardCheck, Info } from 'lucide-react';

import { TA6_SECTION_TITLES, stepForSectionName } from '@/components/forms/ta6/sectionMeta';
import { FORM_CHECK_NO_MODEL } from '@/services/formCheck.service';
import type { FormCheckFinding, FormCheckFlag, FormCheckResult } from '@/services/formCheck.service';

import {
  bySeverity,
  followUpHeading,
  followUpWords,
  formatCheckedAt,
  severityStyle,
  toPercent,
} from './checkMyAnswersWording';

/** Carried through to the form page so its header still names the property. */
export interface FormNavState {
  postcode?: string | null;
  propertyAddress?: string;
}

export interface CheckMyAnswersPanelProps {
  transactionId: string;
  result: FormCheckResult;
  navState?: FormNavState;
}

interface SectionLinkProps {
  transactionId: string;
  section: string | undefined;
  navState?: FormNavState;
}

/**
 * Deep-links into the TA6 stepper at the named section. TA10 findings never
 * carry a section, and an unrecognised name renders nothing rather than a
 * link that lands the seller on section 1.
 */
function SectionLink({ transactionId, section, navState }: SectionLinkProps): ReactElement | null {
  const step = section === undefined ? null : stepForSectionName(section);
  if (step === null || section === undefined) return null;
  const title = TA6_SECTION_TITLES[step - 1] ?? `section ${step}`;
  return (
    <Link
      to={{
        pathname: `/transaction/${transactionId}/forms/ta6`,
        search: `?section=${encodeURIComponent(section)}`,
      }}
      state={navState}
      className="mt-0.5 inline-block text-xs font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800 dark:text-teal-300 dark:hover:text-teal-200"
    >
      Go to §{step} {title}
    </Link>
  );
}

function Headline({ result }: { result: FormCheckResult }): ReactElement {
  const ready = toPercent(result.readyToSubmit);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">Ready to submit: {ready}%</p>
        <span className="text-xs text-gray-500 dark:text-slate-400">{result.form.toUpperCase()}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Ready to submit"
        aria-valuenow={ready}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700"
      >
        <div className="h-full rounded-full bg-teal-500" style={{ width: `${ready}%` }} />
      </div>
      <p className="text-xs text-gray-600 dark:text-slate-300">
        {followUpHeading(result.form)}:{' '}
        <span className="font-medium">{followUpWords(result.form, result.followUpScore)}</span>
      </p>
    </div>
  );
}

interface ListProps {
  transactionId: string;
  navState?: FormNavState;
}

function DeterministicList({ findings, transactionId, navState }: ListProps & { findings: FormCheckFinding[] }): ReactElement {
  return (
    <div className="space-y-1.5">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
        <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Found in your answers
      </h4>
      <ul className="space-y-1.5">
        {findings.map((finding) => (
          <li
            key={finding.key}
            className="rounded-r border-l-2 border-gray-300 bg-gray-50/60 py-1.5 pl-2.5 pr-2 text-xs text-gray-700 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-200"
          >
            <p>{finding.label}</p>
            <SectionLink transactionId={transactionId} section={finding.section} navState={navState} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlagList({ flags, transactionId, navState }: ListProps & { flags: FormCheckFlag[] }): ReactElement {
  return (
    <div className="space-y-1.5">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        Worth a second look
      </h4>
      <ul className="space-y-1.5">
        {flags.map((flag) => {
          const style = severityStyle(flag.severity);
          return (
            <li key={flag.key} className={`rounded-r py-1.5 pl-2.5 pr-2 ${style.row}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-gray-700 dark:text-slate-200">{flag.label}</p>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${style.chip}`}>
                  <span className="sr-only">{style.announce}, </span>
                  {toPercent(flag.probability)}%
                </span>
              </div>
              <SectionLink transactionId={transactionId} section={flag.section} navState={navState} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Footer({ result }: { result: FormCheckResult }): ReactElement {
  const provenance = result.model === FORM_CHECK_NO_MODEL
    ? 'Checked against the rules only'
    : `Model ${result.model}`;
  return (
    <div className="space-y-0.5 border-t border-gray-200 pt-2 dark:border-slate-700">
      <p className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-slate-300">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Advisory only. Your conveyancer decides what to disclose.
      </p>
      <p className="text-[11px] text-gray-400 dark:text-slate-500">
        {provenance} · {formatCheckedAt(result.checkedAt)}
      </p>
    </div>
  );
}

export function CheckMyAnswersPanel({ transactionId, result, navState }: CheckMyAnswersPanelProps): ReactElement {
  const flags = [...result.flags].sort(bySeverity);
  const nothingFound = flags.length === 0 && result.deterministic.length === 0;
  return (
    <section
      aria-label={`${result.form.toUpperCase()} check result`}
      className="mt-2 space-y-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
    >
      <Headline result={result} />
      {result.deterministic.length > 0 && (
        <DeterministicList findings={result.deterministic} transactionId={transactionId} navState={navState} />
      )}
      {flags.length > 0 && <FlagList flags={flags} transactionId={transactionId} navState={navState} />}
      {nothingFound && (
        <p className="text-xs text-gray-600 dark:text-slate-300">
          Nothing stood out. That is not a guarantee — it only means this check found nothing to raise.
        </p>
      )}
      <Footer result={result} />
    </section>
  );
}

export default CheckMyAnswersPanel;
