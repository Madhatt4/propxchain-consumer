/**
 * PropXchain - Application top bar
 *
 * The single piece of signed-in chrome, shared by the dashboard and every page
 * inside a transaction. Replaces the 260px PremiumSidebar on those views so
 * navigation lives in one place instead of two.
 *
 * Three columns on desktop (title / brand / actions); on mobile the brand and a
 * reduced action set share one row and the title block drops beneath it. Pages
 * supply only their own identity — `title`, `subtitle` and an optional `backTo`
 * — while the bar derives the signed-in user and handles logout itself, so no
 * page has to re-assemble them.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Bot,
  LifeBuoy,
  LogOut,
  MessageSquare,
  Moon,
  Sun,
  User,
  Wallet,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/stores/authStore';

interface AppTopBarProps {
  /** Page identity, left cell. The property address inside a transaction. */
  title: string;
  /** Mono micro-label beneath the title — postcode, page name, or a welcome line. */
  subtitle?: string;
  /** Renders a back control before the title. Omit on top-level pages. */
  backTo?: string;
  /** Back as an in-page action rather than a route. Ignored when `backTo` is set. */
  onBack?: () => void;
  backLabel?: string;
  /** Overrides the derived name where a page already holds a better one. */
  displayNameOverride?: string;
  /**
   * Adds the admin portal links to the avatar menu. Passed in rather than
   * resolved here so the bar stays free of react-query, and every page that
   * renders it doesn't need a QueryClientProvider to mount.
   */
  isAdmin?: boolean;
  /**
   * Extra avatar-menu entries for pages whose audience isn't the consumer —
   * the builder and conveyancer portals, whose only route in used to be the
   * sidebar. Without these, replacing the sidebar strands those users.
   */
  menuItems?: Array<{ label: string; to: string }>;
}

/** Portal target for page-owned icon buttons in the bar's action row. */
export const TOPBAR_ACTION_SLOT_ID = 'app-topbar-actions';

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase() || 'U';
};

/** Shared so controls portalled into the action slot match the bar's own buttons. */
export const ICON_BUTTON =
  'flex h-11 w-11 items-center justify-center rounded-lg border-none bg-transparent text-[var(--text-muted)] transition-colors duration-200 ease-out hover:bg-[var(--bg-section)] hover:text-[var(--text-main)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600';

/** Text-and-arrow above the title on mobile, a 44px icon button beside it on desktop. */
const BACK_CONTROL =
  'flex shrink-0 items-center gap-1.5 self-start rounded-lg border-none bg-transparent p-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] transition-colors duration-200 ease-out hover:bg-[var(--bg-section)] hover:text-[var(--text-main)] -ml-2 sm:h-11 sm:w-11 sm:justify-center sm:self-auto sm:p-0';

const MENU_ITEM =
  'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[var(--text-secondary)] transition-colors duration-150 ease-out hover:bg-[var(--bg-section)] hover:text-[var(--text-main)]';

/** Admin-only shortcuts into each role portal, in menu order. */
const ADMIN_PORTAL_LINKS: ReadonlyArray<{ label: string; to: string }> = [
  { label: 'Admin dashboard', to: '/admin' },
  { label: 'Builder portal', to: '/builder' },
  { label: 'Conveyancer portal', to: '/conveyancer' },
  { label: 'Estate agent portal', to: '/estate-agent' },
];

