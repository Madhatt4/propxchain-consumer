import { useState, type ReactElement } from 'react';
import { FileUp, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { uploadSurveyReport } from '../../services/surveyDocument.service';
import { logger } from '../../utils/logger';

interface Props {
  /** Canonical transaction key in "tx_<n>" form. Absent → the card is hidden. */
  transactionId?: string;
  propertyId?: number;
  /** Notified after a successful upload so the stage can refresh. */
  onUploaded?: (fileHash: string) => void;
}

interface UploadedMeta {
  name: string;
  hash: string;
}

/**
 * Lets the buyer add their own survey report to the transaction record.
 *
 * Deliberately independent of the provider panel above it: the buyer may have
 * used a surveyor they found themselves, or skipped the panel entirely, and
 * their report should still reach their transaction. See
 * `surveyDocument.service.ts` for why the buyer uploads rather than the
 * surveyor sending it to us.
 */
export function SurveyReportUpload({
  transactionId,
  propertyId,
  onUploaded,
}: Props): ReactElement | null {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadedMeta | null>(null);

  if (!transactionId) return null;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    // Reset so re-picking the same file after an error re-triggers onChange.
    e.target.value = '';
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const record = await uploadSurveyReport(file, { transactionId, propertyId });
      setUploaded({ name: file.name, hash: record.fileHash });
      onUploaded?.(record.fileHash);
    } catch (err) {
      logger.error('[survey] report upload failed', err);
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="mt-6 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <div className="flex items-start gap-3">
        <FileUp className="h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Already had a survey done?
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Add your survey report to this transaction — whoever carried it out. We
            record a fingerprint of the file on the blockchain, so it becomes part of
            your transaction&rsquo;s audit trail and any later change to it is
            detectable.
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Your conveyancer and the other parties on this transaction will be able to
            open it. The file itself is stored securely off-chain and can be deleted on
            request. We record that you supplied it — we can&rsquo;t confirm who wrote
            it, so it isn&rsquo;t shown to anyone as a verified survey.
          </p>

          {uploaded ? (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-teal-50 dark:bg-teal-900/30 p-3">
              <CheckCircle2
                className="h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400"
                aria-hidden
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {uploaded.name}
                </p>
                <p className="mt-0.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                  {uploaded.hash.slice(0, 16)}&hellip;
                </p>
              </div>
            </div>
          ) : (
            <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 focus-within:ring-2 focus-within:ring-teal-500 aria-disabled:cursor-not-allowed aria-disabled:opacity-60">
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Uploading&hellip;
                </>
              ) : (
                <>
                  <FileUp className="h-4 w-4" aria-hidden />
                  Upload survey report (PDF)
                </>
              )}
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  void handleFile(e);
                }}
              />
            </label>
          )}

          {error && (
            <p
              role="alert"
              className="mt-3 flex items-start gap-2 text-sm text-red-600 dark:text-red-400"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
