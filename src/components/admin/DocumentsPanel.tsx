import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type {
  StorageStats, VerificationStats, ExpiredLRDocument, AuditLogEntry,
} from '../../types/adminDashboard.types';

interface DocumentsPanelProps {
  storageStats: StorageStats | null;
  verificationStats: VerificationStats | null;
  expiredDocuments: ExpiredLRDocument[];
  auditLogs: AuditLogEntry[];
  isLoading: boolean;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const DocumentsPanel: React.FC<DocumentsPanelProps> = ({
  storageStats,
  verificationStats,
  expiredDocuments,
  auditLogs,
  isLoading,
  error,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
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

  const verTotal = verificationStats
    ? verificationStats.verified + verificationStats.pending + verificationStats.failed
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><h3 className="text-sm text-muted-foreground">Storage</h3></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{storageStats?.totalDocuments ?? 0}</p>
            <p className="text-sm text-muted-foreground">
              documents · {storageStats ? formatBytes(storageStats.totalStorageBytes) : '0 B'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><h3 className="text-sm text-muted-foreground">Verification</h3></CardHeader>
          <CardContent>
            {verificationStats ? (
              <div className="space-y-2">
                <div className="flex gap-4 text-sm">
                  <span className="text-green-600">✓ {verificationStats.verified}</span>
                  <span className="text-amber-600">⏳ {verificationStats.pending}</span>
                  <span className="text-red-600">✗ {verificationStats.failed}</span>
                </div>
                {verTotal > 0 && (
                  <div className="flex h-2 rounded overflow-hidden bg-muted">
                    <div className="bg-green-500" style={{ width: `${(verificationStats.verified / verTotal) * 100}%` }} />
                    <div className="bg-amber-500" style={{ width: `${(verificationStats.pending / verTotal) * 100}%` }} />
                    <div className="bg-red-500" style={{ width: `${(verificationStats.failed / verTotal) * 100}%` }} />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Unavailable</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expired LR Documents */}
      <Card>
        <CardHeader className="pb-2">
          <h3 className="font-medium">Expired LR Documents ({expiredDocuments.length})</h3>
        </CardHeader>
        <CardContent>
          {expiredDocuments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expired documents</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document ID</TableHead>
                  <TableHead>Title Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Expiry</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiredDocuments.map(doc => (
                  <TableRow key={doc.documentId}>
                    <TableCell className="font-mono text-xs">{doc.documentId}</TableCell>
                    <TableCell>{doc.titleNumber}</TableCell>
                    <TableCell>{doc.type}</TableCell>
                    <TableCell className="text-red-500">{new Date(doc.expiryDate).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Card>
        <CardHeader className="pb-2">
          <h3 className="font-medium">Recent Audit Log</h3>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit log entries</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Document</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[100px] truncate">{log.actor}</TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell className="font-mono text-xs">{log.documentId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
