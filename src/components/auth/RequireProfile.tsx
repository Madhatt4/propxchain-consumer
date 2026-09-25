// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

interface RequireProfileProps {
  children: React.ReactElement;
}

/**
 * Gate for routes that need an established user_management profile.
 *
 * Email/Supabase users skip this gate — their profile is mirrored from
 * Supabase metadata in the background by mirrorUserProfileToChain on login,
 * and the canister write is fire-and-forget so a fresh user without a
 * profile yet still reaches the dashboard normally (rendering will pull
 * the profile in once it lands).
 *
 * II users hit this gate. If they have no on-chain profile, they're
 * redirected to /profile-setup before they can progress to any
 * canister-write route. Once the profile exists, the gate is transparent.
 */
const RequireProfile: React.FC<RequireProfileProps> = ({ children }) => {
  const location = useLocation();
  const authMethod = useAuthStore((s) => s.authMethod);
  const userProfile = useAuthStore((s) => s.userProfile);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const [hasFetched, setHasFetched] = useState<boolean>(!!userProfile);

  useEffect(() => {
    if (authMethod !== 'ii') {
      setHasFetched(true);
      return;
    }
    if (userProfile) {
      setHasFetched(true);
      return;
    }
    let cancelled = false;
    fetchProfile().finally(() => {
      if (!cancelled) setHasFetched(true);
    });
    return () => {
      cancelled = true;
    };
  }, [authMethod, userProfile, fetchProfile]);

  if (authMethod !== 'ii') {
    return children;
  }

  if (!hasFetched) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-gray-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!userProfile) {
    return <Navigate to="/profile-setup" replace state={{ from: location.pathname + location.search }} />;
  }

  return children;
};

export default RequireProfile;
