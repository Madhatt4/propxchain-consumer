import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppTopBar from '@/components/navigation/AppTopBar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface SettingsUser {
  principal: string;
  id: string;
}

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isDark, setTheme } = useTheme();
  const [user, setUser] = useState<SettingsUser | null>(null);

  useEffect(() => {
    // Check authentication
    const authState = useAuthStore.getState();
    const principalId = authState.principalId;
    if (!principalId || !authState.isAuthenticated) {
      navigate('/login');
      return;
    }
    setUser({ principal: principalId, id: principalId });
  }, [navigate]);

  const handleThemeToggle = (checked: boolean): void => {
    const newTheme = checked ? 'dark' : 'light';
    setTheme(newTheme);
    toast({
      title: checked ? "Dark Mode Enabled" : "Light Mode Enabled",
      description: `Theme has been switched to ${newTheme} mode.`,
    });
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)]">
      <AppTopBar title="Settings" backTo="/dashboard" backLabel="Back to dashboard" />

      {/* Main Content */}
      <main className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Settings</h2>
              <p className="text-muted-foreground">Manage your application preferences</p>
            </div>

            {/* Theme Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isDark ? (
                    <Moon className="h-5 w-5" />
                  ) : (
                    <Sun className="h-5 w-5" />
                  )}
                  Appearance
                </CardTitle>
                <CardDescription>
                  Customize how PropXchain looks on your device
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Theme Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="dark-mode" className="text-base">
                      Dark Mode
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {isDark
                        ? "Currently using dark theme for better viewing in low light"
                        : "Currently using light theme for better visibility"}
                    </p>
                  </div>
                  <Switch
                    id="dark-mode"
                    checked={isDark}
                    onCheckedChange={handleThemeToggle}
                  />
                </div>

                {/* Theme Preview */}
                <div className="space-y-3">
                  <Label>Preview</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handleThemeToggle(false)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        !isDark
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded border border-gray-300 flex items-center justify-center">
                          <Sun className="h-5 w-5 text-yellow-500" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium">Light</div>
                          <div className="text-xs text-muted-foreground">Clean & bright</div>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleThemeToggle(true)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        isDark
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-900 rounded border border-gray-700 flex items-center justify-center">
                          <Moon className="h-5 w-5 text-gray-500" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium">Dark</div>
                          <div className="text-xs text-muted-foreground">Easy on eyes</div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  System Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Principal ID</span>
                  <span className="font-mono text-xs">{user?.principal?.slice(0, 20)}...</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Network</span>
                  <span>Internet Computer (ICP)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Storage</span>
                  <span>Hash-only (GDPR Compliant)</span>
                </div>
              </CardContent>
            </Card>

            {/* Back Button */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
              >
                Back to Dashboard
              </Button>
            </div>
          </div>
        </main>

      <Toaster />
    </div>
  );
};

export default SettingsPage;
