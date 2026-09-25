import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { icpService } from '@/services/icp.service';
import type { DashboardUser } from '../../types/adminDashboard.types';
import type { AdminRecord } from './admins.types';
import { AdminGrantsTable } from './AdminGrantsTable';

type UsersView = 'all' | 'admins';

interface UsersPanelProps {
  users: DashboardUser[];
  isLoading: boolean;
  error?: string;
  csrfToken: string;
  onDeleteUser?: (principal: string, displayName: string) => void | Promise<void>;
}

export const UsersPanel: React.FC<UsersPanelProps> = ({
  users,
  isLoading,
  error,
  csrfToken,
  onDeleteUser,
}) => {
  const [view, setView] = useState<UsersView>('all');
  const [deletingPrincipal, setDeletingPrincipal] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Admin grants drive both the Admins view and the Role column cross-reference
  // in the All view. Same query key as the former AdminUsersTab so the cache and
  // promote/demote invalidations stay shared.
  const {
    data: admins = [],
    isLoading: isAdminsLoading,
    isError: isAdminsError,
    error: adminsError,
  } = useQuery<AdminRecord[]>({
    queryKey: ['listAdmins'],
    queryFn: async () => (await icpService.requireUserManagement()).listAdmins(),
  });

  // principal text -> 'super' | 'regular' for O(1) lookup per user row.
  const adminRoleByPrincipal = useMemo(() => {
    const map = new Map<string, 'super' | 'regular'>();
    admins.forEach((rec) => {
      map.set(rec.principal.toText(), 'super' in rec.role ? 'super' : 'regular');
    });
    return map;
  }, [admins]);

  const handleDelete = async (user: DashboardUser): Promise<void> => {
    if (!onDeleteUser) return;
    setDeletingPrincipal(user.principal);
    try {
      await onDeleteUser(user.principal, user.name || user.email || user.principal);
    } finally {
      setDeletingPrincipal(null);
    }
  };

  const filtered = useMemo(() => {
    if (!searchTerm) return users;
    const term = searchTerm.toLowerCase();
    return users.filter(u =>
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.principal.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach(u => {
      const role = u.userType || u.role || 'Unknown';
      counts[role] = (counts[role] || 0) + 1;
    });
    return counts;
  }, [users]);

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
      {/* All | Admins segmented control */}
      <div className="inline-flex rounded-md border p-0.5">
        <Button
          variant={view === 'all' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setView('all')}
        >
          All
        </Button>
        <Button
          variant={view === 'admins' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setView('admins')}
        >
          Admins
        </Button>
      </div>

      {view === 'admins' ? (
        <>
          {isAdminsLoading && (
            <p className="text-muted-foreground py-4">Loading admins…</p>
          )}
          {isAdminsError && !isAdminsLoading && (
            <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
              <CardContent className="p-6 text-center">
                <p className="text-red-600 dark:text-red-400">
                  Failed to load admin list:{' '}
                  {adminsError instanceof Error
                    ? adminsError.message
                    : 'Unknown error'}
                </p>
              </CardContent>
            </Card>
          )}
          {!isAdminsLoading && !isAdminsError && (
            <AdminGrantsTable admins={admins} csrfToken={csrfToken} />
          )}
        </>
      ) : (
        <>
          {/* Role Summary */}
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline">Total: {users.length}</Badge>
            {Object.entries(roleCounts).map(([role, count]) => (
              <Badge key={role} variant="secondary">{role}: {count}</Badge>
            ))}
          </div>

          {/* Search */}
          <Input
            placeholder="Search by name, email, or principal..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />

          {/* Table */}
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No users found
              </CardContent>
            </Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Principal</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>Auth</TableHead>
                  <TableHead>Created</TableHead>
                  {onDeleteUser && <TableHead className="w-24">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(user => {
                  const adminRole = adminRoleByPrincipal.get(user.principal);
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono text-xs max-w-[120px] truncate" title={user.principal}>
                        {user.principal.length > 16
                          ? `${user.principal.slice(0, 8)}...${user.principal.slice(-5)}`
                          : user.principal}
                      </TableCell>
                      <TableCell>{user.name || '—'}</TableCell>
                      <TableCell>{user.email || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.userType || user.role || '—'}</Badge>
                      </TableCell>
                      <TableCell>
                        {adminRole ? (
                          <Badge variant={adminRole === 'super' ? 'default' : 'secondary'}>
                            {adminRole}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.isVerified ? '✓' : '✗'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.authMethod === 'II' ? 'default' : user.authMethod === 'Email' ? 'secondary' : 'outline'}>
                          {user.authMethod}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                      </TableCell>
                      {onDeleteUser && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(user)}
                            disabled={deletingPrincipal === user.principal}
                            className="text-red-400 hover:text-red-300"
                          >
                            {deletingPrincipal === user.principal ? 'Deleting…' : 'Delete'}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
};
