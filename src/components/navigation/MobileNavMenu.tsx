// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  TrendingUp,
  Plus,
  LogOut,
  Shield,
  X,
  MessageCircle,
  Link2,
  Building2,
  User,
  Bot,
  Wallet,
  Scale,
  BookOpen,
} from 'lucide-react';
import { useThemeClasses } from '../../hooks/useThemeClasses';
import { ThemeToggleWithLabel } from '@/components/common/ThemeToggle';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAuthStore } from '@/stores/authStore';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { Logo } from '@/components/brand/Logo';

/** Mirror of PremiumSidebar's conveyancer gate: show the portal when the cached
 *  profile's userType is a conveyancer. Reads the same localStorage key. */
function isConveyancerUser(): boolean {
  try {
    const cachedProfile = localStorage.getItem('userProfile');
    if (!cachedProfile) return false;
    const profile = safeJsonParse<{ userType?: string | Record<string, unknown> }>(cachedProfile, {});
    const userType = typeof profile.userType === 'object'
      ? Object.keys(profile.userType)[0] || ''
      : String(profile.userType || '');
    return userType.toLowerCase().includes('conveyancer');
  } catch {
    return false;
  }
}

interface MobileNavMenuProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage?: string;
}

interface NavItem {
  label: string;
  path: string;
  id: string;
  icon: React.ElementType;
}

const MobileNavMenu: React.FC<MobileNavMenuProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const themeClasses = useThemeClasses();
  const { isAdmin } = useIsAdmin();

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleLogout = () => {
    useAuthStore.setState({
      isAuthenticated: false,
      principalId: null,
      principal: null,
      authMethod: null,
    });
    localStorage.removeItem('userRole');
    localStorage.removeItem('currentMode');
    navigate('/');
    onClose();
  };

  // Navigation items matching PremiumSidebar (kept in sync with the desktop
  // sidebar). Admin sees both dashboards (consumer + builder). Start/Join
  // Transaction already live in the bottom actions section, so don't duplicate
  // them here.
  const mainNavItems: NavItem[] = [
    ...(isAdmin
      ? [
          { label: 'Consumer Dashboard', path: '/dashboard', id: 'dashboard', icon: Home },
          { label: 'Builder Portal', path: '/builder', id: 'builder', icon: Building2 },
        ]
      : [{ label: 'Dashboard', path: '/dashboard', id: 'dashboard', icon: Home }]),
    { label: 'Profile', path: '/profile-setup', id: 'profile', icon: User },
    { label: 'Messages', path: '/messages', id: 'messages', icon: MessageCircle },
    { label: 'Analytics', path: '/dashboard/analytics', id: 'analytics', icon: TrendingUp },
    { label: 'AI Agents', path: '/dashboard/bot-agents', id: 'bot-agents', icon: Bot },
    { label: 'PropXchain Wallet', path: '/dashboard/my-documents', id: 'wallet', icon: Wallet },
    { label: 'Property logbook', path: '/dashboard/my-logbooks', id: 'logbook', icon: BookOpen },
    ...(isConveyancerUser()
      ? [{ label: 'Conveyancer Portal', path: '/conveyancer', id: 'conveyancer', icon: Scale }]
      : []),
    ...(isAdmin ? [{ label: 'Admin Dashboard', path: '/admin', id: 'admin', icon: Shield }] : []),
  ];

  const isActive = (path: string) => location.pathname === path;

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.path);

    return (
      <button
        key={item.id}
        onClick={() => handleNavigate(item.path)}
        className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors min-h-[48px] flex items-center gap-3 ${
          active
            ? 'bg-primary/10 text-primary'
            : `${themeClasses.navText} hover:bg-gray-700`
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span>{item.label}</span>
      </button>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Dark overlay backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out menu */}
      <div
        className={`fixed top-0 right-0 h-full w-72 ${themeClasses.headerBg} shadow-lg z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col`}
      >
        {/* Header with close button */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Logo variant="mark" tone="onDark" to={null} className="h-9 w-auto" />
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
            aria-label="Close menu"
          >
            <X className={`w-6 h-6 ${themeClasses.headerText}`} />
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-1">
            {mainNavItems.map(renderNavItem)}
          </div>
        </nav>

        {/* Bottom section: Theme, Transaction Actions, Logout */}
        <div className="p-4 border-t border-gray-700 space-y-2">
          {/* Theme Toggle */}
          <ThemeToggleWithLabel className="w-full justify-start px-4 py-3 min-h-[48px]" />

          {/* Start Transaction */}
          <button
            onClick={() => handleNavigate('/start-transaction')}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors min-h-[48px] flex items-center gap-3 ${themeClasses.navText} hover:bg-gray-700`}
          >
            <Plus className="h-5 w-5 shrink-0" />
            <span>Start Transaction</span>
          </button>

          {/* Join Transaction */}
          <button
            onClick={() => handleNavigate('/join')}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors min-h-[48px] flex items-center gap-3 ${themeClasses.navText} hover:bg-gray-700`}
          >
            <Link2 className="h-5 w-5 shrink-0" />
            <span>Join Transaction</span>
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-start gap-3 px-4 py-3 rounded-lg font-medium text-red-500 hover:bg-red-500/10 transition-colors min-h-[48px]"
          >
            <LogOut className="h-5 w-5" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default MobileNavMenu;
