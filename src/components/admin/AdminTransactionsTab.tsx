import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Transaction } from '../../types/transaction.types';
import { TransactionStatusFilterOption, DateRangeFilter, AmountRangeFilter, TransactionFilters as TransactionFiltersType } from '../../types/admin.types';
import { isCompletedStatus } from '../../types/transactionStatus';
import TransactionFilters from './TransactionFilters';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface AdminTransactionsTabProps {
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: TransactionStatusFilterOption;
  dateRangeFilter: DateRangeFilter;
  amountRangeFilter: AmountRangeFilter;
  statusCounts: Record<TransactionStatusFilterOption, number>;
  onFiltersChange: (filters: TransactionFiltersType) => void;
  onClearFilters: () => void;
  onDeleteTransaction: (id: string) => void;
  getUserName: (principalOrId: string) => string;
  copyToClipboard: (text: string) => void;
}

export const AdminTransactionsTab: React.FC<AdminTransactionsTabProps> = ({
  transactions,
  filteredTransactions,
  searchTerm,
  onSearchChange,
  statusFilter,
  dateRangeFilter,
  amountRangeFilter,
  statusCounts,
  onFiltersChange,
  onClearFilters,
  onDeleteTransaction,
  getUserName,
  copyToClipboard,
}) => {
  const navigate = useNavigate();

  return (
    <div>
      {/* Filters */}
      <div className="mb-6">
        <TransactionFilters
          filters={{
            status: statusFilter,
            dateRange: dateRangeFilter,
            amountRange: amountRangeFilter,
          }}
          onFiltersChange={onFiltersChange}
          statusCounts={statusCounts}
          onClearFilters={onClearFilters}
        />
      </div>

      {/* Search */}
      <div className="mb-6">
        <Input
          type="text"
          placeholder="Search transactions by ID, address, user, email, or status..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-12"
        />
      </div>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Transaction ID</TableHead>
                <TableHead>ICP Blockchain IDs</TableHead>
                <TableHead>Property Address</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {searchTerm ? 'No transactions match your search' : 'No transactions yet'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map((tx) => {
                  const txId = tx.id?.toString() || 'N/A';
                  const propertyId = tx.propertyId?.toString() || 'N/A';
                  const transactionId = tx.id?.toString() || 'N/A';
                  const seller = tx.createdBy || tx.seller || 'Unknown';
                  const amount = tx.amount || tx.financialTerms?.purchasePrice || 0;
                  const status = tx.status || 'pending';
                  // Cancellation is not a status on chain; it lives in oldStatus.
                  const isCancelled = tx.oldStatus === 'cancelled';
                  const createdAt = tx.createdAt || Date.now();

                  return (
                    <TableRow key={txId}>
                      <TableCell className="font-mono">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(txId)}
                          className="h-auto p-1"
                        >
                          {txId}
                          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center text-xs font-mono">
                            <Badge variant="outline" className="text-green-700 border-green-700/30 dark:text-green-400 dark:border-green-400/30 mr-2">Property</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(propertyId)}
                              className="h-auto p-1"
                            >
                              {propertyId}
                            </Button>
                          </div>
                          <div className="flex items-center text-xs font-mono">
                            <Badge variant="outline" className="text-gray-500 dark:text-gray-400 border-gray-400/30 mr-2">TX</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(transactionId)}
                              className="h-auto p-1"
                            >
                              {transactionId}
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {tx.propertyAddress || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{getUserName(seller)}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-xs">
                            {seller}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isCancelled ? 'destructive' : isCompletedStatus(status) ? 'default' : 'secondary'}
                          className={cn(
                            isCancelled && "bg-red-600",
                            !isCancelled && isCompletedStatus(status) && "bg-green-600 hover:bg-green-600",
                            !isCancelled && !isCompletedStatus(status) && "bg-gray-200 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                          )}
                        >
                          {isCancelled ? 'cancelled' : status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        £{Number(amount).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-gray-600 dark:text-gray-400">
                        {createdAt && Number(createdAt) > 0
                          ? new Date(Number(createdAt) / 1_000_000).toLocaleDateString()
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/transaction/${txId}`)}
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                        >
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteTransaction(txId)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400 flex flex-wrap gap-2 items-center">
        <span>Showing {filteredTransactions.length} of {transactions.length} transactions</span>
        {statusFilter !== 'all' && (
          <Badge variant="outline" className="text-gray-500 dark:text-gray-400 border-gray-400/30">
            Status: {statusFilter}
          </Badge>
        )}
        {dateRangeFilter.preset !== 'all-time' && (
          <Badge variant="outline" className="text-gray-500 dark:text-gray-400 border-gray-400/30">
            Date: {dateRangeFilter.preset === 'custom'
              ? `${dateRangeFilter.startDate || 'Start'} - ${dateRangeFilter.endDate || 'End'}`
              : dateRangeFilter.preset.replace('-', ' ')}
          </Badge>
        )}
        {amountRangeFilter.preset !== 'all' && (
          <Badge variant="outline" className="text-gray-500 dark:text-gray-400 border-gray-400/30">
            Amount: {amountRangeFilter.preset === 'custom'
              ? `£${amountRangeFilter.minAmount?.toLocaleString() || '0'} - £${amountRangeFilter.maxAmount?.toLocaleString() || '∞'}`
              : amountRangeFilter.preset === 'under-100k' ? 'Under £100k'
              : amountRangeFilter.preset === '100k-500k' ? '£100k-£500k'
              : amountRangeFilter.preset === '500k-1m' ? '£500k-£1M'
              : amountRangeFilter.preset === 'over-1m' ? 'Over £1M'
              : amountRangeFilter.preset}
          </Badge>
        )}
        {searchTerm && (
          <Badge variant="outline" className="text-gray-500 dark:text-gray-400 border-gray-400/30">
            Search: "{searchTerm}"
          </Badge>
        )}
      </div>
    </div>
  );
};

export default AdminTransactionsTab;
