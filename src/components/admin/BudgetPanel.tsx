import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { BudgetData, TransactionCost } from '../../types/adminDashboard.types';

interface BudgetPanelProps {
  budget: BudgetData | null;
  transactionCosts: TransactionCost[];
  isLoading: boolean;
  error?: string;
}

export const BudgetPanel: React.FC<BudgetPanelProps> = ({
  budget,
  transactionCosts,
  isLoading,
  error,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
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

  const usedPercentage = budget?.budgetTotal && budget.monthlySpend != null
    ? Math.round((budget.monthlySpend / budget.budgetTotal) * 100)
    : null;

  return (
    <div className="space-y-6">
      {/* Budget Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><h3 className="text-sm text-muted-foreground">Today's Spend</h3></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {budget?.dailySpend != null ? `£${budget.dailySpend.toFixed(2)}` : '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><h3 className="text-sm text-muted-foreground">Monthly Spend</h3></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {budget?.monthlySpend != null ? `£${budget.monthlySpend.toFixed(2)}` : '—'}
            </p>
            {usedPercentage != null && (
              <>
                <Progress value={usedPercentage} className="mt-2 h-2" />
                <p className="text-xs text-muted-foreground mt-1">{usedPercentage}% of budget used</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><h3 className="text-sm text-muted-foreground">Budget Status</h3></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {budget?.budgetRemaining != null ? `£${budget.budgetRemaining.toFixed(2)}` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">remaining</p>
            {budget && (
              <Badge
                variant={budget.canAfford ? 'default' : 'destructive'}
                className="mt-2"
              >
                {budget.canAfford ? 'Affordable' : 'Over Budget'}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction Costs */}
      {transactionCosts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-medium">Cost Per Transaction</h3>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Transaction cost breakdown will appear here when data is available.
            </div>
          </CardContent>
        </Card>
      )}

      {!budget && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Budget tracking not configured. The ledger_manager canister needs to have budget data set up.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
