// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { useAutoLogout } from './hooks/useAutoLogout';
// Theme is initialised by ThemeProvider — no separate initTheme call needed
import { icpService } from './services/icp.service';
import { useAuthStore } from './stores/authStore';
import { RateLimitProvider } from './contexts/RateLimitContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { RateLimitToast } from './components/common/RateLimitToast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';
import { AnalyticsTracker } from '@/components/analytics/AnalyticsTracker';
import SessionWarningModal from './components/auth/SessionWarningModal';
import SupportChatWidget from './components/support/SupportChatWidget';
import ProtectedRoute from './components/auth/ProtectedRoute';
import RequirePrincipal from './components/auth/RequirePrincipal';
import RequireProfile from './components/auth/RequireProfile';
import { logger } from './utils/logger';

// Maintenance mode — set VITE_MAINTENANCE_MODE=true to disable registration.
// The flag lives in config/registration so the pages that OFFER registration
// read the same value that gates the route. See that file for why.
const MAINTENANCE_MODE = !IS_REGISTRATION_OPEN;

// Eager load landing and auth pages for fast initial load
import RootLanding from './router/RootLanding';
import AuthGate from './router/AuthGate';
import NotFoundRedirect from './router/NotFoundRedirect';
import RolePickerPage from './router/RolePickerPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import MaintenanceNotice from './pages/auth/MaintenanceNotice';
import { IS_REGISTRATION_OPEN } from './config/registration';
import RegisterDeveloperPage from './pages/auth/RegisterDeveloperPage';
import RegisterConveyancerPage from './pages/auth/RegisterConveyancerPage';
import RegisterEstateAgentPage from './pages/auth/RegisterEstateAgentPage';
import RedeemDeveloperInvitePage from './pages/auth/RedeemDeveloperInvitePage';
import JoinConveyancerPage from './pages/conveyancer/JoinConveyancerPage';
import ProfileSetup from './pages/auth/ProfileSetup';
import PasswordResetForm from './components/auth/PasswordResetForm';
import Dashboard from './pages/Dashboard_Premium'; // Eager load dashboard to avoid 503 errors after login

