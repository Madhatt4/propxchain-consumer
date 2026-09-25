// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * ID & AML panel — the `?tab=aml` surface, reached from the header button
 * beside Transaction Wallet. A panel rather than a flow stage because checks
 * are PER PERSON (buyer, seller, both halves of a couple) and must not gate
 * the deal; a stage implies one thing happening once, in sequence.
 *
 * Money path mirrors searches: /order writes an unpaid row, Stripe charges a
 * server-derived price, and only after payment does the worker place the real
 * check. The completed report drops into the Transaction Wallet — this panel
 * never grows a second sharing mechanism.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { amlProductRef, amlService } from '@/services/aml.service';
import type { AmlCheck, AmlPersonalDetails, AmlPricing, AmlTier } from '@/services/aml.service';
import { icpService } from '@/services/icp.service';
import { partyRoleService } from '@/services/partyRole.service';
import { sharePartyService } from '@/services/shareParty.service';
import type { ShareParty } from '@/services/shareParty.service';
import { stripePaymentService } from '@/services/stripePayment.service';
import { vaultDocumentService } from '@/services/vaultDocument.service';
import { transactionWalletService } from '@/services/transactionWallet.service';
import { VAULT_SLOTS } from '@/types/vault.types';
import { useSubscription } from '@/hooks/useSubscription';
import { vaultFilesPerSlot, vaultTotalBytes } from '@/constants/subscriptionFeatures';
import { FEATURE_FLAGS } from '@/config/features';
import { logger } from '@/utils/logger';
import type { TransactionTabProps } from './transactionTabs.config';
import { AmlPersonCard } from './AmlPersonCard';
import { checkableParties, hasLiveCheck, latestCheckFor, panelProviderName, providerName, withMe } from './amlStatus';

/** While a check is moving, refresh at this cadence; the webhook lands worker-side. */
const POLL_MS = 20_000;

// Reuse the existing wallet slot rather than inventing one — labelled
// "AML / Source of Funds" with a generic onChainLabel, so nothing personal
// reaches the chain.
// Deliberately NOT a `!` assertion and deliberately not a throw. Both run at
// module load, so either one white-screens the whole tab if the slot id is ever
// renamed — taking the check status the user actually came to read down with
// the report filing, which is a convenience. Same principle as the caught
// failure in fileReportIntoWallet: losing the report must not lose the panel.
const AML_REPORT_SLOT = VAULT_SLOTS.find((s) => s.id === 'amlSourceOfFunds');

/**
 * Who does what, in plain words. The provider performs the check and holds the
 * identity data; PropXchain passes the details on, deletes its copy once the
 * order is placed (verify365-worker's confirm-payment does exactly that), and
 * keeps only the finished report in the wallet for sharing.
 */
function Disclaimer({ providerLabel }: { providerLabel: string }): JSX.Element {
  return (
    <p className="text-[11px] leading-relaxed text-muted-foreground">
      Checks are carried out by {providerLabel}, not by PropXchain. PropXchain passes your details to {providerLabel}{' '}
      and deletes its own copy once the check is placed with {providerLabel}. PropXchain does not assess or approve
      anyone&apos;s identity
      — the result is for your conveyancer to rely on, and {providerLabel}&apos;s completed report is kept in your
      Transaction Wallet so you can share it with any conveyancer.
    </p>
  );
}

/** The provider's mark beside the panel title — the check is theirs, and the panel says so first. */
function ProviderBadge({ providerLabel }: { providerLabel: string }): JSX.Element {
  return (
    <span
      data-testid="aml-provider-badge"
      className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200"
    >
      <ShieldCheck className="h-3 w-3" /> Checks by {providerLabel}
    </span>
  );
}

