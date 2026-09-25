import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home, Key, Loader2 } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { usePrincipalId } from '@/stores/authStore';

type UserRole = 'seller' | 'buyer';

export default function RoleSelectionPage(): JSX.Element {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const principalId = usePrincipalId();

  // ProtectedRoute handles auth — just guard for missing principal
  if (!principalId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleRoleSelect = (role: UserRole): void => {
    setIsLoading(true);
    localStorage.setItem('userType', role);
    localStorage.setItem('onboardingRole', role);
    navigate('/onboarding/profile');
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

        <div className="relative z-10 w-full max-w-2xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Welcome to PropXchain</h1>
            <p className="text-muted-foreground text-lg">Are you selling or buying a property?</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card className="cursor-pointer hover:shadow-lg transition-all hover:border-gray-800 dark:hover:border-gray-400" onClick={() => !isLoading && handleRoleSelect('seller')}>
              <CardHeader className="text-center pb-2">
                <div className="flex justify-center mb-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-800 shadow-lg">
                    <Home className="h-8 w-8 text-white" />
                  </div>
                </div>
                <CardTitle className="text-xl">I'm Selling</CardTitle>
                <CardDescription>List your property for sale</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground mb-4">Create a property listing and invite your buyer to the transaction.</p>
                <p className="text-sm font-semibold text-green-600">Free — no platform fee</p>
                <Button className="w-full mt-4 bg-gray-800 hover:bg-gray-700 text-white" disabled={isLoading}>Get Started as Seller</Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-all hover:border-gray-800 dark:hover:border-gray-400" onClick={() => !isLoading && handleRoleSelect('buyer')}>
              <CardHeader className="text-center pb-2">
                <div className="flex justify-center mb-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-800 shadow-lg">
                    <Key className="h-8 w-8 text-white" />
                  </div>
                </div>
                <CardTitle className="text-xl">I'm Buying</CardTitle>
                <CardDescription>Join an existing transaction</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground mb-4">Enter the invite code from your seller to access the transaction.</p>
                <p className="text-sm font-semibold text-green-600">Free — no platform fee</p>
                <Button variant="outline" className="w-full mt-4" disabled={isLoading}>Get Started as Buyer</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
