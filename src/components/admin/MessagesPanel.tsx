import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { MessageStats, DashboardThread } from '../../types/adminDashboard.types';

interface MessagesPanelProps {
  stats: MessageStats | null;
  threads: DashboardThread[];
  unreadCount: number;
  isLoading: boolean;
  error?: string;
}

function truncateId(id: string): string {
  return id.length > 12 ? id.substring(0, 8) + '...' : id;
}

export const MessagesPanel: React.FC<MessagesPanelProps> = ({
  stats,
  threads,
  unreadCount,
  isLoading,
  error,
}) => {
  const sortedThreads = [...threads].sort((a, b) => b.lastMessageAt - a.lastMessageAt);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
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
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><h3 className="text-sm text-muted-foreground">Total Threads</h3></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats?.threadCount ?? '—'}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><h3 className="text-sm text-muted-foreground">Total Messages</h3></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats?.messageCount ?? '—'}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><h3 className="text-sm text-muted-foreground">Your Unread</h3></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{unreadCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Thread List */}
      {sortedThreads.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No message threads found
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Transaction</TableHead>
              <TableHead>Participants</TableHead>
              <TableHead>Messages</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead>Unread</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedThreads.map(t => (
              <TableRow key={t.id}>
                <TableCell>{t.subject}</TableCell>
                <TableCell className="font-mono text-xs">{truncateId(t.transactionId)}</TableCell>
                <TableCell>{t.participantCount}</TableCell>
                <TableCell>{t.messageCount}</TableCell>
                <TableCell className="text-sm">
                  {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleDateString() : '—'}
                </TableCell>
                <TableCell>
                  {t.unreadCount > 0 ? (
                    <Badge variant="destructive" className="px-1.5 py-0.5 text-xs">
                      {t.unreadCount}
                    </Badge>
                  ) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
