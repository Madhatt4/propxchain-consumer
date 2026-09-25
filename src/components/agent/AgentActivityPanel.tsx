/**
 * AgentActivityPanel — Real-time agent notifications + consent approval
 *
 * DROP-IN INSTRUCTIONS:
 * 1. Copy to frontend/src/components/agent/AgentActivityPanel.tsx
 * 2. Copy useAgentNotifications.ts to frontend/src/hooks/
 * 3. Add to your dashboard layout or as a slide-over panel
 *
 * Usage:
 *   <AgentActivityPanel userId={currentUser.supabaseId} />
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useAgentNotifications,
  type AgentNotification,
  type ConsentRequest,
} from '@/hooks/useAgentNotifications';
import {
  Bell,
  BellOff,
  Check,
  X,
  ShieldAlert,
  FileCheck,
  Bot,
  Clock,
  RefreshCw,
  Loader2,
} from 'lucide-react';

// ============================================================
// Sub-components
// ============================================================

const SEVERITY_STYLES: Record<string, string> = {
  info: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  warning: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  error: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
};

const EVENT_ICONS: Record<string, React.ReactNode> = {
  'skill.completed': <FileCheck className="h-4 w-4 text-green-600 dark:text-green-400" />,
  'skill.failed': <X className="h-4 w-4 text-red-600 dark:text-red-400" />,
  'skill.started': <Bot className="h-4 w-4 text-blue-700 dark:text-blue-400" />,
  'consent.required': <ShieldAlert className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />,
};

const CONSENT_TYPE_LABELS: Record<string, string> = {
  identity: 'Identity Verification',
  financial: 'Financial Action',
  legal: 'Legal Action',
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ============================================================
// Consent Card
// ============================================================

interface ConsentCardProps {
  consent: ConsentRequest;
  onApprove: (id: string) => Promise<boolean>;
  onDeny: (id: string) => Promise<boolean>;
}

const ConsentCard: React.FC<ConsentCardProps> = ({ consent, onApprove, onDeny }) => {
  const [isActing, setIsActing] = useState(false);

  const handleAction = async (action: 'approve' | 'deny'): Promise<void> => {
    setIsActing(true);
    if (action === 'approve') {
      await onApprove(consent.id);
    } else {
      await onDeny(consent.id);
    }
    setIsActing(false);
  };

  const expiresIn = Math.max(
    0,
    Math.floor((new Date(consent.expiresAt).getTime() - Date.now()) / 3600000),
  );

  return (
    <Card className="border-yellow-700/50 bg-yellow-900/10">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {CONSENT_TYPE_LABELS[consent.consentType] ?? consent.consentType}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Skill: {consent.skillId}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-yellow-600 text-yellow-600 dark:text-yellow-400 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {expiresIn}h left
          </Badge>
        </div>

        <p className="text-sm text-gray-700 dark:text-gray-300">
          Transaction: <span className="font-mono text-xs">{consent.transactionId}</span>
        </p>

        {consent.context && (
          <div className="bg-white dark:bg-gray-800/50 rounded p-2 text-xs text-gray-600 dark:text-gray-400">
            {Object.entries(consent.context)
              .filter(([key]) => key !== 'executionId')
              .map(([key, value]) => (
                <div key={key}>
                  <span className="text-gray-500 dark:text-gray-400">{key}:</span> {String(value)}
                </div>
              ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            disabled={isActing}
            onClick={() => void handleAction('approve')}
          >
            {isActing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <><Check className="h-4 w-4 mr-1" /> Approve</>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            disabled={isActing}
            onClick={() => void handleAction('deny')}
          >
            <X className="h-4 w-4 mr-1" /> Deny
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================
// Notification Row
// ============================================================

interface NotificationRowProps {
  notification: AgentNotification;
  onMarkRead: (id: string) => Promise<void>;
}

const NotificationRow: React.FC<NotificationRowProps> = ({ notification, onMarkRead }) => {
  const event = notification.event;
  if (!event) return null;

  const severity = event.severity ?? 'info';
  const icon = EVENT_ICONS[event.eventType] ?? <Bot className="h-4 w-4 text-gray-600 dark:text-gray-400" />;

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
        notification.read
          ? 'bg-gray-100 dark:bg-gray-800/20 border-gray-200 dark:border-gray-700/30 opacity-60'
          : `${SEVERITY_STYLES[severity]} border`
      }`}
      onClick={() => {
        if (!notification.read) void onMarkRead(notification.id);
      }}
    >
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 dark:text-gray-100 leading-tight">{event.message}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">{event.skillId ?? 'system'}</span>
          <span className="text-xs text-gray-300 dark:text-gray-600">|</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{timeAgo(event.createdAt)}</span>
        </div>
      </div>
      {!notification.read && (
        <div className="h-2 w-2 rounded-full bg-blue-400 mt-2 shrink-0" />
      )}
    </div>
  );
};

// ============================================================
// Main Panel
// ============================================================

interface AgentActivityPanelProps {
  userId: string | null;
  className?: string;
}

const AgentActivityPanel: React.FC<AgentActivityPanelProps> = ({ userId, className }) => {
  const {
    notifications,
    pendingConsents,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    approveConsent,
    denyConsent,
    refresh,
  } = useAgentNotifications(userId);

  if (!userId) {
    return null;
  }

  return (
    <Card className={className ?? ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-5 w-5" />
            Agent Activity
            {unreadCount > 0 && (
              <Badge className="bg-blue-600 text-white text-xs px-1.5 py-0">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            {notifications.some((n) => !n.read) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs h-7 px-2"
                onClick={() => void markAllAsRead()}
              >
                <BellOff className="h-3 w-3 mr-1" /> Read all
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 h-7 w-7 p-0"
              onClick={() => void refresh()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">{error}</p>
        )}

        {/* Pending consent requests — always on top */}
        {pendingConsents.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">
              Requires Your Approval ({pendingConsents.length})
            </p>
            {pendingConsents.map((consent) => (
              <ConsentCard
                key={consent.id}
                consent={consent}
                onApprove={approveConsent}
                onDeny={denyConsent}
              />
            ))}
          </div>
        )}

        {/* Notification feed */}
        <div className="space-y-1">
          {notifications.length > 0 && (
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Recent Activity
            </p>
          )}
          <ScrollArea className="max-h-80">
            <div className="space-y-1.5">
              {isLoading && notifications.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading...
                </div>
              ) : notifications.length === 0 && pendingConsents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                  <Bell className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No agent activity yet</p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                    Connect a bot to get started
                  </p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onMarkRead={markAsRead}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentActivityPanel;
