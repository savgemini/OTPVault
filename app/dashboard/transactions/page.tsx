'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpCircle, ArrowDownCircle, Receipt } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDateTime } from '@/lib/format';

export default function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      setTransactions(data ?? []);
      setLoading(false);
    })();
  }, [user]);

  const filtered = filter === 'all' ? transactions : transactions.filter((t) => t.type === filter);

  const totalCredit = transactions.filter((t) => t.type === 'credit').reduce((s, t) => s + Number(t.amount), 0);
  const totalDebit = transactions.filter((t) => t.type === 'debit').reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <div className="lg:pl-64">
        <div className="mt-16 lg:mt-16">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
              <p className="mt-1 text-muted-foreground">Your complete wallet activity</p>
            </div>

            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Credited</CardTitle>
                  <ArrowDownCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-500">{formatCurrency(totalCredit)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
                  <ArrowUpCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-500">{formatCurrency(totalDebit)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Net Balance</CardTitle>
                  <Receipt className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">{formatCurrency(totalCredit - totalDebit)}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-lg">Transaction History</CardTitle>
                    <CardDescription>All wallet credits and debits</CardDescription>
                  </div>
                  <div className="w-full sm:w-40">
                    <Select value={filter} onValueChange={setFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="credit">Credits</SelectItem>
                        <SelectItem value="debit">Debits</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>
                ) : filtered.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No transactions yet</p>
                ) : (
                  <div className="space-y-3">
                    {filtered.map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-full ${t.type === 'credit' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                            {t.type === 'credit' ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{t.description}</div>
                            <div className="text-xs text-muted-foreground">{formatDateTime(t.created_at)}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-bold ${t.type === 'credit' ? 'text-green-500' : 'text-red-500'}`}>
                            {t.type === 'credit' ? '+' : '-'}{formatCurrency(Number(t.amount))}
                          </div>
                          <div className="text-xs text-muted-foreground">Bal: {formatCurrency(Number(t.balance_after))}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
