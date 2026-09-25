import { useState } from 'react';
import { ProviderPanel } from './ProviderPanel';
import { useProviderData } from '../../hooks/useProviderData';
import { useProviderPanel } from '../../hooks/useProviderPanel';
import { SurveyReferralDialog, type SurveyReferralDetails } from './SurveyReferralDialog';
import { SurveyReportUpload } from './SurveyReportUpload';
import { sendSurveyReferral } from '../../services/surveyReferral.service';
import { logger } from '../../utils/logger';

/** Providers whose selection sends a real email referral (interim channel
 *  until the partner's API exists) rather than just recording a choice. */
const REFERRAL_PROVIDER_IDS = new Set(['optimus']);

interface SurveyPanelProps {
  onSelect: (providerId: string) => void;
  selectedId?: string;
  onContinue: (providerId: string) => void;
  onSkip?: () => void;
  postcode?: string;
  /** Referral context — when absent, referral providers fall back to
   *  plain selection (e.g. dashboards that render the panel standalone). */
  transactionId?: string;
  partyName?: string;
  partyEmail?: string;
  propertyAddress?: string;
  propertyValue?: number;
  uprn?: string;
  /** Passed through to the buyer's own survey-report upload. */
  propertyId?: number;
}

export function SurveyPanel({
  onSelect,
  selectedId,
  onContinue,
  onSkip,
  postcode,
  transactionId,
  partyName,
  partyEmail,
  propertyAddress,
  propertyValue,
  uprn,
  propertyId,
}: SurveyPanelProps): React.ReactElement {
  const { providers, isLoading, error, refetch } = useProviderData('survey', {
    postcode,
    sortBy: postcode ? 'distance' : undefined,
  });
  const { compareIds, toggleCompare, clearCompare } = useProviderPanel();

  const [referralProviderId, setReferralProviderId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);

  const canRefer = !!(transactionId && partyEmail && propertyAddress);

  const handleContinue = (providerId: string): void => {
    if (REFERRAL_PROVIDER_IDS.has(providerId) && canRefer) {
      setReferralError(null);
      setReferralProviderId(providerId);
      return;
    }
    onContinue(providerId);
  };

  const handleReferralConfirm = async (details: SurveyReferralDetails): Promise<void> => {
    if (!referralProviderId || !transactionId || !partyEmail || !propertyAddress) return;
    setSending(true);
    setReferralError(null);
    const result = await sendSurveyReferral({
      transactionId,
      customerFirstName: details.firstName,
      customerLastName: details.lastName || undefined,
      customerEmail: partyEmail,
      customerPhone: details.phone,
      propertyAddressLine1: propertyAddress,
      propertyAddressPostcode: postcode ?? '',
      propertyValue: details.propertyValue,
      uprn,
    });
    setSending(false);
    if (!result.success) {
      logger.warn('[surveyReferral] send failed', { error: result.error });
      setReferralError(
        'We couldn’t send your referral just now. Please try again in a moment.',
      );
      return;
    }
    const providerId = referralProviderId;
    setReferralProviderId(null);
    onContinue(providerId);
  };

  const referralProviderName =
    providers.find((p) => p.id === referralProviderId)?.name ?? 'Optimus Surveys';

  return (
    <>
      <ProviderPanel
        title="Property Survey"
        subtitle="Commission an independent RICS-accredited survey"
        stageNumber={4}
        badge="Buyer Only"
        description="A property survey gives you an independent assessment of the property's condition. While optional, it's recommended for most purchases, especially older or unusual properties."
        providers={providers}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        onSelect={onSelect}
        selectedId={selectedId}
        onContinue={handleContinue}
        skippable
        onSkip={onSkip}
        priceLabel="from"
        compareIds={compareIds}
        onCompareToggle={toggleCompare}
        onCompareClear={clearCompare}
      />
      <SurveyReportUpload transactionId={transactionId} propertyId={propertyId} />
      <SurveyReferralDialog
        open={referralProviderId !== null}
        providerName={referralProviderName}
        partyName={partyName ?? ''}
        partyEmail={partyEmail ?? ''}
        propertyValue={propertyValue}
        sending={sending}
        error={referralError}
        onConfirm={(details) => { void handleReferralConfirm(details); }}
        onCancel={() => { if (!sending) setReferralProviderId(null); }}
      />
    </>
  );
}
