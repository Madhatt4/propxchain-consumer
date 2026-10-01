// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { Navigate } from 'react-router-dom';
import LandingPage from '../pages/landing/LandingPage';
import { isNativeApp } from '../lib/native';

/**
 * Root route (`/`) switcher.
 *
 * Shows the marketing LandingPage in a browser. The phone app has no
 * marketing page, so it goes straight to /post-login. Authenticated users reach
 * their dashboard via /login → AuthGate → decideRoute. This avoids
 * auto-resuming sessions when someone just visits the homepage.
 */
const RootLanding: React.FC = () => {
  if (isNativeApp()) return <Navigate to="/post-login" replace />;
  return <LandingPage />;
};

export default RootLanding;
