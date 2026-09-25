import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type {
  LRCredentialStatus, LRApiHealth, LRRateLimit, LRPendingApplication, LRRequisition, LRExpiringSearch,
} from '../../types/adminDashboard.types';

interface LandRegistryPanelProps {
  credentialStatus: LRCredentialStatus | null;
  apiHealth: LRApiHealth | null;
  rateLimits: LRRateLimit[];
  pendingApplications: LRPendingApplication[];
  requisitions: LRRequisition[];
  expiringSearches: LRExpiringSearch[];
  isLoading: boolean;
  error?: string;
}

const LR_URL_KEY = 'propxchain_lr_api_url';

export const LandRegistryPanel: React.FC<LandRegistryPanelProps> = ({
  credentialStatus,
  apiHealth,
  rateLimits,
  pendingApplications,
  requisitions,
  expiringSearches,
  isLoading,
  error,
}) => {
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem(LR_URL_KEY) || '');

  const handleSaveUrl = (): void => {
    localStorage.setItem(LR_URL_KEY, apiUrl);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
        ))}
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
    <div className="space-y-6">
      {/* Credential Status Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Credential Status</h3>
            <Badge variant={
              credentialStatus?.status === 'active' ? 'default'
                : credentialStatus?.status === 'expired' ? 'destructive'
                : 'secondary'
            }>
              {credentialStatus?.status
                ? credentialStatus.status.charAt(0).toUpperCase() + credentialStatus.status.slice(1)
                : apiHealth?.isConfigured ? 'Active (inferred)' : 'Not Configured'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Last checked: {credentialStatus?.lastChecked
              ? new Date(credentialStatus.lastChecked).toLocaleString()
              : apiHealth?.lastValidated
                ? new Date(apiHealth.lastValidated).toLocaleString()
                : 'Never'}
          </p>
        </CardContent>
      </Card>

      {/* API URL Config */}
      <Card>
        <CardHeader className="pb-2">
          <h3 className="font-medium">HMLR Business Gateway URL</h3>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={apiUrl}
            onChange={e => setApiUrl(e.target.value)}
            placeholder="https://bgtest.landregistry.gov.uk/..."
            className="font-mono text-sm"
          />
          <Button onClick={handleSaveUrl} variant="outline" size="sm">Save</Button>
        </CardContent>
      </Card>

      {/* API Health */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">API Health</h3>
            <Badge variant={apiHealth?.isConfigured ? 'default' : 'secondary'}>
              {apiHealth?.isConfigured ? apiHealth.environment : 'Not Configured'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {apiHealth?.isConfigured ? (
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Endpoint:</span> {apiHealth.endpoint}</p>
              <p><span className="text-muted-foreground">Last validated:</span> {apiHealth.lastValidated ? new Date(apiHealth.lastValidated).toLocaleString() : 'Never'}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No Land Registry API credentials configured in canister.</p>
          )}
        </CardContent>
      </Card>

      {/* Rate Limits Table */}
      {rateLimits.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-medium">Rate Limits</h3>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  {/* Calls made, not remaining: the caps are private to the
                      canister, so a "remaining" figure would be a guess. */}
                  <TableHead>Calls today</TableHead>
                  <TableHead>This hour</TableHead>
                  <TableHead>Resets</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rateLimits.map((rl, i) => (
                  <TableRow key={i}>
                    <TableCell>{rl.endpoint}</TableCell>
                    <TableCell>{rl.callsToday}</TableCell>
                    <TableCell>{rl.callsThisHour}</TableCell>
                    <TableCell>{rl.resetTime ? new Date(rl.resetTime).toLocaleString() : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pending Applications */}
      <Card>
        <CardHeader className="pb-2">
          <h3 className="font-medium">Pending Applications ({pendingApplications.length})</h3>
        </CardHeader>
        <CardContent>
          {pendingApplications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending applications</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Title Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApplications.map(app => (
                  <TableRow key={app.transactionId}>
                    <TableCell className="font-mono text-xs">{app.transactionId}</TableCell>
                    <TableCell>{app.titleNumber}</TableCell>
                    <TableCell><Badge variant="outline">{app.status}</Badge></TableCell>
                    <TableCell>{app.submittedDate ? new Date(app.submittedDate).toLocaleDateString() : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Outstanding Requisitions */}
      {requisitions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-medium">Outstanding Requisitions ({requisitions.length})</h3>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Deadline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requisitions.map((req, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{req.transactionId}</TableCell>
                    <TableCell>{req.field}</TableCell>
                    <TableCell>
                      <Badge variant={req.severity === 'high' ? 'destructive' : 'outline'}>
                        {req.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{req.description}</TableCell>
                    <TableCell className={cn(
                      req.deadline && new Date(req.deadline) < new Date() && 'text-red-500 font-medium'
                    )}>
                      {req.deadline ? new Date(req.deadline).toLocaleDateString() : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Expiring Searches */}
      <Card>
        <CardHeader className="pb-2">
          <h3 className="font-medium">Expiring Searches ({expiringSearches.length})</h3>
        </CardHeader>
        <CardContent>
          {expiringSearches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expiring searches</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Search Type</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Days Left</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiringSearches.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{s.transactionId}</TableCell>
                    <TableCell>{s.searchType}</TableCell>
                    <TableCell>{new Date(s.expiryDate).toLocaleDateString()}</TableCell>
                    <TableCell className={cn(
                      s.daysRemaining < 7 && 'text-red-500 font-medium'
                    )}>
                      {s.daysRemaining}d
                    </TableCell>
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
