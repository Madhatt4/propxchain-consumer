// Plain-English help card shown above each TA6 section: what the section is
// really asking, what to have to hand, and reassurance about honest answers.
// Content lives in the guides bundle (joins the ADR 0009 legal review).

import type { ReactElement } from 'react';
import { Lightbulb } from 'lucide-react';

import { getSectionGuide } from '../../../lib/ta6-prompts/guides';

export interface SectionHelpCardProps {
  section: number;
}

export function SectionHelpCard({ section }: SectionHelpCardProps): ReactElement | null {
  const guide = getSectionGuide(section);
  if (!guide) return null;

  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-5 py-4 dark:border-sky-900 dark:bg-sky-900/20">
      <div className="flex items-start gap-4">
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/50"
          aria-hidden="true"
        >
          <Lightbulb className="h-5 w-5 text-sky-600 dark:text-sky-400" />
        </span>
        <div className="space-y-2">
          <p className="text-base font-semibold text-sky-950 dark:text-sky-200">{guide.plainTitle}</p>
          <p className="text-sm leading-relaxed text-sky-900 dark:text-sky-300">{guide.intro}</p>
          {guide.whatYoullNeed.length > 0 && (
            <div className="text-sm leading-relaxed">
              <p className="font-medium text-sky-950 dark:text-sky-200">Worth having to hand:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sky-900 marker:text-sky-400 dark:text-sky-300">
                {guide.whatYoullNeed.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm italic leading-relaxed text-sky-700 dark:text-sky-400">
            {guide.reassurance}
          </p>
        </div>
      </div>
    </div>
  );
}

export default SectionHelpCard;
