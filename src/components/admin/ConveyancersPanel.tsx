// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '../../lib/supabase';
import { logger } from '@/utils/logger';

interface PendingConveyancer {
  id: string;
  practice_name: string;
  clc_id: string;
  email: string | null;
  postcode: string | null;
  business_type: string | null;
  address: string | null;
  signup_email: string | null;
  signup_at: string | null;
  /** Server-derived: the clc_id exists in our snapshot of the CLC register. */
  clc_verified: boolean;
  /**
   * What the applicant asserted at signup. Client-controlled and therefore
   * never evidence of anything — shown only so an admin can spot an applicant
   * claiming a verification the register does not support.
   */
  clc_verified_claimed_by_applicant: boolean;
  /** Practice name as it appears in the register, for eyeballing against the claim. */
  register_practice_name: string | null;
  /** Server-derived: signup email domain matches the registered practice domain. */
  email_domain_matches_register: boolean;
  created_at: string;
}

const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return '—'; }
};

export const ConveyancersPanel: React.FC = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<PendingConveyancer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    const { data, error: rpcError } = await supabase
      .rpc('admin_list_pending_conveyancers');
    if (rpcError) {
      logger.error('admin_list_pending_conveyancers failed', rpcError);
      setError(rpcError.message || 'Failed to load pending conveyancers');
      setRows([]);
    } else {
      setRows((data ?? []) as PendingConveyancer[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleApprove = async (row: PendingConveyancer): Promise<void> => {
    // Approval is the only route onto the active panel, so surface the
    // server-derived signals here rather than relying on the admin having read
    // the table. Anything the applicant asserted about themselves is excluded.
    const warnings: string[] = [];
    if (!row.clc_verified) {
      warnings.push(`• CLC ${row.clc_id} is NOT in our register snapshot.`);
    }
    if (!row.email_domain_matches_register) {
      warnings.push(
        `• Signup email (${row.signup_email ?? 'unknown'}) does not share a domain with the registered practice.`,
      );
    }
    if (row.clc_verified_claimed_by_applicant && !row.clc_verified) {
      warnings.push('• Applicant claimed CLC-verified at signup, but the register does not agree.');
    }

    const preamble = `Approve ${row.practice_name} (CLC ${row.clc_id})?\n\nThis flips them onto the active panel and they can start receiving transactions.`;
    const message = warnings.length
      ? `${preamble}\n\nCheck these first:\n${warnings.join('\n')}\n\nConfirm against the live CLC register before approving.`
      : preamble;
    if (!window.confirm(message)) return;
    setBusyId(row.id);
    const { error: rpcError } = await supabase
      .rpc('admin_approve_conveyancer', { p_panel_id: row.id });
    setBusyId(null);
    if (rpcError) {
      toast({ title: 'Approve failed', description: rpcError.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Approved', description: row.practice_name });
    await load();
  };

  const handleReject = async (row: PendingConveyancer): Promise<void> => {
    if (!window.confirm(`Reject ${row.practice_name} (CLC ${row.clc_id})?\n\nThis deletes the panel application. The auth user remains — delete via Users tab if also needed.`)) return;
    setBusyId(row.id);
    const { error: rpcError } = await supabase
      .rpc('admin_reject_conveyancer', { p_panel_id: row.id });
    setBusyId(null);
    if (rpcError) {
      toast({ title: 'Reject failed', description: rpcError.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Rejected', description: row.practice_name });
    await load();
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
          <Button variant="outline" size="sm" className="mt-3" onClick={() => { setIsLoading(true); void load(); }}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pending conveyancers</h2>
          <p className="text-sm text-muted-foreground">
            Firms that signed up but couldn&apos;t auto-match the CLC snapshot. Verify against{' '}
            <a href="https://www.clc-uk.org" target="_blank" rel="noopener noreferrer" className="underline">clc-uk.org</a>{' '}
            before approving.
          </p>
        </div>
        <Badge variant={rows.length > 0 ? 'destructive' : 'secondary'}>
          {rows.length} pending
        </Badge>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No pending conveyancer applications.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Practice</TableHead>
                  <TableHead>CLC ID</TableHead>
                  <TableHead>CLC register</TableHead>
                  <TableHead>Email domain</TableHead>
                  <TableHead>Signup email</TableHead>
                  <TableHead>Signed up</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.practice_name}</div>
                      {row.postcode && <div className="text-xs text-muted-foreground">{row.postcode}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{row.clc_id}</TableCell>
                    <TableCell>
                      {row.clc_verified ? (
                        <div>
                          <Badge variant="secondary">In register</Badge>
                          {row.register_practice_name &&
                            row.register_practice_name !== row.practice_name && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                Register says: {row.register_practice_name}
                              </div>
                            )}
                        </div>
                      ) : (
                        <Badge variant="destructive">No match</Badge>
                      )}
                      {row.clc_verified_claimed_by_applicant && !row.clc_verified && (
                        <div className="mt-1 text-xs font-medium text-destructive">
                          Applicant claimed verified
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.email_domain_matches_register ? (
                        <Badge variant="secondary">Matches</Badge>
                      ) : (
                        <Badge variant="destructive">Differs</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{row.signup_email ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(row.signup_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === row.id}
                          onClick={() => handleReject(row)}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          disabled={busyId === row.id}
                          onClick={() => handleApprove(row)}
                        >
                          {busyId === row.id ? 'Working…' : 'Approve'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
