import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ClipboardCheck } from 'lucide-react';

export interface SurveyReferralDetails {
  firstName: string;
  lastName: string;
  phone: string;
  propertyValue: number;
}

interface Props {
  open: boolean;
  providerName: string;
  /** Prefill: the buyer's display name, split on first space. */
  partyName: string;
  /** Locked — the referral must carry the authenticated user's email. */
  partyEmail: string;
  /** Prefill from the listing price; the buyer can correct to the agreed price. */
  propertyValue?: number;
  sending: boolean;
  error?: string | null;
  onConfirm: (details: SurveyReferralDetails) => void;
  onCancel: () => void;
}

const inputClass =
  'w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500';

/**
 * Consent + contact-details gate shown before a survey referral is emailed to
 * the provider. Exists because (a) we don't store a phone number anywhere, so
 * it must be captured here, and (b) sending the buyer's details to a third
 * party needs an explicit opt-in for GDPR purposes.
 */
export function SurveyReferralDialog({
  open,
  providerName,
  partyName,
  partyEmail,
  propertyValue,
  sending,
  error,
  onConfirm,
  onCancel,
}: Props): ReactNode {
  const [first, ...rest] = useMemo(() => partyName.trim().split(/\s+/), [partyName]);
  const [firstName, setFirstName] = useState(first ?? '');
  const [lastName, setLastName] = useState(rest.join(' '));
  const [phone, setPhone] = useState('');
  const [value, setValue] = useState(propertyValue ? String(propertyValue) : '');
  const [consented, setConsented] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !sending) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, sending, onCancel]);

  if (!open) return null;

  const parsedValue = Number(value.replace(/[£,\s]/g, ''));
  const phoneValid = /^[0-9+()\s-]{10,15}$/.test(phone.trim());
  // Last name required: it's a dedicated row in the provider's parsed table.
  const valid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    phoneValid &&
    parsedValue > 0 &&
    consented;

  const submit = (): void => {
    setTouched(true);
    if (!valid || sending) return;
    onConfirm({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      propertyValue: parsedValue,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="survey-referral-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => { if (!sending) onCancel(); }}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-gray-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex gap-3">
            <div className="shrink-0 h-10 w-10 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
              <ClipboardCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="flex-1">
              <h3 id="survey-referral-title" className="font-display text-lg text-gray-900 dark:text-gray-100">
                Confirm your details
              </h3>
              <p className="mt-1 font-sans text-sm text-gray-600 dark:text-slate-300">
                {providerName} will contact you with a quote for the right survey level, then
                book a surveyor once you accept. Check your details below.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="referral-first-name" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                First name
              </label>
              <input
                id="referral-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="referral-last-name" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                Last name
              </label>
              <input
                id="referral-last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClass}
              />
              {touched && lastName.trim().length === 0 && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">Enter your last name</p>
              )}
            </div>
            <div className="col-span-2">
              <label htmlFor="referral-email" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                Email
              </label>
              <input
                id="referral-email"
                type="email"
                value={partyEmail}
                readOnly
                aria-readonly="true"
                className={`${inputClass} bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400`}
              />
            </div>
            <div>
              <label htmlFor="referral-phone" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                Phone
              </label>
              <input
                id="referral-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07700 900000"
                className={inputClass}
              />
              {touched && !phoneValid && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">Enter a valid phone number</p>
              )}
            </div>
            <div>
              <label htmlFor="referral-value" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                Purchase price (£)
              </label>
              <input
                id="referral-value"
                type="text"
                inputMode="numeric"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="350000"
                className={inputClass}
              />
              {touched && !(parsedValue > 0) && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">Enter the agreed price</p>
              )}
            </div>
          </div>

          <label className="mt-4 flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            <span>
              I&rsquo;m happy for PropXchain to share these details with {providerName} (Landmark
              Information Group) so they can contact me about a property survey.
            </span>
          </label>
          {touched && !consented && (
            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">Consent is required to send the referral</p>
          )}

          {error && (
            <p className="mt-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={sending}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={sending}
            className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send referral'}
          </button>
        </div>
      </div>
    </div>
  );
}
