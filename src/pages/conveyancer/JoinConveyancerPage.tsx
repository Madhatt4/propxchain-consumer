/**
 * JoinConveyancerPage — the winning conveyancer's activation link.
 *
 * Route: /conveyancer/join/:code
 *
 * The code arrives by email when a party accepts the firm's quote
 * (accept-conveyancer-quote edge fn). Flow mirrors /redeem/dev:
 *   1. Preview the invitation (public — the code is the bearer)
 *   2. Signed out: create an account, sign in, or reset a forgotten password
 *      — all three in place, without leaving the code behind (JoinAuthPanel)
 *   3. Signed in: redeem immediately — the firm is assigned on-chain with
 *      its CLC-registered details, no re-typing
 *
 * Step 2 used to be sign-up only. An existing firm was told an account
 * already existed and given nowhere to go but a small header link, which
 * Marc hit twice in testing. See docs/2026-07-28-consumer-ux-audit.md (P1).
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { conveyancerJoinService, type JoinPreview } from '../../services/conveyancerJoin.service';
import { useAuthStore } from '../../stores/authStore';
import BlueprintBackground from '../../components/common/BlueprintBackground';
import JoinAuthPanel from './JoinAuthPanel';

type PageState = 'loading' | 'error' | 'invite' | 'check-email' | 'redeeming' | 'joined' | 'redeem-error';

const PREVIEW_ERRORS: Record<string, { title: string; message: string }> = {
  invalid_code: {
    title: 'Invalid activation link',
    message: 'We could not find this invitation. Please use the link from your acceptance email.',
  },
  already_redeemed: {
    title: 'Already activated',
    message: 'This invitation has already been used. If that was you, just log in — the transaction is on your dashboard.',
  },
  expired: {
    title: 'Invitation expired',
    message: 'This activation link has expired. Ask your client to re-accept the quote, or contact support@propxchain.com.',
  },
  network: {
    title: 'Something went wrong',
    message: 'We could not verify your invitation. Please try again in a moment.',
  },
};

function InvitationCard({ preview }: { preview: JoinPreview }): React.ReactElement {
  return (
    <div className="mb-8 rounded-lg border border-[#0D9488]/30 bg-[#F0F5F0] dark:bg-teal-900/10 p-5">
      <div className="flex items-center gap-2 text-[#0D9488]">
        <ShieldCheck className="h-5 w-5" aria-hidden />
        <span className="font-[DM_Sans] text-sm font-semibold">Quote accepted — you are instructed</span>
      </div>
      <dl className="mt-3 space-y-1 font-[DM_Sans] text-sm text-[#374151] dark:text-gray-300">
        {preview.firmName && (
          <div><dt className="inline font-medium">Firm: </dt><dd className="inline">{preview.firmName} (CLC {preview.clcId})</dd></div>
        )}
        {preview.propertyAddress && (
          <div><dt className="inline font-medium">Property: </dt><dd className="inline">{preview.propertyAddress}</dd></div>
        )}
      </dl>
    </div>
  );
}

const JoinConveyancerPage: React.FC = () => {
  const { code = '' } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [pageState, setPageState] = useState<PageState>('loading');
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [errorKey, setErrorKey] = useState<string>('invalid_code');
  const [redeemError, setRedeemError] = useState<string>('');
  const [joinedTxId, setJoinedTxId] = useState<string>('');

  const [verificationEmail, setVerificationEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    const run = async (): Promise<void> => {
      const result = await conveyancerJoinService.previewJoinCode(code);
      if (cancelled) return;
      if (result.error || !result.preview) {
        setErrorKey(result.error ?? 'invalid_code');
        setPageState('error');
        return;
      }
      setPreview(result.preview);
      setPageState(isAuthenticated ? 'redeeming' : 'invite');
    };
    void run();
    return () => { cancelled = true; };
    // isAuthenticated deliberately captured once on mount: a mid-visit login
    // returns here via navigation, not a live state flip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (pageState !== 'redeeming') return;
    let cancelled = false;
    const run = async (): Promise<void> => {
      const result = await conveyancerJoinService.redeemJoinCode(code);
      if (cancelled) return;
      if (!result.success) {
        setRedeemError(result.detail ?? result.error ?? 'Activation failed');
        setPageState('redeem-error');
        return;
      }
      conveyancerJoinService.clearPendingJoinCode();
      setJoinedTxId(result.transactionId ?? '');
      setPageState('joined');
    };
    void run();
    return () => { cancelled = true; };
  }, [pageState, code]);

  const handleAwaitingVerification = (signedUpEmail: string): void => {
    setVerificationEmail(signedUpEmail);
    setPageState('check-email');
  };

  // Signed in on this page, so the code is still in the URL — redeem straight
  // away rather than bouncing through /login and relying on the dashboard to
  // pick the stashed code back up.
  const handleAuthenticated = (): void => {
    setPageState('redeeming');
  };

  const heading = (text: string): React.ReactElement => (
    <h1 className="font-[Fraunces] text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] dark:text-white sm:text-[2.5rem]">
      {text}
    </h1>
  );

  return (
    <div className="relative min-h-screen bg-[#FAFAF8]/70 text-[#1A1A1A] dark:bg-gray-900/70 dark:text-white">
      <BlueprintBackground />
      <header className="relative z-10 border-b border-[#E5E7EB] bg-[#FAFAF8]/80 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/80">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5">
          <Link to="/" className="font-[Fraunces] text-xl font-semibold tracking-tight text-[#1A1A1A] hover:text-[#0D9488] dark:text-white">
            PropXchain
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[640px] px-6 py-16">
        {pageState === 'loading' && (
          <div className="flex flex-col items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#0D9488]" aria-hidden />
            <p className="mt-4 font-[DM_Sans] text-base text-[#6B7280]">Verifying your invitation…</p>
          </div>
        )}

        {pageState === 'error' && (
          <div className="text-center">
            {heading(PREVIEW_ERRORS[errorKey]?.title ?? PREVIEW_ERRORS.invalid_code.title)}
            <p className="mt-4 max-w-md mx-auto font-[DM_Sans] text-base text-[#6B7280] dark:text-gray-400">
              {PREVIEW_ERRORS[errorKey]?.message ?? PREVIEW_ERRORS.invalid_code.message}
            </p>
            <Link to="/login" className="mt-8 inline-block font-[DM_Sans] text-sm font-medium text-[#0D9488] hover:underline">
              Go to login
            </Link>
          </div>
        )}

        {pageState === 'invite' && preview && (
          <>
            {heading('Activate your access.')}
            <div className="mt-8">
              <InvitationCard preview={preview} />
            </div>
            <JoinAuthPanel
              code={code}
              firmName={preview.firmName}
              onAwaitingVerification={handleAwaitingVerification}
              onAuthenticated={handleAuthenticated}
            />
          </>
        )}

        {pageState === 'check-email' && (
          <div className="text-center">
            {heading('Check your email.')}
            <p className="mt-4 font-[DM_Sans] text-base text-[#6B7280] dark:text-gray-400">
              We sent a verification link to <strong className="text-[#1A1A1A] dark:text-white">{verificationEmail}</strong>.
              Click it, then sign in — the transaction joins your dashboard automatically.
            </p>
            <Link to="/login" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E]">
              Go to login
            </Link>
          </div>
        )}

        {pageState === 'redeeming' && (
          <div className="flex flex-col items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#0D9488]" aria-hidden />
            <p className="mt-4 font-[DM_Sans] text-base text-[#6B7280]">Joining you to the transaction…</p>
          </div>
        )}

        {pageState === 'joined' && preview && (
          <div className="text-center">
            {heading('You are on the transaction.')}
            <div className="mt-8 text-left"><InvitationCard preview={preview} /></div>
            <p className="font-[DM_Sans] text-base text-[#6B7280] dark:text-gray-400">
              Your firm&rsquo;s CLC-registered details were used to set up your profile —
              please check them on your dashboard and contact
              {' '}<a href="mailto:support@propxchain.com" className="text-[#0D9488] hover:underline">support@propxchain.com</a>{' '}
              if anything needs correcting.
            </p>
            <button type="button"
              onClick={() => navigate(`/conveyancer?joined=${encodeURIComponent(joinedTxId)}&firm=${encodeURIComponent(preview.firmName ?? '')}&clc=${encodeURIComponent(preview.clcId)}`)}
              className="mt-8 inline-flex min-h-12 items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E]">
              Open your dashboard
            </button>
          </div>
        )}

        {pageState === 'redeem-error' && (
          <div className="text-center">
            {heading('Activation failed.')}
            <p className="mt-4 max-w-md mx-auto font-[DM_Sans] text-base text-[#6B7280] dark:text-gray-400">{redeemError}</p>
            <button type="button" onClick={() => setPageState('redeeming')}
              className="mt-8 inline-flex min-h-12 items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E]">
              Try again
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default JoinConveyancerPage;