export const AppTopBar: React.FC<AppTopBarProps> = ({
  title,
  subtitle,
  backTo,
  onBack,
  backLabel = 'Back',
  displayNameOverride,
  isAdmin = false,
  menuItems,
}) => {
  const navigate = useNavigate();
  const { toggleTheme, isDark } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const supabaseUser = useAuthStore((s) => s.supabaseUser);
  const storeProfile = useAuthStore((s) => s.userProfile);
  const principalId = useAuthStore((s) => s.principalId);

  const displayName = displayNameOverride
    || storeProfile?.name
    || supabaseUser?.user_metadata?.name
    || supabaseUser?.email?.split('@')[0]
    || 'User';
  const initials = getInitials(displayName);

  const onLogout = async (): Promise<void> => {
    await useAuthStore.getState().logout();
    navigate('/login');
  };

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const handlePointerDown = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const navItems: Array<{ label: string; to: string; icon: React.ReactNode }> = [
    { label: 'Profile', to: '/profile-setup', icon: <User size={18} strokeWidth={2} /> },
    { label: 'Messages', to: '/messages', icon: <MessageSquare size={18} strokeWidth={2} /> },
    { label: 'AI Agents', to: '/dashboard/bot-agents', icon: <Bot size={18} strokeWidth={2} /> },
    { label: 'PropXchain Wallet', to: '/dashboard/my-documents', icon: <Wallet size={18} strokeWidth={2} /> },
    { label: 'Property logbook', to: '/dashboard/my-logbooks', icon: <BookOpen size={18} strokeWidth={2} /> },
    { label: 'Help & Support', to: '/dashboard/support', icon: <LifeBuoy size={18} strokeWidth={2} /> },
  ];

  const avatar = (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-section)] text-[13px] font-semibold text-[var(--text-secondary)]">
      {initials}
    </div>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-color)] bg-[var(--bg-card)]">
      {/* One grid, not two layouts: the title cell drops to its own row below
          640px and sits left of the brand above it, so every element — the
          heading, the back link — exists exactly once in the DOM. */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 px-4 py-2.5 sm:grid-cols-[1fr_auto_1fr] sm:px-8 sm:py-3">
        {/* Page identity. Mobile: row 2, full width. Desktop: first cell. */}
        <div className="col-span-2 col-start-1 row-start-2 flex min-w-0 flex-col gap-1 pb-4 pt-5 sm:col-span-1 sm:row-start-1 sm:flex-row sm:items-center sm:gap-2 sm:py-0">
          {backTo ? (
            <Link to={backTo} className={BACK_CONTROL} title={backLabel} aria-label={backLabel}>
              <ArrowLeft size={18} strokeWidth={2} className="h-3 w-3 sm:h-[18px] sm:w-[18px]" />
              <span className="sm:hidden">{backLabel}</span>
            </Link>
          ) : onBack ? (
            <button type="button" onClick={onBack} className={BACK_CONTROL} title={backLabel} aria-label={backLabel}>
              <ArrowLeft size={18} strokeWidth={2} className="h-3 w-3 sm:h-[18px] sm:w-[18px]" />
              <span className="sm:hidden">{backLabel}</span>
            </button>
          ) : null}
          <div className="flex min-w-0 flex-col gap-px">
            <h1 className="m-0 truncate text-[26px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--text-main)] sm:text-[22px] sm:leading-[1.15]">
              {title}
            </h1>
            {subtitle && (
              <span className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {subtitle}
              </span>
            )}
          </div>
        </div>

        <div className="col-start-1 row-start-1 flex items-center gap-2 sm:col-start-2 sm:justify-self-center">
          <Logo variant="mark" tone={isDark ? 'onDark' : 'onLight'} to={null} className="h-[34px] w-auto sm:h-[38px]" />
        </div>

        <div className="col-start-2 row-start-1 flex items-center gap-0.5 justify-self-end sm:col-start-3">
          {/* Slot for page-owned icon buttons, so a page can put a control in
              the bar without the bar having to know what it is. The flow
              page's next-step lightbulb lands here. */}
          <div id={TOPBAR_ACTION_SLOT_ID} className="flex items-center gap-0.5" />

          {/* Mobile keeps a single notification affordance; the rest live in the avatar menu. */}
          <button
            type="button"
            className={`${ICON_BUTTON} sm:hidden`}
            title="Notifications"
            aria-label="Notifications"
            onClick={() => navigate('/messages')}
          >
            <Bell size={18} strokeWidth={2} />
          </button>

          {navItems.map((item) => (
            <button
              key={item.to}
              type="button"
              className={`${ICON_BUTTON} hidden sm:flex`}
              title={item.label}
              aria-label={item.label}
              onClick={() => navigate(item.to)}
            >
              {item.icon}
            </button>
          ))}

          <button
            type="button"
            className={`${ICON_BUTTON} hidden sm:flex`}
            title="Theme"
            aria-label="Toggle theme"
            onClick={toggleTheme}
          >
            {isDark ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
          </button>

          <span className="mx-1.5 hidden h-6 w-px bg-[var(--border-light)] sm:block" />

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-lg border-none bg-transparent"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              aria-label="Profile menu"
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              {avatar}
            </button>

            {isMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  {avatar}
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-[var(--text-main)]">{displayName}</span>
                    <span className="truncate font-mono text-[11px] text-[var(--text-muted)]">
                      {principalId ? `${principalId.slice(0, 12)}…` : 'Not connected'}
                    </span>
                  </div>
                </div>

                <div className="h-px bg-[var(--border-light)]" />

                {/* Mobile-only: the icon row above collapses into the menu. */}
                <div className="sm:hidden">
                  {navItems.map((item) => (
                    <button
                      key={item.to}
                      type="button"
                      role="menuitem"
                      className={MENU_ITEM}
                      onClick={() => {
                        setIsMenuOpen(false);
                        navigate(item.to);
                      }}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    role="menuitem"
                    className={MENU_ITEM}
                    onClick={() => {
                      setIsMenuOpen(false);
                      toggleTheme();
                    }}
                  >
                    {isDark ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
                    <span>Theme</span>
                  </button>
                  <div className="h-px bg-[var(--border-light)]" />
                </div>

                {menuItems && menuItems.length > 0 && (
                  <>
                    {menuItems.map((item) => (
                      <button
                        key={item.to}
                        type="button"
                        role="menuitem"
                        className={MENU_ITEM}
                        onClick={() => {
                          setIsMenuOpen(false);
                          navigate(item.to);
                        }}
                      >
                        <span>{item.label}</span>
                      </button>
                    ))}
                    <div className="h-px bg-[var(--border-light)]" />
                  </>
                )}

                {isAdmin && (
                  <>
                    {ADMIN_PORTAL_LINKS.map((item) => (
                      <button
                        key={item.to}
                        type="button"
                        role="menuitem"
                        className={MENU_ITEM}
                        onClick={() => {
                          setIsMenuOpen(false);
                          navigate(item.to);
                        }}
                      >
                        <span>{item.label}</span>
                      </button>
                    ))}
                    <div className="h-px bg-[var(--border-light)]" />
                  </>
                )}

                <button
                  type="button"
                  role="menuitem"
                  className={`${MENU_ITEM} text-red-600 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400`}
                  onClick={() => {
                    setIsMenuOpen(false);
                    onLogout();
                  }}
                >
                  <LogOut size={18} strokeWidth={2} />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className={`${ICON_BUTTON} hidden sm:flex`}
            title="Log out"
            aria-label="Log out"
            onClick={onLogout}
          >
            <LogOut size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

    </header>
  );
};

export default AppTopBar;
