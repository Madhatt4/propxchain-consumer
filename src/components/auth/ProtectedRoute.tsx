// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import {
  SubscriptionTier,
  getUserSubscriptionTier,
  hasMinimumTier,
  FEATURE_REQUIREMENTS,
} from '../../types/subscription.types';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requiredTier?: SubscriptionTier;
}

/**
 * ProtectedRoute Component
 *
 * Wraps routes that require:
 * 1. Authentication (supports both Supabase and Internet Identity)
 * 2. Subscription tier (optional - checks user's subscription level)
 *
 * If user is not authenticated, redirects to /login
 * If user doesn't have required tier, redirects to /pricing
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredTier }) => {
  const location = useLocation();
  const { isAuthenticated, isInitialized, isLoading } = useAuthStore();

  // Show loading spinner while auth is initializing
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If requiredTier is specified, check subscription tier
  if (requiredTier) {
    const userTier = getUserSubscriptionTier();
    const hasAccess = hasMinimumTier(userTier, requiredTier);

    if (!hasAccess) {
      const featureReq = FEATURE_REQUIREMENTS[location.pathname as keyof typeof FEATURE_REQUIREMENTS];
      const featureName = featureReq?.featureName || 'this feature';

      return (
        <Navigate
          to="/pricing"
          state={{
            from: location,
            requiredTier,
            featureName,
            currentTier: userTier,
          }}
          replace
        />
      );
    }
  }

  return children;
};

export default ProtectedRoute;
