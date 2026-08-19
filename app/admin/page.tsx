'use client';

import { useEffect, useState } from 'react';
import { AdminSidebar } from '@/components/admin-sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, CreditCard, Smartphone, TrendingUp, DollarSign, Activity } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/format';

export default function AdminOverviewPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDeposits: 0,
    totalNumbers: 0,
    totalRevenue: 0,
    pendingDeposits: 0,
    activeNumbers: 0,
  });
  const [recentDeposits, setRecentDeposits] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ count: users }, { count: numbers }, { data: deposits }, { data: txns }, { data: profiles }, { data: pendingDeps }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('numbers').select('*', { count: 'exact', head: true }),
        supabase.from('deposits').select('amount, status, created_at').order('created_at', { ascending: false }).limit(10),
        supabase.from('transactions').select('amount, type'),
        supabase.from('profiles').select('email, created_at, wallet_balance').order('created_at', { ascending: false }).limit(5),
        supabase.from('deposits').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      const totalDep = (deposits ?? []).filter((d) => d.status === 'successful').reduce((s, d) => s + Number(d.amount), 0);
      const totalRev = (txns ?? []).filter((t) => t.type === 'debit').reduce((s, t) => s + Number(t.amount), 0);

      setStats({
        totalUsers: users ?? 0,
        totalDeposits: totalDep,
        totalNumbers: numbers ?? 0,
        totalRevenue: totalRev,
        pendingDeposits: pendingDeps?.length ?? 0,
        activeNumbers: 0,
      });
      setRecentDeposits(deposits ?? []);
      setRecentUsers(profiles ?? []);
      setLoading(false);
    })();
  }, []);

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-500' },
    { label: 'Total Deposits', value: formatCurrency(stats.totalDeposits), icon: CreditCard, color: 'text-green-500' },
    { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), icon: DollarSign, color: 'text-primary' },
    { label: 'Numbers Sold', value: stats.totalNumbers, icon: Smartphone, color: 'text-orange-500' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <div className="lg:pl-64">
        <div className="mt-16 lg:mt-0">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight">Admin Overview</h1>
              <p className="mt-1 text-muted-foreground">Platform statistics and recent activity</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {statCards.map((stat) => (
                <Card key={stat.label}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{loading ? '...' : stat.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Deposits</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentDeposits.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">No deposits yet</p>
                  ) : (
                    <div className="space-y-2">
                      {recentDeposits.map((d, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                          <span>{formatCurrency(Number(d.amount))}</span>
                          <span className="text-xs text-muted-foreground capitalize">{d.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Users</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentUsers.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">No users yet</p>
                  ) : (
                    <div className="space-y-2">
                      {recentUsers.map((u, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                          <span className="truncate">{u.email}</span>
                          <span className="text-xs text-muted-foreground">{formatCurrency(Number(u.wallet_balance))}</span>
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
