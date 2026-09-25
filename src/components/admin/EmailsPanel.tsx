import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { EmailNotification, EmailFilterType } from '../../types/adminDashboard.types';

interface EmailsPanelProps {
  notifications: EmailNotification[];
  unprocessedCount: number;
  isLoading: boolean;
  error?: string;
  onMarkProcessed: (id: number) => Promise<void>;
  onMarkAllProcessed: () => Promise<void>;
}

const FILTER_OPTIONS: { value: EmailFilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'support', label: 'Support' },
  { value: 'sales', label: 'Sales' },
  { value: 'partners', label: 'Partners' },
  { value: 'lr', label: 'LR' },
  { value: 'unprocessed', label: 'Unprocessed' },
];

export const EmailsPanel: React.FC<EmailsPanelProps> = ({
  notifications,
  unprocessedCount,
  isLoading,
  error,
  onMarkProcessed,
  onMarkAllProcessed,
}) => {
  const [filter, setFilter] = useState<EmailFilterType>('all');
  const [isProcessing, setIsProcessing] = useState(false);

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unprocessed') return notifications.filter(n => !n.isProcessed);
    return notifications.filter(n =>
      n.type.toLowerCase().includes(filter)
    );
  }, [notifications, filter]);

  const handleMarkProcessed = async (id: number): Promise<void> => {
    setIsProcessing(true);
    try { await onMarkProcessed(id); } finally { setIsProcessing(false); }
  };

  const handleMarkAll = async (): Promise<void> => {
    setIsProcessing(true);
    try { await onMarkAllProcessed(); } finally { setIsProcessing(false); }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <CardContent className="p-6 text-center">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 flex-wrap">
          {FILTER_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              variant={filter === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
              {opt.value === 'unprocessed' && unprocessedCount > 0 && (
                <Badge variant="destructive" className="ml-1 px-1.5 py-0.5 text-xs">
                  {unprocessedCount}
                </Badge>
              )}
            </Button>
          ))}
        </div>
        {unprocessedCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAll}
            disabled={isProcessing}
          >
            Mark All Processed
          </Button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No notifications found
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(n => (
              <TableRow key={n.id}>
                <TableCell className="font-mono text-xs">{n.id}</TableCell>
                <TableCell><Badge variant="outline">{n.type}</Badge></TableCell>
                <TableCell>
                  <div>{n.fromName}</div>
                  <div className="text-xs text-muted-foreground">{n.fromEmail}</div>
                </TableCell>
                <TableCell>{n.subject}</TableCell>
                <TableCell className="text-sm">{n.date ? new Date(n.date).toLocaleDateString() : '—'}</TableCell>
                <TableCell>
                  <Badge variant={n.isProcessed ? 'secondary' : 'default'}>
                    {n.isProcessed ? 'Processed' : 'New'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {!n.isProcessed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkProcessed(n.id)}
                      disabled={isProcessing}
                    >
                      Mark Read
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
