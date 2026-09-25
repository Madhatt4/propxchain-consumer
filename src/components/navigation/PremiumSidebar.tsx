/**
 * PropXchain - Premium Sidebar Navigation
 * Shared sidebar component for premium dashboard pages.
 * Includes mobile hamburger button + offcanvas drawer for screens below lg (1024px).
 */

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './PremiumSidebar.css';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/stores/authStore';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import MobileNavMenu from './MobileNavMenu';
import RoleIndicator from './RoleIndicator';
import { Logo } from '@/components/brand/Logo';

interface PremiumSidebarProps {
  activeRoute?: string;
  onAddTransaction?: () => void;
}

const PremiumSidebar: React.FC<PremiumSidebarProps> = ({ activeRoute, onAddTransaction }) => {
  const navigate = useNavigate();
  const location = useLocation();
  // Admin status from user_management `admins` map (single source of truth).
  const { isAdmin } = useIsAdmin();
  const { toggleTheme, isDark } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentRoute = activeRoute || location.pathname;
  const supabaseUser = useAuthStore((s) => s.supabaseUser);
  const isDeveloperUser = supabaseUser?.user_metadata?.role === 'developer'
    || supabaseUser?.user_metadata?.propxchain_pending_developer_org != null;
  const isBuilderContext = isDeveloperUser || currentRoute.startsWith('/builder');
  const dashboardRoute = isBuilderContext ? '/builder' : '/dashboard';

  const isActive = (route: string): boolean => {
    if (route === '/dashboard' || route === '/builder') {
      return currentRoute === route || currentRoute === '/';
    }
    return currentRoute === route || currentRoute.startsWith(route + '/');
  };

  const handleLogout = async (): Promise<void> => {
    await useAuthStore.getState().logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile hamburger button - visible below lg (1024px) */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="premium-sidebar-hamburger"
        aria-label="Open navigation menu"
        type="button"
      >
        <svg
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Desktop sidebar - hidden below lg (1024px) */}
      <nav className="premium-sidebar">
        <div className="premium-logo">
          <Logo variant="mark" tone={isDark ? 'onDark' : 'onLight'} to={null} className="h-9 w-auto" />
        </div>

        <RoleIndicator />

        {/* Admin sees BOTH dashboards so they can switch between consumer-side
            and builder-side for testing. Regular users see only the one that
            matches their membership. */}
        {isAdmin ? (
          <>
            <Link
              to="/dashboard"
              className={`premium-nav-item ${isActive('/dashboard') ? 'active' : ''}`}
            >
              <span className="premium-nav-icon">📊</span>
              <span className="premium-nav-label">Consumer Dashboard</span>
            </Link>
            <Link
              to="/builder"
              className={`premium-nav-item ${isActive('/builder') ? 'active' : ''}`}
            >
              <span className="premium-nav-icon">🏗️</span>
              <span className="premium-nav-label">Builder Portal</span>
            </Link>
            <Link
              to="/conveyancer"
              className={`premium-nav-item ${isActive('/conveyancer') ? 'active' : ''}`}
            >
              <span className="premium-nav-icon">⚖️</span>
              <span className="premium-nav-label">Conveyancer Portal</span>
            </Link>
          </>
        ) : (
          <Link
            to={dashboardRoute}
            className={`premium-nav-item ${isActive(dashboardRoute) ? 'active' : ''}`}
          >
            <span className="premium-nav-icon">📊</span>
            <span className="premium-nav-label">Dashboard</span>
          </Link>
        )}

        {/* Transaction Actions — consumer only OR admin (for testing). Hidden
            in builder context for regular builders. */}
        {(!isBuilderContext || isAdmin) && (
          <>
            <Link
              to="/start-transaction"
              className="premium-nav-item premium-nav-action"
            >
              <span className="premium-nav-icon">➕</span>
              <span className="premium-nav-label">Start Transaction</span>
            </Link>
            <Link
              to="/join"
              className="premium-nav-item premium-nav-action"
            >
              <span className="premium-nav-icon">🔗</span>
              <span className="premium-nav-label">Join Transaction</span>
            </Link>
          </>
        )}

        <div className="premium-nav-divider" />

        <Link
          to="/profile-setup"
          className={`premium-nav-item ${isActive('/profile-setup') ? 'active' : ''}`}
        >
          <span className="premium-nav-icon">👤</span>
          <span className="premium-nav-label">Profile</span>
        </Link>
        <Link
          to="/messages"
          className={`premium-nav-item ${isActive('/messages') ? 'active' : ''}`}
        >
          <span className="premium-nav-icon">💬</span>
          <span className="premium-nav-label">Messages</span>
        </Link>
        <Link
          to="/dashboard/analytics"
          className={`premium-nav-item ${isActive('/dashboard/analytics') ? 'active' : ''}`}
        >
          <span className="premium-nav-icon">📈</span>
          <span className="premium-nav-label">Analytics</span>
        </Link>
        <Link
          to="/dashboard/bot-agents"
          className={`premium-nav-item ${isActive('/dashboard/bot-agents') ? 'active' : ''}`}
        >
          <span className="premium-nav-icon">🤖</span>
          <span className="premium-nav-label">AI Agents</span>
        </Link>
        <Link
          to="/dashboard/my-documents"
          className={`premium-nav-item ${isActive('/dashboard/my-documents') ? 'active' : ''}`}
        >
          <span className="premium-nav-icon">👛</span>
          <span className="premium-nav-label">Wallet</span>
        </Link>
        <Link
          to="/dashboard/my-logbooks"
          className={`premium-nav-item ${isActive('/dashboard/my-logbooks') ? 'active' : ''}`}
        >
          <span className="premium-nav-icon">📘</span>
          <span className="premium-nav-label">Property logbook</span>
        </Link>

        {/* Conveyancer Portal - Only visible for conveyancer users */}
        {(() => {
          try {
            const cachedProfile = localStorage.getItem('userProfile');
            if (cachedProfile) {
              const profile = safeJsonParse<{ userType?: string | Record<string, unknown> }>(cachedProfile, {});
              const userType = typeof profile.userType === 'object'
                ? Object.keys(profile.userType)[0] || ''
                : String(profile.userType || '');
              if (userType.toLowerCase().includes('conveyancer')) {
                return (
                  <>
                    <Link
                      to="/conveyancer"
                      className={`premium-nav-item ${isActive('/conveyancer') ? 'active' : ''}`}
                    >
                      <span className="premium-nav-icon">&#9878;</span>
                      <span className="premium-nav-label">Conveyancer Portal</span>
                    </Link>
                    {onAddTransaction && (
                      <button
                        type="button"
                        className="premium-nav-item premium-nav-action"
                        onClick={onAddTransaction}
                      >
                        <span className="premium-nav-icon">&#10133;</span>
                        <span className="premium-nav-label">Add Transaction</span>
                      </button>
                    )}
                  </>
                );
              }
            }
          } catch { /* ignore parse errors */ }
          return null;
        })()}

        {/* Admin Dashboard - Only visible for admin users */}
        {isAdmin && (
          <>
            <div className="premium-nav-divider" />
            <Link
              to="/admin"
              className={`premium-nav-item premium-nav-admin ${isActive('/admin') ? 'active' : ''}`}
            >
              <span className="premium-nav-icon">🛡️</span>
              <span className="premium-nav-label">Admin Dashboard</span>
            </Link>
          </>
        )}

        <div className="premium-nav-spacer" />

        {/* Theme Toggle */}
        <div className="premium-nav-item premium-nav-theme" onClick={toggleTheme}>
          <span onClick={(e) => e.stopPropagation()}>
            <ThemeToggle size="sm" />
          </span>
          <span className="premium-nav-label">Theme</span>
        </div>

        <button type="button" className="premium-nav-item premium-nav-logout" onClick={handleLogout}>
          <span className="premium-nav-icon">🚪</span>
          <span className="premium-nav-label">Logout</span>
        </button>
      </nav>

      {/* Mobile offcanvas drawer */}
      <MobileNavMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        currentPage={currentRoute}
      />
    </>
  );
};

export default PremiumSidebar;