export function AmlPanelTab({ transactionId }: TransactionTabProps): JSX.Element {
  const [parties, setParties] = useState<ShareParty[]>([]);
  const [me, setMe] = useState<string>('');
  const [checks, setChecks] = useState<AmlCheck[]>([]);
  const [pricing, setPricing] = useState<AmlPricing>({ provider: null, tiers: [] });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startingFor, setStartingFor] = useState<string | null>(null);
  const { tier } = useSubscription();
  // Memoised so it stays a stable dependency for fileReportIntoWallet's
  // useCallback below — a fresh object every render would refire that
  // effect (and re-hit listMyDocuments) on every unrelated re-render.
  const caps = useMemo(
    () => ({ maxFilesPerSlot: vaultFilesPerSlot(tier), maxTotalBytes: vaultTotalBytes(tier) }),
    [tier],
  );

  const refreshChecks = useCallback(async () => {
    try {
      setChecks(await amlService.listChecks(transactionId));
    } catch (e) {
      logger.warn('[aml] check refresh failed', e);
    }
  }, [transactionId]);

  /**
   * File a completed report into the owner's wallet, once.
   *
   * The worker cannot do this: wallet_documents.blockchain_id is NOT NULL and
   * comes from an on-chain registerDocumentProof call, which a Cloudflare
   * Worker has no agent for. So the worker holds the PDF behind a restrictive
   * storage policy and the owner's own client files it.
   */
  const fileReportIntoWallet = useCallback(async (check: AmlCheck): Promise<void> => {
    const label = `ID & AML report — ${check.id}`;
    const existing = await vaultDocumentService.listMyDocuments();
    if (existing.some((d) => d.label === label)) return;

    if (!AML_REPORT_SLOT) {
      // The panel still works; only auto-filing is unavailable. The report
      // remains downloadable from the worker, so nothing is lost.
      logger.error("[aml] no 'amlSourceOfFunds' vault slot — cannot file the report");
      return;
    }

    const url = await amlService.reportUrl(check.id);
    // A 404 or an expired signed URL still RESOLVES — fetch only rejects on a
    // network failure. Without this check the error page's HTML would be stored
    // as aml-report.pdf, and storeDocument would anchor its hash on-chain, so
    // the bad file becomes permanent and costs a registerDocumentProof call.
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Report download failed (${res.status})`);
    const blob = await res.blob();
    const file = new File([blob], 'aml-report.pdf', { type: 'application/pdf' });

    const doc = await vaultDocumentService.storeDocument(file, AML_REPORT_SLOT, caps, label);
    await transactionWalletService.send(transactionId, doc);
    await refreshChecks();
  }, [transactionId, refreshChecks, caps]);

  useEffect(() => {
    const mine = checks.find(
      (c) => c.subjectPrincipal === me && c.status === 'complete' && c.hasReport,
    );
    if (!mine) return;
    void fileReportIntoWallet(mine).catch((e) => logger.warn('[aml] wallet filing failed', e));
  }, [checks, me, fileReportIntoWallet]);

  useEffect(() => {
    if (!FEATURE_FLAGS.AML_ENABLED) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [roster, principal, priced] = await Promise.all([
          sharePartyService.loadRoster(transactionId),
          icpService.getUserPrincipal(),
          amlService.getPricing(),
        ]);
        if (cancelled) return;
        // The worker gates /checks and /order on my transaction_party_roles
        // row, which a deal's creator never had (nobody invites you to your
        // own deal). The flow page self-heals that row on open, but a deep
        // link straight to ?tab=aml races it, so wait for it here before the
        // first gated call; if it fails, the worker's own refusal surfaces
        // below exactly as before.
        if (roster.mySide) {
          await partyRoleService
            .ensureMyRoleFromChain(transactionId)
            .catch((e: unknown) => logger.warn('[aml] could not record my party row', e));
        }
        const rows = await amlService.listChecks(transactionId);
        if (cancelled) return;
        setParties(checkableParties(withMe(roster, principal)));
        setMe(principal);
        setPricing(priced);
        setChecks(rows);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load ID & AML checks');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  useEffect(() => {
    if (!hasLiveCheck(checks)) return;
    const timer = window.setInterval(() => void refreshChecks(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [checks, refreshChecks]);

  const handleStart = async (party: ShareParty, tier: AmlTier, personalDetails: AmlPersonalDetails): Promise<void> => {
    setError(null);
    setStartingFor(party.principal);
    try {
      const order = await amlService.createOrder({
        transactionId,
        subjectPrincipal: party.principal,
        tier,
        personalDetails,
      });
      const { url } = await stripePaymentService.prepareSearchCheckoutSession({
        principalId: me,
        // Without this the worker prices an AML check out of groundsure_orders
        // and 400s — prepareSearchCheckoutSession hardcoded 'search' until now.
        type: 'aml',
        productRef: amlProductRef(order.id),
        cancelPath: `${window.location.pathname}?tab=aml`,
      });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the check');
      setStartingFor(null);
    }
  };

  if (!FEATURE_FLAGS.AML_ENABLED) {
    return (
      <div className="space-y-3 rounded-xl border border-dashed border-border p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-teal-600" /> ID &amp; AML checks are coming soon
        </p>
        <p className="text-xs text-muted-foreground">
          Each buyer and seller will be able to complete one identity and anti-money-laundering check here and share
          the report with any conveyancer from the Transaction Wallet — verify once, share where needed.
        </p>
        <Disclaimer providerLabel={providerName(null)} />
      </div>
    );
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading ID &amp; AML checks…</p>;

  const panelProvider = panelProviderName(pricing.provider, checks[0] ?? null);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-bold text-foreground">ID &amp; AML</h2>
          <ProviderBadge providerLabel={panelProvider} />
        </div>
        <p className="text-xs text-muted-foreground">
          One check per person, carried out by {panelProvider}. It can be started at any point and does not hold up
          the deal.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {parties.length === 0 ? (
        <p className="text-sm text-muted-foreground">No buyer or seller has joined this deal yet.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {parties.map((party) => (
            <AmlPersonCard
              key={party.principal}
              party={party}
              isMe={party.principal === me}
              check={latestCheckFor(checks, party.principal)}
              pricing={pricing.tiers}
              providerLabel={panelProviderName(pricing.provider, latestCheckFor(checks, party.principal))}
              busy={startingFor === party.principal}
              onStart={(p, tier, details) => void handleStart(p, tier, details)}
            />
          ))}
        </div>
      )}
      <Disclaimer providerLabel={panelProvider} />
    </div>
  );
}

export default AmlPanelTab;
