import { useEffect, useState, type ReactElement } from 'react';
import { ClipboardCheck, PhoneCall, Receipt, FileText } from 'lucide-react';
import {
  getSurveyReferralForTransaction,
  type SurveyReferralRecord,
} from '../../services/surveyReferral.service';

interface Props {
  transactionId: string;
  /** Rendered while loading and when no referral row exists (provider was
   *  selected some other way, or the fetch failed). */
  fallback: ReactElement;
}

const STEPS = [
  {
    icon: PhoneCall,
    text: 'Optimus will contact you to recommend the right survey level and give you a personal quote',
  },
  {
    icon: Receipt,
    text: 'Happy with the quote? Pay their invoice and they’ll book a local RICS surveyor',
  },
  {
    icon: FileText,
    text: 'Your survey report is sent straight to you when it’s ready',
  },
] as const;

/**
 * Replaces the generic "Stage completed" box on the buyer survey stage when a
 * referral was actually sent. Optimus's process runs entirely off-platform
 * (quote → invoice → report direct to the customer), so this card is the
 * buyer's only confirmation the referral went out and what happens next.
 */
export function SurveyReferralStatusCard({ transactionId, fallback }: Props): ReactElement {
  const [referral, setReferral] = useState<SurveyReferralRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getSurveyReferralForTransaction(transactionId).then((r) => {
      if (cancelled) return;
      setReferral(r);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [transactionId]);

  if (!loaded || !referral) return fallback;

  const sentDate = new Date(referral.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 h-9 w-9 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center">
          <ClipboardCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <p className="font-dm-sans text-sm font-semibold text-teal-800 dark:text-teal-200">
            Referral sent to Optimus Surveys
          </p>
          <p className="mt-0.5 text-xs text-teal-700 dark:text-teal-300">
            Sent {sentDate} &middot; Optimus has your contact details and the property information
          </p>
        </div>
      </div>

      <ol className="mt-4 space-y-2.5">
        {STEPS.map(({ icon: Icon, text }, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
            <span className="text-sm text-gray-700 dark:text-gray-300">{text}</span>
          </li>
        ))}
      </ol>

      <p className="mt-4 border-t border-teal-200 dark:border-teal-800 pt-3 text-xs text-gray-500 dark:text-gray-400">
        Waiting to hear back? Call Optimus on{' '}
        <a href="tel:03300366827" className="font-medium text-teal-700 dark:text-teal-300 hover:underline">
          0330 0366 827
        </a>{' '}
        or email{' '}
        <a href="mailto:surveys@optimus-move.co.uk" className="font-medium text-teal-700 dark:text-teal-300 hover:underline">
          surveys@optimus-move.co.uk
        </a>
        .
      </p>
    </div>
  );
}
