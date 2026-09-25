import { useNavigate } from 'react-router-dom';
import TransactionInvite from '@/components/TransactionInvite';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Key, Loader2 } from 'lucide-react';
import { Transaction } from '@/types/transaction.types';
import { Logo } from '@/components/brand/Logo';
import { usePrincipalId } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

export default function OnboardingJoinPage(): JSX.Element {
  const navigate = useNavigate();
  const principalId = usePrincipalId();
  const role = localStorage.getItem('onboardingRole');

  // ProtectedRoute handles auth — just guard for missing principal
  if (!principalId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (role !== 'buyer') {
    navigate('/onboarding/role');
    return <></>;
  }

  const handleJoinSuccess = (_transaction: Transaction): void => {
    localStorage.setItem('onboardingComplete', 'true');
    localStorage.removeItem('onboardingRole');
    localStorage.removeItem('needsOnboarding');
    // Persist to Supabase user_metadata so a later login doesn't funnel
    // the buyer back to /onboarding/join on a new session / device.
    void supabase.auth.updateUser({
      data: { propxchain_onboarded: true },
    });
    navigate('/dashboard');
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

        <div className="relative z-10 w-full max-w-lg mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-800 shadow-lg">
                <Key className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">Enter Your Transaction Code</h1>
            <p className="text-muted-foreground">
              Your seller should have shared a 6-character invite code with you.
              Enter it below to join the transaction.
            </p>
          </div>

          <TransactionInvite
            onJoinSuccess={handleJoinSuccess}
            onClose={() => navigate('/onboarding/role')}
          />

          <Card className="mt-6 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Don't have a code?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Ask the person selling the property for your invite code.
                They will receive one after listing their property on PropXchain.
              </p>
            </CardContent>
          </Card>

          <button
            onClick={() => navigate('/onboarding/role')}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors mt-4"
          >
            Go back and change role
          </button>
        </div>
      </main>
    </div>
  );
}
