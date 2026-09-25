import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { stripePaymentService } from '@/services/stripePayment.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle, Loader2 } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { logger } from '@/utils/logger';
import { usePrincipalId } from '@/stores/authStore';

export default function OnboardingPaymentPage(): JSX.Element {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const principalId = usePrincipalId();

  // ProtectedRoute already handles auth redirect — just guard for missing principal
  if (!principalId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Ensure onboardingRole is set for the payment flow
  // (already-authenticated sellers arriving from dashboard won't have it)
  if (!localStorage.getItem('onboardingRole')) {
    localStorage.setItem('onboardingRole', 'seller');
  }

  const handlePayment = async (): Promise<void> => {
    setIsLoading(true);
    setError('');

    try {
      localStorage.setItem('onboardingFlow', 'seller');

      await stripePaymentService.createCheckoutSession({
        principalId,
        tier: 'premium',
        amount: 75,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payment failed. Please try again.';
      setError(message);
      setIsLoading(false);
      logger.error('Onboarding payment error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 sm:h-16 items-center px-3 sm:px-4">
          <div className="flex items-center gap-2">
            <Logo variant="mark" tone="onLight" to={null} className="h-10 w-auto" />
          </div>
        </div>
      </header>

      <main className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900" />

        <div className="relative z-10 w-full max-w-md mx-auto px-4 py-12">
          <Card className="bg-card/95 backdrop-blur shadow-xl">
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-800 shadow-lg">
                  <Shield className="h-8 w-8 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl">Seller Platform Fee</CardTitle>
              <CardDescription>One-time fee to list your property on the blockchain</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="text-center">
                <span className="text-4xl font-bold">£75</span>
                <p className="text-sm text-muted-foreground mt-1">per transaction</p>
              </div>

              <div className="space-y-3">
                {[
                  'Property listing on the blockchain',
                  'Buyer invite code generation',
                  'Document upload & verification',
                  'Real-time transaction tracking',
                  'Electronic contract signing',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {error && (
                <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                  <CardContent className="p-3">
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                  </CardContent>
                </Card>
              )}

              <Button
                onClick={handlePayment}
                disabled={isLoading}
                className="w-full h-12 text-base bg-gray-800 hover:bg-gray-700 text-white"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Redirecting to payment...
                  </>
                ) : (
                  'Pay £75 & List Your Property'
                )}
              </Button>

              <div className="flex justify-center">
                <Badge variant="secondary" className="text-xs">
                  <Shield className="mr-1 h-3 w-3" />
                  Secured by Stripe
                </Badge>
              </div>

              <button
                onClick={() => navigate('/dashboard')}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to dashboard
              </button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
