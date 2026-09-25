import { type ReactNode, useState, useCallback } from 'react';
import { Check, FileText, MessageSquare, AlertTriangle, AlertCircle, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StageConfig } from '../../../../types/stage.types';

interface StageProps {
  stage: StageConfig;
  onComplete?: (stageId: string) => void;
  transactionId?: string;
}

interface Enquiry {
  id: string;
  documentLabel: string;
  question: string;
  status: 'raised' | 'responded' | 'resolved';
  response?: string;
  createdAt: string;
}

const SELLER_DOCS = [
  'Local Authority Search',
  'Environmental Search',
  'Drainage & Water Search',
  'TA6 Property Information',
  'TA10 Fittings & Contents',
  'Title Register',
] as const;

const STATUS_COLOURS: Record<Enquiry['status'], string> = {
  raised: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  responded: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

// Badge must not rely on colour alone (colourblind a11y) — pair each status
// with a distinct icon.
const STATUS_ICONS: Record<Enquiry['status'], LucideIcon> = {
  raised: AlertCircle,
  responded: Clock,
  resolved: Check,
};

export function ReviewSellerPackStage({ stage, onComplete }: StageProps): ReactNode {
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [expandedEnquiry, setExpandedEnquiry] = useState<string | null>(null);
  const [enquiryText, setEnquiryText] = useState('');
  const [showWaiveConfirm, setShowWaiveConfirm] = useState(false);

  const allReviewed = reviewed.size === SELLER_DOCS.length;

  const toggleReviewed = useCallback((label: string): void => {
    setReviewed((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }, []);

  const submitEnquiry = useCallback((docLabel: string): void => {
    if (!enquiryText.trim()) return;
    const newEnquiry: Enquiry = {
      id: `enq-${Date.now()}`,
      documentLabel: docLabel,
      question: enquiryText.trim(),
      status: 'raised',
      createdAt: new Date().toISOString(),
    };
    setEnquiries((prev) => [...prev, newEnquiry]);
    setEnquiryText('');
    setExpandedEnquiry(null);
  }, [enquiryText]);

  if (stage.status === 'completed') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
        <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Documents reviewed</span>
      </div>
    );
  }

  if (stage.status === 'watching') {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Waiting for seller to complete property searches and forms.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0F1729] divide-y divide-[#E5E7EB] dark:divide-[#1E293B]">
        {SELLER_DOCS.map((label) => {
          const docEnquiries = enquiries.filter((e) => e.documentLabel === label);
          const isExpanded = expandedEnquiry === label;
          return (
            <div key={label} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-[#6B7280] dark:text-[#94A3B8]" />
                  <span className="text-sm text-[#1A1A1A] dark:text-[#F1F5F9] truncate">{label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* "View" button removed — document storage integration is
                      not wired for the SELLER_DOCS labels, so clicking did
                      nothing (console.log only). Re-add once docs have
                      referenceable URLs / hashes per label. */}
                  <button type="button" onClick={() => { setExpandedEnquiry(isExpanded ? null : label); setEnquiryText(''); }}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[#5F8A68] dark:text-[#9CB8A4] hover:bg-[#DAE5DC] dark:hover:bg-[#1A2A1E] transition-colors">
                    <MessageSquare className="h-3.5 w-3.5" /> Raise Enquiry
                  </button>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={reviewed.has(label)} onChange={() => toggleReviewed(label)}
                      className="h-4 w-4 rounded border-[#E5E7EB] text-teal-600 focus:ring-teal-500" />
                    <span className="text-xs text-[#6B7280] dark:text-[#94A3B8]">Reviewed</span>
                  </label>
                </div>
              </div>
              {isExpanded && (
                <div className="mt-2 flex gap-2">
                  <input type="text" value={enquiryText} onChange={(e) => setEnquiryText(e.target.value)}
                    placeholder="Type your enquiry..." onKeyDown={(e) => e.key === 'Enter' && submitEnquiry(label)}
                    className="flex-1 rounded-md border border-[#E5E7EB] dark:border-[#1E293B] bg-[#FAFAF8] dark:bg-[#060B18] px-3 py-1.5 text-sm text-[#1A1A1A] dark:text-[#F1F5F9] placeholder:text-[#6B7280] focus:outline-none focus:ring-1 focus:ring-teal-500" />
                  <button type="button" onClick={() => submitEnquiry(label)}
                    className="rounded-md bg-teal-600 hover:bg-teal-700 px-3 py-1.5 text-xs font-medium text-white transition-colors">
                    Submit
                  </button>
                </div>
              )}
              {docEnquiries.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {docEnquiries.map((enq) => {
                    const StatusIcon = STATUS_ICONS[enq.status];
                    return (
                      <div key={enq.id} className="flex items-start gap-2 rounded bg-[#F0F5F0] dark:bg-[#141F33] px-3 py-2">
                        <span className="flex-1 text-xs text-[#1A1A1A] dark:text-[#F1F5F9]">{enq.question}</span>
                        <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${STATUS_COLOURS[enq.status]}`}>
                          <StatusIcon className="h-3 w-3" aria-hidden />
                          {enq.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allReviewed && (
        <button type="button" onClick={() => onComplete?.(stage.id)}
          className="w-full rounded-lg bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition-colors">
          Confirm All Reviewed
        </button>
      )}

      {!allReviewed && !showWaiveConfirm && (
        <button type="button" onClick={() => setShowWaiveConfirm(true)}
          className="w-full rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0F1729] px-4 py-2.5 text-sm font-medium text-[#6B7280] dark:text-[#94A3B8] hover:border-[#D97706] hover:text-[#D97706] transition-colors">
          Waive Remaining Review
        </button>
      )}

      {showWaiveConfirm && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
            Are you sure? Waiving marks this stage complete the same way as a
            full review would, so please only do this if your solicitor has
            agreed to take over the outstanding document checks.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowWaiveConfirm(false); onComplete?.(stage.id); }}
              className="rounded-md bg-amber-600 hover:bg-amber-700 px-4 py-1.5 text-xs font-medium text-white transition-colors">
              Yes, waive review
            </button>
            <button type="button" onClick={() => setShowWaiveConfirm(false)}
              className="rounded-md border border-[#E5E7EB] dark:border-[#1E293B] px-4 py-1.5 text-xs font-medium text-[#6B7280] dark:text-[#94A3B8] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
