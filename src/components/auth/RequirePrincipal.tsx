// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { usePrincipal, useAuthStore } from '../../stores/authStore';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface RequirePrincipalProps {
  children: React.ReactElement;
}

const RequirePrincipal: React.FC<RequirePrincipalProps> = ({ children }) => {
  const principal = usePrincipal();
  const logout = useAuthStore((state) => state.logout);

  if (!principal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md mx-auto text-center p-8">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Blockchain Identity Unavailable</h2>
          <p className="text-muted-foreground mb-6">
            Your blockchain identity could not be loaded. Please log out and sign in again to restore it.
          </p>
          <Button
            onClick={() => logout()}
            className="bg-gray-800 hover:bg-gray-700 text-white"
          >
            Log out and try again
          </Button>
        </div>
      </div>
    );
  }

  return children;
};

export default RequirePrincipal;
