import { useState } from 'react';
import { Info, X } from 'lucide-react';

interface OnboardingBannerProps {
  role: 'buyer' | 'seller';
  totalStages: number;
}

const STORAGE_KEY = 'propxchain:onboarding-dismissed';

export function OnboardingBanner({ role, totalStages }: OnboardingBannerProps): React.ReactElement | null {
  const [isDismissed, setIsDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) !== null);

  if (isDismissed) return null;

  const handleDismiss = (): void => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsDismissed(true);
  };

  const message = role === 'buyer'
    ? `Welcome to your property purchase. You'll go through ${totalStages} stages from identity verification to completion. This typically takes 8-12 weeks. We'll guide you every step of the way.`
    : `Welcome to your property sale. You'll go through ${totalStages} stages from listing to completion. This typically takes 8-12 weeks. We'll guide you every step of the way.`;

  return (
    <div className="relative flex items-start gap-3 rounded-lg border border-[#DAE5DC] bg-[#DAE5DC]/40 p-4 dark:border-[#1A2A1E] dark:bg-[#1A2A1E]/60">
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#0D9488] dark:text-[#14B8A6]" />
      <p className="text-sm text-[#1A1A1A] dark:text-[#F1F5F9]">{message}</p>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss onboarding banner"
        className="absolute right-2 top-2 rounded p-1 text-[#6B7280] hover:text-[#1A1A1A] dark:text-[#94A3B8] dark:hover:text-[#F1F5F9]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