// Lazy load all other pages to reduce bundle size
const FeaturesPage = lazy(() => import('./pages/FeaturesPage'));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage'));
const SellMyHousePage = lazy(() => import('./pages/SellMyHousePage'));
const FindAConveyancerPage = lazy(() => import('./pages/FindAConveyancerPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const CompliancePage = lazy(() => import('./pages/CompliancePage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const SalesPage = lazy(() => import('./pages/SalesPage'));
const PartnersPage = lazy(() => import('./pages/PartnersPage'));
const DashboardModern = lazy(() => import('./pages/Dashboard_Modern'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PropertiesPage = lazy(() => import('./pages/PropertiesPage'));
const StakeholdersPage = lazy(() => import('./pages/StakeholdersPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
// TransactionStatusPage + TransactionDetail no longer route-mounted — both now
// redirect to /transaction/:id/flow (canonical page). Files retained in the
// repo for reference during the two-week soak before deletion.
const TransactionDashboardPage = lazy(() => import('./pages/TransactionDashboardPage'));
// PropertyWizard removed - using simple CreateTransactionPage instead
const CreateTransactionPage = lazy(() => import('./pages/CreateTransactionPage'));
const StartTransactionPage = lazy(() => import('./pages/StartTransactionPage'));
const ExchangeSigningPage = lazy(() => import('./pages/ExchangeSigningPage'));
const BlockchainLedgerPage = lazy(() => import('./pages/BlockchainLedgerPage'));
const DashboardSupportPage = lazy(() => import('./pages/DashboardSupportPage'));
const TicketListPage = lazy(() => import('./pages/support/TicketListPage'));
const TicketPage = lazy(() => import('./pages/support/TicketPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AllTransactionsAuditPage = lazy(() => import('./pages/AllTransactionsAuditPage'));
const AdminTestingPanel = lazy(() => import('./pages/AdminTestingPanel'));
const ICPTest = lazy(() => import('./pages/ICPTest'));
const ShareTransactionPage = lazy(() => import('./pages/ShareTransactionPage'));
const JoinTransactionPage = lazy(() => import('./pages/JoinTransactionPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const MessagesPage = lazy(() => import('./components/messaging/MessagesPage'));
const ApiDocsPage = lazy(() => import('./pages/api/ApiDocsPage'));
const FaqPage = lazy(() => import('./pages/marketing/FaqPage'));
const ResourcesHubPage = lazy(() => import('./pages/resources/ResourcesHubPage'));
const ResourceCategoryPage = lazy(() => import('./pages/resources/ResourceCategoryPage'));
const PropertyPackGuide = lazy(() => import('./pages/resources/PropertyPackGuide'));
const ConveyancingTimelineGuide = lazy(() => import('./pages/resources/ConveyancingTimelineGuide'));
const BaspiGuide = lazy(() => import('./pages/resources/BaspiGuide'));
const PropertySearchesGuide = lazy(() => import('./pages/resources/PropertySearchesGuide'));
const PropertyInfoFormsGuide = lazy(() => import('./pages/resources/PropertyInfoFormsGuide'));
const HowToSignInGuide = lazy(() => import('./pages/resources/HowToSignInGuide'));
const PackViewPage = lazy(() => import('./pages/PackViewPage'));
const WalletProofPage = lazy(() => import('./pages/WalletProofPage'));
const PublicListingPage = lazy(() => import('./pages/public/PublicListingPage'));
// Payment pages — imported eagerly to avoid lazy-load crashes on Stripe redirect
import PaymentSuccessPage from './pages/payment/PaymentSuccessPage';
import SellerFeeSuccessPage from './pages/payment/SellerFeeSuccessPage';
import QuoteFormPage from './pages/quote/QuoteFormPage';
const ConveyancerDashboard = lazy(() => import('./pages/ConveyancerDashboard'));
const AuthCallback = lazy(() => import('./pages/auth/AuthCallback'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const RoleSelectionPage = lazy(() => import('./pages/onboarding/RoleSelectionPage'));
const OnboardingPaymentPage = lazy(() => import('./pages/onboarding/OnboardingPaymentPage'));
const OnboardingJoinPage = lazy(() => import('./pages/onboarding/OnboardingJoinPage'));
const OnboardingKycPage = lazy(() => import('./pages/onboarding/OnboardingKycPage'));
const TransactionFlowPage = lazy(() => import('./pages/TransactionFlowPage'));
const TransactionAuditPage = lazy(() => import('./pages/TransactionAuditPage'));
const TA6FormPage = lazy(() => import('./pages/TA6FormPage'));
const TA10FormPage = lazy(() => import('./pages/TA10FormPage'));
const TA7FormPage = lazy(() => import('./pages/TA7FormPage'));
const BotAgentSettings = lazy(() => import('./pages/BotAgentSettings'));
const MyDocumentsPage = lazy(() => import('./pages/MyDocumentsPage'));
const MyLogbooksPage = lazy(() => import('./pages/MyLogbooksPage'));
const BuilderLayout = lazy(() => import('./components/builder/BuilderLayout'));
const BuilderDashboardPage = lazy(() => import('./pages/builder/BuilderDashboardPage'));
const SiteCreateWizard = lazy(() => import('./pages/builder/SiteCreateWizard'));
const SiteDetailPage = lazy(() => import('./pages/builder/SiteDetailPage'));
const PlotTypeListPage = lazy(() => import('./pages/builder/PlotTypeListPage'));
const PlotTypeEditPage = lazy(() => import('./pages/builder/PlotTypeEditPage'));
const PlotListPage = lazy(() => import('./pages/builder/PlotListPage'));
const PlotDetailPage = lazy(() => import('./pages/builder/PlotDetailPage'));
const PlotCreatePage = lazy(() => import('./pages/builder/PlotCreatePage'));
const PlotImportPage = lazy(() => import('./pages/builder/PlotImportPage'));
const PipelineKanbanPage = lazy(() => import('./pages/builder/PipelineKanbanPage'));
const MilestonesPage = lazy(() => import('./pages/builder/MilestonesPage'));
const SagasPage = lazy(() => import('./pages/admin/SagasPage'));
const SupportDeskPage = lazy(() => import('./pages/admin/SupportDeskPage'));
const EstateAgentLayout = lazy(() => import('./components/estate-agent/EstateAgentLayout'));
const EstateAgentListingListPage = lazy(() => import('./pages/estate-agent/ListingListPage'));
const EstateAgentListingCreatePage = lazy(() => import('./pages/estate-agent/ListingCreatePage'));
const EstateAgentListingDetailPage = lazy(() => import('./pages/estate-agent/ListingDetailPage'));
const EstateAgentPipelinePage = lazy(() => import('./pages/estate-agent/PipelinePage'));
const DelegatePage = lazy(() => import('./pages/DelegatePage'));

// Loading component - theme-aware to prevent flash
const LoadingFallback = () => (
  <div className="min-h-screen bg-stone-50 dark:bg-gray-900 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400 dark:border-gray-500 mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-400">Loading...</p>
    </div>
  </div>
);

// Legacy transaction routes (/transaction/:id, /transaction/:id/status)
// redirect to the canonical flow page. Keeps deep links alive while old
// route handlers wait for deletion per the transaction-flow brief (monorepo).
const TransactionFlowRedirect = () => {
  const { id = '' } = useParams<{ id: string }>();
  return <Navigate to={`/transaction/${id}/flow`} replace />;
};

function App() {
  // Set up auto-logout functionality with warning modal
  const { showWarning, timeRemaining, extendSession } = useAutoLogout();

  // Initialize auth store and ICP service on app start
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize auth store (handles both Supabase + II session restore)
        await useAuthStore.getState().initialize();

        // Initialize ICP service (anonymous agent for public reads)
        await icpService.initialize();
      } catch (err) {
        logger.error('Failed to initialize app:', err);
      }
    };
    initializeApp();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RateLimitProvider>
          <RateLimitToast />
          <Toaster />
          <SessionWarningModal
            isOpen={showWarning}
            timeRemaining={timeRemaining}
            onExtendSession={extendSession}
            onLogout={() => useAuthStore.getState().logout()}
          />
          <Router>
            <AnalyticsTracker />
            {/* One mount for every dashboard route — the widget gates itself on
                the path, because this repo has no dashboard layout to hang it off.
                Its own boundary, because it is a SIBLING of the routes' one: a
                throw in the help chat would otherwise white-screen the dashboard
                underneath it. The fallback is an empty fragment, not null —
                ErrorBoundary reads a falsy fallback as "no fallback" and renders
                its full-page error UI, which is the one thing a broken help
                button must never do. Losing the button is the right failure. */}
            <ErrorBoundary fallback={<></>}>
              <SupportChatWidget />
            </ErrorBoundary>
            <ErrorBoundary>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
              {/* Public routes */}
              <Route path="/" element={<RootLanding />} />
              <Route path="/post-login" element={<ProtectedRoute><AuthGate /></ProtectedRoute>} />
              <Route path="/role-picker" element={<ProtectedRoute><RolePickerPage /></ProtectedRoute>} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              {/* Prerendered + sitemapped at priority 0.95. Without these two
                  routes the catch-all bounced every human arriving from search
                  to home — see marketingRouteParity.test.ts. */}
              <Route path="/sell-my-house" element={<SellMyHousePage />} />
              <Route path="/find-a-conveyancer" element={<FindAConveyancerPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/terms" element={<TermsOfServicePage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/compliance" element={<CompliancePage />} />
              <Route path="/support" element={<SupportPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/partners" element={<PartnersPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              {/* The standalone audience pages were folded into the unified
                  landing (sections #sellers / #buyers / #conveyancers /
                  #developers). These legacy routes redirect to the matching
                  in-page anchor so old links and bookmarks keep working. */}
              <Route path="/developers" element={<Navigate to="/#developers" replace />} />
              <Route path="/sellers" element={<Navigate to="/#sellers" replace />} />
              <Route path="/buyers" element={<Navigate to="/#buyers" replace />} />
              <Route path="/conveyancers" element={<Navigate to="/#conveyancers" replace />} />
              <Route path="/solicitors" element={<Navigate to="/#conveyancers" replace />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="/resources" element={<ResourcesHubPage />} />
              <Route path="/resources/:category" element={<ResourceCategoryPage />} />
              <Route path="/resources/selling/what-is-a-property-pack" element={<PropertyPackGuide />} />
              <Route path="/resources/buying/how-long-does-conveyancing-take" element={<ConveyancingTimelineGuide />} />
              <Route path="/resources/industry-and-reform/baspi-explained" element={<BaspiGuide />} />
              <Route path="/resources/searches-and-legal/property-searches-explained" element={<PropertySearchesGuide />} />
              <Route path="/resources/selling/property-information-forms-explained" element={<PropertyInfoFormsGuide />} />
              <Route path="/resources/getting-started/how-to-sign-in" element={<HowToSignInGuide />} />
              {/* Legacy /guides URLs — client-side redirects to the resources hub. */}
              <Route path="/guides" element={<Navigate to="/resources" replace />} />
              <Route path="/guides/what-is-a-property-pack" element={<Navigate to="/resources/selling/what-is-a-property-pack" replace />} />
              {/* Public, tokenised, noindex — the seller's shared sales pack. */}
              <Route path="/pack/:token" element={<PackViewPage />} />
              <Route path="/proof/:token" element={<WalletProofPage />} />
              {/* Public estate-agent listing page — indexable, no auth. */}
              <Route path="/property/:slug" element={<PublicListingPage />} />
              <Route path="/guides/how-long-does-conveyancing-take" element={<Navigate to="/resources/buying/how-long-does-conveyancing-take" replace />} />
              <Route path="/guides/baspi-explained" element={<Navigate to="/resources/industry-and-reform/baspi-explained" replace />} />
              <Route path="/guides/property-searches-explained" element={<Navigate to="/resources/searches-and-legal/property-searches-explained" replace />} />
              <Route path="/guides/property-information-forms-explained" element={<Navigate to="/resources/selling/property-information-forms-explained" replace />} />
              <Route path="/api" element={<ApiDocsPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={MAINTENANCE_MODE ? <MaintenanceNotice /> : <RegisterPage />} />
              <Route path="/register/developer" element={<RegisterDeveloperPage />} />
              <Route path="/register/conveyancer" element={<RegisterConveyancerPage />} />
              <Route path="/register/estate-agent" element={<RegisterEstateAgentPage />} />
              <Route path="/conveyancer/join/:code" element={<JoinConveyancerPage />} />
              <Route path="/redeem/dev" element={<RedeemDeveloperInvitePage />} />
              <Route path="/auth/callback" element={<Suspense fallback={<div />}><AuthCallback /></Suspense>} />
              <Route path="/reset-password" element={<Suspense fallback={<div />}><ResetPasswordPage /></Suspense>} />
              <Route path="/forgot-password" element={<PasswordResetForm />} />
              <Route path="/quote/:token" element={<QuoteFormPage />} />

              {/* Protected routes (auth required) */}
              <Route path="/profile-setup" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
              <Route path="/onboarding/role" element={<ProtectedRoute><RoleSelectionPage /></ProtectedRoute>} />
              <Route path="/onboarding/payment" element={<ProtectedRoute><OnboardingPaymentPage /></ProtectedRoute>} />
              <Route path="/onboarding/join" element={<ProtectedRoute><OnboardingJoinPage /></ProtectedRoute>} />
              {/* Renamed from /onboarding/verify-identity — v3 Scope Reset
                  explicitly descopes on-platform identity verification. The
                  screen now collects basic profile info only. Old path kept
                  as a redirect for in-flight links. */}
              <Route path="/onboarding/profile" element={<ProtectedRoute><OnboardingKycPage /></ProtectedRoute>} />
              <Route path="/onboarding/verify-identity" element={<Navigate to="/onboarding/profile" replace />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/dashboard/modern" element={<ProtectedRoute><DashboardModern /></ProtectedRoute>} />
              <Route path="/dashboard/ledger" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/dashboard/properties" element={<ProtectedRoute><PropertiesPage /></ProtectedRoute>} />
              <Route path="/dashboard/stakeholders" element={<ProtectedRoute><StakeholdersPage /></ProtectedRoute>} />
              <Route path="/dashboard/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
              <Route path="/dashboard/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/dashboard/support" element={<ProtectedRoute><DashboardSupportPage /></ProtectedRoute>} />
              {/* Tickets are Supabase-backed, so these need a session but no principal. */}
              <Route path="/dashboard/support/tickets" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><TicketListPage /></Suspense></ProtectedRoute>} />
              <Route path="/dashboard/support/tickets/:id" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><TicketPage /></Suspense></ProtectedRoute>} />
              <Route path="/dashboard/bot-agents" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><BotAgentSettings /></Suspense></ProtectedRoute>} />
              <Route path="/dashboard/my-documents" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><MyDocumentsPage /></Suspense></ProtectedRoute>} />
              <Route path="/dashboard/my-logbooks" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><MyLogbooksPage /></Suspense></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
              {/* /wizard now redirects to simplified create-transaction flow */}
              <Route path="/wizard" element={<Navigate to="/create-transaction" replace />} />
              <Route path="/transaction-dashboard" element={<ProtectedRoute><TransactionDashboardPage /></ProtectedRoute>} />
              <Route path="/icp-test" element={<ProtectedRoute><ICPTest /></ProtectedRoute>} />
              <Route path="/payment/success" element={<PaymentSuccessPage />} />
              <Route path="/seller-fee/success" element={<SellerFeeSuccessPage />} />

              {/* Protected + RequirePrincipal routes (canister-write pages) */}
              <Route path="/start-transaction" element={<ProtectedRoute><RequirePrincipal><RequireProfile><StartTransactionPage /></RequireProfile></RequirePrincipal></ProtectedRoute>} />
              <Route path="/create-transaction" element={<ProtectedRoute><RequirePrincipal><RequireProfile><CreateTransactionPage /></RequireProfile></RequirePrincipal></ProtectedRoute>} />
              <Route path="/transaction/:id" element={<ProtectedRoute><TransactionFlowRedirect /></ProtectedRoute>} />
              <Route path="/transaction/:id/flow" element={<ProtectedRoute><RequirePrincipal><RequireProfile><Suspense fallback={<LoadingFallback />}><TransactionFlowPage /></Suspense></RequireProfile></RequirePrincipal></ProtectedRoute>} />
              <Route path="/transaction/:id/forms/ta6" element={<ProtectedRoute><RequirePrincipal><RequireProfile><Suspense fallback={<LoadingFallback />}><TA6FormPage /></Suspense></RequireProfile></RequirePrincipal></ProtectedRoute>} />
              <Route path="/transaction/:id/forms/ta10" element={<ProtectedRoute><RequirePrincipal><RequireProfile><Suspense fallback={<LoadingFallback />}><TA10FormPage /></Suspense></RequireProfile></RequirePrincipal></ProtectedRoute>} />
              <Route path="/transaction/:id/forms/ta7" element={<ProtectedRoute><RequirePrincipal><RequireProfile><Suspense fallback={<LoadingFallback />}><TA7FormPage /></Suspense></RequireProfile></RequirePrincipal></ProtectedRoute>} />
              <Route path="/transaction/:id/audit" element={<ProtectedRoute><RequirePrincipal><RequireProfile><Suspense fallback={<LoadingFallback />}><TransactionAuditPage /></Suspense></RequireProfile></RequirePrincipal></ProtectedRoute>} />
              <Route path="/transaction/:id/status" element={<ProtectedRoute><TransactionFlowRedirect /></ProtectedRoute>} />
              <Route path="/transaction/:id/share" element={<ProtectedRoute><RequirePrincipal><RequireProfile><ShareTransactionPage /></RequireProfile></RequirePrincipal></ProtectedRoute>} />
              <Route path="/join" element={<ProtectedRoute><RequirePrincipal><RequireProfile><JoinTransactionPage /></RequireProfile></RequirePrincipal></ProtectedRoute>} />
              <Route path="/join/:id" element={<ProtectedRoute><RequirePrincipal><RequireProfile><JoinTransactionPage /></RequireProfile></RequirePrincipal></ProtectedRoute>} />
              {/* The hand-over confirm page (agent CRM): the email tap signs the client in, the grant happens here. */}
              <Route path="/delegate/:id" element={<ProtectedRoute><RequirePrincipal><RequireProfile><DelegatePage /></RequireProfile></RequirePrincipal></ProtectedRoute>} />
              <Route path="/exchange/:transactionId" element={<ProtectedRoute><RequirePrincipal><RequireProfile><ExchangeSigningPage /></RequireProfile></RequirePrincipal></ProtectedRoute>} />
              <Route path="/dashboard/blockchain-ledger" element={<ProtectedRoute><RequirePrincipal><RequireProfile><BlockchainLedgerPage /></RequireProfile></RequirePrincipal></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><RequirePrincipal><RequireProfile><AdminDashboard /></RequireProfile></RequirePrincipal></ProtectedRoute>} />
              <Route path="/admin/audit" element={<ProtectedRoute><RequirePrincipal><RequireProfile><AllTransactionsAuditPage /></RequireProfile></RequirePrincipal></ProtectedRoute>} />
              <Route path="/admin/testing" element={<ProtectedRoute><RequirePrincipal><RequireProfile><AdminTestingPanel /></RequireProfile></RequirePrincipal></ProtectedRoute>} />
              <Route path="/admin/sagas" element={<ProtectedRoute><RequirePrincipal><RequireProfile><SagasPage /></RequireProfile></RequirePrincipal></ProtectedRoute>} />
              <Route path="/admin/support" element={<ProtectedRoute><RequirePrincipal><RequireProfile><SupportDeskPage /></RequireProfile></RequirePrincipal></ProtectedRoute>} />
              <Route path="/conveyancer" element={<ProtectedRoute><RequirePrincipal><RequireProfile><ConveyancerDashboard /></RequireProfile></RequirePrincipal></ProtectedRoute>} />

              {/* Builder / Developer portal — wrapped in BuilderLayout for sidebar */}
              <Route path="/builder" element={<ProtectedRoute><BuilderLayout /></ProtectedRoute>}>
                <Route index element={<BuilderDashboardPage />} />
                <Route path="sites/new" element={<SiteCreateWizard />} />
                <Route path="sites/:siteId" element={<SiteDetailPage />} />
                <Route path="sites/:siteId/plot-types" element={<PlotTypeListPage />} />
                <Route path="sites/:siteId/plot-types/new" element={<PlotTypeEditPage />} />
                <Route path="sites/:siteId/plot-types/:plotTypeId/edit" element={<PlotTypeEditPage />} />
                <Route path="sites/:siteId/plots" element={<PlotListPage />} />
                <Route path="sites/:siteId/plots/import" element={<PlotImportPage />} />
                <Route path="sites/:siteId/plots/new" element={<PlotCreatePage />} />
                <Route path="sites/:siteId/plots/:plotId" element={<PlotDetailPage />} />
                <Route path="sites/:siteId/plots/:plotId/edit" element={<PlotCreatePage />} />
                <Route path="sites/:siteId/pipeline" element={<PipelineKanbanPage />} />
                <Route path="sites/:siteId/milestones" element={<MilestonesPage />} />
              </Route>

              {/* Estate agent portal — listings + sales progression */}
              <Route path="/estate-agent" element={<ProtectedRoute><EstateAgentLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="listings" replace />} />
                <Route path="listings" element={<EstateAgentListingListPage />} />
                <Route path="listings/new" element={<EstateAgentListingCreatePage />} />
                <Route path="listings/:id" element={<EstateAgentListingDetailPage />} />
                <Route path="pipeline" element={<EstateAgentPipelinePage />} />
              </Route>

                <Route path="*" element={<NotFoundRedirect />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </Router>
        </RateLimitProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
