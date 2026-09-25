import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, CheckCircle, Loader2 } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { supabase } from '@/lib/supabase';

type PageState = 'form' | 'saving' | 'success';

// v3 Scope Reset: no on-platform identity verification. This screen
// now collects only name + mobile for platform contact purposes.
// Nationality / AML-adjacent fields are the conveyancer's territory
// downstream and are not collected here.
export default function OnboardingKycPage(): JSX.Element {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>('form');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');

  const role = localStorage.getItem('onboardingRole');
  const canSubmit = fullName.trim() && mobile.trim();

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return;
    setError('');
    setPageState('saving');

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          name: fullName.trim(),
          mobile: mobile.trim(),
        },
      });

      if (updateError) {
        setError(updateError.message);
        setPageState('form');
        return;
      }

      const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
      localStorage.setItem('userProfile', JSON.stringify({
        ...profile,
        name: fullName.trim(),
        mobile: mobile.trim(),
      }));

      setPageState('success');
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setPageState('form');
    }
  };

  const handleContinue = (): void => {
    // Sellers pick Starter or Premium at the tier picker; buyers are
    // always Starter and go straight to the invite-code page.
    navigate(role === 'seller' ? '/start-transaction' : '/onboarding/join');
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

      <main className="relative min-h-[calc(100vh-3.5rem)] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <div className="absolute inset-0 bg-gradient-to-t from-white/20 via-transparent to-white/40" />
        </div>

        <div className="relative z-10 w-full max-w-md mx-auto px-3 sm:px-4 py-6 sm:py-12">
          <Card className="bg-card/95 backdrop-blur shadow-xl border-gray-200">
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-800 shadow-lg">
                  <User className="h-8 w-8 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">Your details</CardTitle>
              <CardDescription className="text-base">
                Just a few details so we know who you are.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4">
              {pageState === 'success' ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <CheckCircle className="h-16 w-16 text-green-600" />
                  <h2 className="text-2xl font-bold">All set!</h2>
                  <p className="text-center text-muted-foreground max-w-sm">
                    Your profile has been saved. Let&apos;s get started.
                  </p>
                  <Button
                    className="w-full max-w-xs bg-gray-800 hover:bg-gray-700 text-white mt-4"
                    onClick={handleContinue}
                  >
                    Continue
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {error && (
                    <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                      <CardContent className="p-3">
                        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                      </CardContent>
                    </Card>
                  )}

                  <div>
                    <Label htmlFor="fullName">Full name *</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      placeholder="e.g. John Smith"
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="mobile">Mobile number *</Label>
                    <Input
                      id="mobile"
                      type="tel"
                      value={mobile}
                      placeholder="e.g. 07700 900000"
                      onChange={(e) => setMobile(e.target.value)}
                    />
                  </div>

                  <Button
                    className="w-full bg-gray-800 hover:bg-gray-700 text-white"
                    disabled={!canSubmit || pageState === 'saving'}
                    onClick={() => void handleSubmit()}
                  >
                    {pageState === 'saving' ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Continue'
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
