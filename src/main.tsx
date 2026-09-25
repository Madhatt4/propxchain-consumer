// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { useAuthStore } from './stores/authStore'
import { registerWebMcpTools } from './lib/webmcp'
import './styles/index.css'

// DEV ONLY: Bypass Internet Identity login for local development
// Requires VITE_ALLOW_DEV_AUTH=true AND localhost AND dev mode
if (
  import.meta.env.DEV &&
  import.meta.env.VITE_ALLOW_DEV_AUTH === 'true' &&
  window.location.hostname === 'localhost'
) {
  const devPrincipal = import.meta.env.VITE_ADMIN_PRINCIPALS?.split(',')[0]?.trim();
  if (devPrincipal) {
    useAuthStore.setState({ principalId: devPrincipal, isAuthenticated: true });
    // BrowserRouter: seed the path before render so the router boots on /dashboard.
    const devPath = window.location.pathname;
    if (devPath === '/' || devPath === '/login') {
      window.history.replaceState(null, '', '/dashboard');
    }
  }
}

// WebMCP: expose public site actions to in-browser agents. No-op without
// navigator.modelContext; tools are unregistered when the page is hidden.
const webMcp = registerWebMcpTools()
if (webMcp) window.addEventListener('pagehide', () => webMcp.abort(), { once: true })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// No service worker: the IC asset canister served sw.js with the wrong MIME type, so it was
// disabled and later removed. The inline script in index.html unregisters any worker left
// behind by older deployments — keep it, some visitors' browsers still hold one.
