/**
 * PropXchain - Role Indicator
 * Shows the active role/org context for developer and admin users.
 * Hidden for single-role consumer users (buyer/seller).
 */

import React from 'react';
import { useAuthStore } from '@/stores/authStore';

interface RoleDisplayInfo {
  name: string;
  context: string;
}

const CONSUMER_ROLES = new Set(['buyer', 'seller']);

function getRoleDisplayInfo(
  role: string | undefined,
  userName: string | undefined,
  orgName: string | undefined
): RoleDisplayInfo | null {
  if (!role || CONSUMER_ROLES.has(role)) {
    return null;
  }

  const displayName = userName || 'User';
  const context = role === 'developer' && orgName
    ? orgName
    : role;

  return { name: displayName, context };
}

function RoleIndicator(): React.ReactElement | null {
  const supabaseUser = useAuthStore((state) => state.supabaseUser);

  const metadata = supabaseUser?.user_metadata;
  const role = metadata?.role as string | undefined;
  const userName = metadata?.name as string | undefined;
  const orgName = metadata?.org_name as string | undefined;

  const displayInfo = getRoleDisplayInfo(role, userName, orgName);

  if (!displayInfo) {
    return null;
  }

  return (
    <div className="mx-3 mb-2 rounded-lg border border-teal-700/30 bg-teal-900/20 px-3 py-2">
      <p className="text-[0.65rem] font-medium uppercase tracking-wider text-teal-400/70">
        Acting as
      </p>
      <p
        className="mt-0.5 truncate font-['DM_Sans'] text-sm font-medium text-slate-200"
        title={`${displayInfo.name} — ${displayInfo.context}`}
      >
        {displayInfo.name}
        <span className="ml-1 font-normal text-slate-400">
          — {displayInfo.context}
        </span>
      </p>
    </div>
  );
}

export default RoleIndicator;
