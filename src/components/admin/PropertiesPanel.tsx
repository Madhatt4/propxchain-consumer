import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { DashboardProperty, PropertyStatusString } from '../../types/adminDashboard.types';

interface PropertiesPanelProps {
  properties: DashboardProperty[];
  isLoading: boolean;
  error?: string;
}

type PropertyFilterStatus = 'all' | PropertyStatusString;

const STATUS_BADGE_VARIANT: Record<PropertyStatusString, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Listed: 'secondary',
  InTransaction: 'default',
  Completed: 'outline',
  Cancelled: 'destructive',
};

const STATUS_LABELS: { value: PropertyFilterStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'Listed', label: 'Listed' },
  { value: 'InTransaction', label: 'In Transaction' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
];

function formatPrice(price: number): string {
  return `£${price.toLocaleString()}`;
}

function truncatePrincipal(principal: string): string {
  return principal.length > 12 ? principal.substring(0, 8) + '...' : principal;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  properties,
  isLoading,
  error,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PropertyFilterStatus>('all');

  const stats = useMemo(() => ({
    total: properties.length,
    listed: properties.filter(p => p.status === 'Listed').length,
    inTransaction: properties.filter(p => p.status === 'InTransaction').length,
    attested: properties.filter(p => p.attestedBy).length,
  }), [properties]);

  const filtered = useMemo(() => {
    return properties.filter(p => {
      const matchesSearch = !searchTerm ||
        p.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.owner.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [properties, searchTerm, statusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><h3 className="text-sm text-muted-foreground">Total Properties</h3></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.total}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><h3 className="text-sm text-muted-foreground">Listed</h3></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.listed}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><h3 className="text-sm text-muted-foreground">In Transaction</h3></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.inTransaction}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><h3 className="text-sm text-muted-foreground">Attested</h3></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.attested}</p></CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Search by address or owner..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex gap-1 flex-wrap">
          {STATUS_LABELS.map(opt => (
            <Button
              key={opt.value}
              variant={statusFilter === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No properties found
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attested by</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.id}</TableCell>
                <TableCell>{p.address}</TableCell>
                <TableCell className="font-mono text-xs">{truncatePrincipal(p.owner)}</TableCell>
                <TableCell>{formatPrice(p.price)}</TableCell>
                <TableCell><Badge variant="outline">{p.propertyType}</Badge></TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE_VARIANT[p.status] ?? 'secondary'}>
                    {p.status === 'InTransaction' ? 'In Transaction' : p.status}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs" title={p.attestedAt ? new Date(p.attestedAt / 1_000_000).toLocaleString() : undefined}>{p.attestedBy ? truncatePrincipal(p.attestedBy) : '—'}</TableCell>
                <TableCell className="text-sm">
                  {p.createdAt ? new Date(p.createdAt / 1_000_000).toLocaleDateString() : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
