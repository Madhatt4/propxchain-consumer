// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import LandingPage from '../pages/landing/LandingPage';

/**
 * Root route (`/`) switcher.
 *
 * Always shows the marketing LandingPage. Authenticated users reach
 * their dashboard via /login → AuthGate → decideRoute. This avoids
 * auto-resuming sessions when someone just visits the homepage.
 */
const RootLanding: React.FC = () => {
  return <LandingPage />;
};

export default RootLanding;
