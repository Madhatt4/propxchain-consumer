import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { SummaryData } from '../../types/adminDashboard.types';

interface SummaryCardsProps {
  data: SummaryData | null;
  isLoading: boolean;
}

const borderColors: Record<string, string> = {
  canisters: 'border-l-green-500',
  transactions: 'border-l-blue-500',
  budget: 'border-l-amber-500',
  alerts: 'border-l-red-500',
};

export const SummaryCards: React.FC<SummaryCardsProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border-l-4">
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const budgetPercentage = data.lrBudgetTotal && data.lrBudgetRemaining != null
    ? Math.round(((data.lrBudgetTotal - data.lrBudgetRemaining) / data.lrBudgetTotal) * 100)
    : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Canisters */}
      <Card className={cn('border-l-4', borderColors.canisters)}>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Canisters</p>
          <p className="text-2xl font-bold">
            {data.healthyCanisters}/{data.totalCanisters}
            <span className="text-sm font-normal ml-1 text-muted-foreground">healthy</span>
          </p>
        </CardContent>
      </Card>

      {/* Active Transactions */}
      <Card className={cn('border-l-4', borderColors.transactions)}>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Active Transactions</p>
          <p className="text-2xl font-bold">{data.activeTransactions}</p>
        </CardContent>
      </Card>

      {/* LR Budget */}
      <Card className={cn('border-l-4', borderColors.budget)}>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">LR Budget</p>
          {data.lrBudgetRemaining != null ? (
            <>
              <p className="text-2xl font-bold">
                £{data.lrBudgetRemaining.toFixed(2)}
              </p>
              {budgetPercentage != null && (
                <Progress value={budgetPercentage} className="mt-2 h-2" />
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Not configured</p>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card className={cn('border-l-4', borderColors.alerts)}>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Alerts</p>
          <p className={cn(
            'text-2xl font-bold',
            data.alertCount > 0 ? 'text-red-500' : 'text-green-500'
          )}>
            {data.alertCount > 0 ? `${data.alertCount} Urgent` : 'All Clear'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
