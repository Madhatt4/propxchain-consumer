// Numbered 1..15 stepper rail for the TA6 shell. Each pill shows its section
// number, a completion tick, an unsaved-changes dot, and an anomaly marker when
// cross-reference flags land on that section. Purely presentational — the shell
// computes each step's state and owns the active step.

import type { ReactElement } from 'react';
import { Check, AlertTriangle } from 'lucide-react';

export interface StepperStep {
  step: number;
  title: string;
  complete: boolean;
  dirty: boolean;
  anomalyCount: number;
}

export interface StepperNavProps {
  steps: readonly StepperStep[];
  activeStep: number;
  onSelect: (step: number) => void;
}

function ariaLabel(step: StepperStep): string {
  const parts = [`Section ${step.step}: ${step.title}`];
  if (step.complete) parts.push('(complete)');
  if (step.anomalyCount > 0) {
    parts.push(`${step.anomalyCount} anomaly flag${step.anomalyCount === 1 ? '' : 's'}`);
  }
  return parts.join(' ');
}

export function StepperNav({ steps, activeStep, onSelect }: StepperNavProps): ReactElement {
  return (
    <nav aria-label="TA6 sections" className="flex flex-wrap gap-2">
      {steps.map((step) => {
        const isActive = step.step === activeStep;
        const fill = step.complete
          ? 'bg-teal-600 text-white hover:bg-teal-700'
          : isActive
            ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700';
        return (
          <button
            key={step.step}
            type="button"
            onClick={() => onSelect(step.step)}
            aria-current={isActive ? 'step' : undefined}
            aria-label={ariaLabel(step)}
            title={step.title}
            className={`relative inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-full px-3 text-sm font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${fill} ${
              isActive ? 'ring-2 ring-teal-500 ring-offset-2 dark:ring-offset-slate-900' : ''
            }`}
          >
            {step.step}
            {step.complete && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
            {step.dirty && !step.complete && (
              <span
                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-500 dark:border-slate-900"
                aria-hidden="true"
              />
            )}
            {step.anomalyCount > 0 && (
              <AlertTriangle
                className={`h-3.5 w-3.5 ${step.complete ? 'text-amber-200' : 'text-amber-500'}`}
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

export default StepperNav;
