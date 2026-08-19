'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, Smartphone, ListOrdered, TrendingUp, ArrowRight, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDateTime, statusColor, timeAgo } from '@/lib/format';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const [stats, setStats] = useState({ totalNumbers: 0, activeNumbers: 0, totalDeposits: 0, totalSpent: 0 });
  const [recentNumbers, setRecentNumbers] = useState<any[]>([]);
  const [recentTxns, setRecentTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: numbers }, { data: txns }] = await Promise.all([
        supabase.from('numbers').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      ]);

      setRecentNumbers(numbers ?? []);
      setRecentTxns(txns ?? []);
      setStats({
        totalNumbers: numbers?.length ?? 0,
        activeNumbers: numbers?.filter((n) => n.status === 'active' || n.status === 'pending').length ?? 0,
        totalDeposits: txns?.filter((t) => t.type === 'credit').reduce((s, t) => s + Number(t.amount), 0) ?? 0,
        totalSpent: txns?.filter((t) => t.type === 'debit').reduce((s, t) => s + Number(t.amount), 0) ?? 0,
      });
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <div className="lg:pl-64">
        <div className="mt-16 lg:mt-16">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight">Welcome back, {profile?.full_name || 'User'}!</h1>
              <p className="mt-1 text-muted-foreground">Here's your account overview</p>
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Wallet Balance</CardTitle>
                  <Wallet className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(profile?.wallet_balance ?? 0)}</div>
                  <Button size="sm" variant="ghost" className="mt-2 h-7 px-0 text-xs text-primary" asChild>
                    <Link href="/dashboard/wallet">Fund wallet <ArrowRight className="ml-1 h-3 w-3" /></Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Numbers</CardTitle>
                  <Smartphone className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalNumbers}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{stats.activeNumbers} active</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Funded</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(stats.totalDeposits)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
                  <ListOrdered className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(stats.totalSpent)}</div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Button size="lg" className="h-auto justify-start py-6" asChild>
                <Link href="/dashboard/buy">
                  <Smartphone className="mr-3 h-5 w-5" /> Buy a Number
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-auto justify-start py-6" asChild>
                <Link href="/dashboard/wallet">
                  <Wallet className="mr-3 h-5 w-5" /> Fund Wallet
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-auto justify-start py-6" asChild>
                <Link href="/dashboard/numbers">
                  <ListOrdered className="mr-3 h-5 w-5" /> My Numbers
                </Link>
              </Button>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {/* Recent Numbers */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Numbers</CardTitle>
                  <CardDescription>Your latest purchased numbers</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>
                  ) : recentNumbers.length === 0 ? (
                    <div className="py-6 text-center">
                      <p className="text-sm text-muted-foreground">No numbers purchased yet</p>
                      <Button size="sm" className="mt-3" asChild>
                        <Link href="/dashboard/buy">Buy your first number</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentNumbers.map((n) => (
                        <div key={n.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <div className="font-mono text-sm">{n.phone_number || 'Pending...'}</div>
                            <div className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</div>
                          </div>
                          <Badge variant="outline" className={statusColor(n.status)}>{n.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Transactions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Transactions</CardTitle>
                  <CardDescription>Your latest wallet activity</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>
                  ) : recentTxns.length === 0 ? (
                    <div className="py-6 text-center">
                      <p className="text-sm text-muted-foreground">No transactions yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentTxns.map((t) => (
                        <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${t.type === 'credit' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                              {t.type === 'credit' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                            </div>
                            <div>
                              <div className="text-sm font-medium">{t.description}</div>
                              <div className="text-xs text-muted-foreground">{formatDateTime(t.created_at)}</div>
                            </div>
                          </div>
                          <div className={`text-sm font-bold ${t.type === 'credit' ? 'text-green-500' : 'text-red-500'}`}>
                            {t.type === 'credit' ? '+' : '-'}{formatCurrency(Number(t.amount))}
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
    </div>
  );
}
