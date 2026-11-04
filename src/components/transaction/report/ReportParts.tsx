// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/** Building blocks shared by every section of the document-style report. */

import type { ReactElement, ReactNode } from 'react';

import type { ReportSectionId } from './reportFindings';
import { R, TONE_FILL, TONE_TEXT, type Tone } from './reportStyles';

interface ReportSectionProps {
  id: ReportSectionId;
  title: string;
  /** One plain sentence on what the section found; the lead is coloured by tone. */
  lead?: string;
  rest?: string;
  tone?: Tone;
  source?: string;
  children?: ReactNode;
}

export function ReportSection({ id, title, lead, rest, tone = 'clear', source, children }: ReportSectionProps): ReactElement {
  return (
    <section id={`report-${id}`} aria-labelledby={`report-${id}-h`} className={`scroll-mt-16 border-t ${R.rule} py-9 first:border-t-0`}>
      <h2 id={`report-${id}-h`} className={R.h2}>{title}</h2>
      {(lead || rest) && (
        <p className={`mt-2.5 max-w-[66ch] ${R.finding}`}>
          {lead && <span className={`font-semibold ${TONE_TEXT[tone]}`}>{lead}</span>}
          {lead && rest ? ' ' : ''}
          {rest}
        </p>
      )}
      {children}
      {source && <p className={`mt-4 ${R.source}`}>{source}</p>}
    </section>
  );
}

interface RiskScaleProps {
  /** Accessible summary, e.g. "Surface water flood risk: medium". */
  label: string;
  caption: ReactNode;
  value: string;
  steps: readonly string[];
  /** Index of the step the property sits on; null for no reading. */
  active: number | null;
  tone: Tone;
}

/** A labelled band scale: the property's position carries the meaning, words name it. */
export function RiskScale({ label, caption, value, steps, active, tone }: RiskScaleProps): ReactElement {
  return (
    <div className="mt-5 max-w-xl" role="img" aria-label={label}>
      <div className={`mb-1.5 flex justify-between gap-3 font-[DM_Sans] text-sm ${R.ink2}`}>
        <span>{caption}</span>
        <span className={`font-semibold ${R.ink}`}>{value}</span>
      </div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => (
          <span key={s} className={`h-3 rounded-sm ${i === active ? TONE_FILL[tone] : 'bg-[#E7ECE8] dark:bg-[#1F2937]'}`} />
        ))}
      </div>
      <div className={`mt-1 grid gap-[3px] text-xs ${R.muted} ${R.mono}`} style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
    </div>
  );
}

export interface CheckRow {
  check: string;
  result: string;
  meaning?: string;
  tone?: Tone;
}

/** Check / result / meaning table; the result is coloured only when it is not clear. */
export function CheckTable({ rows, showMeaning = true }: { rows: CheckRow[]; showMeaning?: boolean }): ReactElement {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className={`border-b ${R.rule}`}>
            <th scope="col" className={R.th}>Check</th>
            <th scope="col" className={R.th}>Result</th>
            {showMeaning && <th scope="col" className={R.th}>What it means</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.check} className={`border-b ${R.rule}`}>
              <td className={R.td}>{row.check}</td>
              <td className={`${R.td} font-medium ${row.tone && row.tone !== 'clear' ? TONE_TEXT[row.tone] : ''}`}>{row.result}</td>
              {showMeaning && <td className={`${R.td} ${R.ink2}`}>{row.meaning ?? ''}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Honest placeholder when a source did not answer, with an optional retry. */
export function Unavailable({ title, children, onRetry }: { title: string; children?: ReactNode; onRetry?: () => void }): ReactElement {
  return (
    <div className={`mt-5 max-w-[70ch] rounded-lg border border-dashed border-[#84A98C] ${R.paper} px-4 py-3.5 ${R.body}`}>
      <span className={`font-semibold ${R.ink}`}>{title}</span> {children}
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-1 font-medium text-[#0F766E] underline underline-offset-2 hover:text-[#0D9488] dark:text-[#14B8A6]">
          Try again
        </button>
      )}
    </div>
  );
}
