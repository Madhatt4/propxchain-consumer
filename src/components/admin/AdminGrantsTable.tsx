// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Principal } from '@propxchain/core-client';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { icpService } from '@/services/icp.service';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { PromoteAdminDialog } from './PromoteAdminDialog';
import type { AdminRecord } from './admins.types';

interface AdminGrantsTableProps {
  admins: AdminRecord[];
  csrfToken: string;
}

/**
 * Granted-admins surface (principal · role · granted by · granted at · note)
 * with super-only promote/demote controls. Relocated from the former
 * AdminUsersTab so the Users tab's "Admins" filter owns role management.
 */
export function AdminGrantsTable({
  admins,
  csrfToken,
}: AdminGrantsTableProps): JSX.Element {
  const { role } = useIsAdmin();
  const isSuper = role === 'super';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const demoteMutation = useMutation({
    mutationFn: async (principal: Principal) => {
      const result = await (await icpService.requireUserManagement()).demoteAdmin(
        principal,
        csrfToken,
      );
      if ('err' in result) {
        throw new Error(Object.keys(result.err)[0]);
      }
      return result;
    },
    onSuccess: async () => {
      toast({ title: 'Admin demoted' });
      await queryClient.invalidateQueries({ queryKey: ['listAdmins'] });
    },
    onError: (err: Error) => {
      toast({
        title: 'Demote failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">
          Admin users ({admins.length})
        </h2>
        {isSuper && (
          <PromoteAdminDialog
            csrfToken={csrfToken}
            trigger={<Button>Promote new admin</Button>}
          />
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Principal</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Granted by</TableHead>
            <TableHead>Granted at</TableHead>
            <TableHead>Note</TableHead>
            {isSuper && <TableHead className="w-24">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {admins.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={isSuper ? 6 : 5}
                className="text-center text-muted-foreground py-6"
              >
                No admins
              </TableCell>
            </TableRow>
          )}
          {admins.map((rec) => {
            const principalText = rec.principal.toText();
            const roleText = 'super' in rec.role ? 'super' : 'regular';
            const grantedAt = new Date(Number(rec.grantedAt / 1_000_000n));
            const noteText = rec.note.length > 0 ? rec.note[0] : '—';
            return (
              <TableRow key={principalText}>
                <TableCell className="font-mono text-xs break-all">
                  {principalText}
                </TableCell>
                <TableCell>
                  <span
                    className={
                      roleText === 'super' ? 'font-semibold' : undefined
                    }
                  >
                    {roleText}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs break-all">
                  {rec.grantedBy.toText()}
                </TableCell>
                <TableCell className="text-sm">
                  {grantedAt.toLocaleString()}
                </TableCell>
                <TableCell className="text-sm">{noteText}</TableCell>
                {isSuper && (
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => demoteMutation.mutate(rec.principal)}
                      disabled={demoteMutation.isPending}
                    >
                      Demote
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
