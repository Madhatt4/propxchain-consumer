import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ArrowRight, XCircle } from 'lucide-react';

type PageStatus = 'success' | 'cancelled';

export default function SellerFeeSuccessPage(): ReactElement {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState<number>(5);

  const transactionId = searchParams.get('transaction_id');
  const isCancelled = searchParams.get('cancelled') === 'true';
  const status: PageStatus = isCancelled ? 'cancelled' : 'success';

  // Auto-redirect after 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          const path = transactionId
            ? `/transaction/${transactionId}/flow`
            : '/dashboard';
          navigate(path, { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return (): void => clearInterval(timer);
  }, [transactionId, navigate]);

  function handleContinue(): void {
    const path = transactionId
      ? `/transaction/${transactionId}/flow`
      : '/dashboard';
    navigate(path, { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#060b18] flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-8 max-w-md w-full text-center">
        {status === 'success' ? (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-500/12 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Payment Successful
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-1">
              Your £75 seller fee has been received.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              The payment will be confirmed shortly and your transaction dashboard will update automatically.
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-slate-700/30 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-gray-500 dark:text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Payment Cancelled
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              No payment was taken. You can pay the seller fee at any time from your transaction dashboard.
            </p>
          </>
        )}

        <button
          type="button"
          onClick={handleContinue}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white text-sm font-semibold transition-all"
        >
          {transactionId ? 'Back to Transaction' : 'Go to Dashboard'}
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-xs text-gray-400 dark:text-slate-500 mt-3">
          Redirecting in {countdown}s...
        </p>
      </div>
    </div>
  );
}
