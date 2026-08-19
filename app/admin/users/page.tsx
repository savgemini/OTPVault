'use client';

import { useEffect, useState } from 'react';
import { AdminSidebar } from '@/components/admin-sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Users, Loader2, Ban, CheckCircle2, Wallet, Receipt } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setUsers(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    if (!selected) {
      setTransactions([]);
      return;
    }
    setTransactionsLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', selected.id)
          .order('created_at', { ascending: false })
          .limit(50);
        setTransactions(data ?? []);
      } finally {
        setTransactionsLoading(false);
      }
    })();
  }, [selected]);

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleBan = async (userId: string, banned: boolean) => {
    setActionLoading(true);
    const { error } = await supabase.functions.invoke('admin-action', {
      body: { action: 'toggle_ban', user_id: userId, banned: !banned },
    });
    setActionLoading(false);
    if (error) {
      toast.error('Failed to update user');
    } else {
      toast.success(`User ${!banned ? 'banned' : 'unbanned'}`);
      fetchUsers();
      setSelected(null);
    }
  };

  const handleCredit = async () => {
    const amt = parseFloat(creditAmount);
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setActionLoading(true);
    const { error } = await supabase.functions.invoke('admin-action', {
      body: { action: 'credit_wallet', user_id: selected.id, amount: amt },
    });
    setActionLoading(false);
    if (error) {
      toast.error('Failed to credit wallet');
    } else {
      toast.success(`Wallet credited with ${formatCurrency(amt)}`);
      setCreditAmount('');
      fetchUsers();
      setSelected(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <div className="lg:pl-64">
        <div className="mt-16 lg:mt-0">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight">Users</h1>
              <p className="mt-1 text-muted-foreground">Manage all platform users</p>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by email or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-md pl-9"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr className="text-left text-muted-foreground">
                          <th className="p-4 font-medium">User</th>
                          <th className="p-4 font-medium">Wallet</th>
                          <th className="p-4 font-medium">Role</th>
                          <th className="p-4 font-medium">Status</th>
                          <th className="p-4 font-medium">Joined</th>
                          <th className="p-4 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((u) => (
                          <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="p-4">
                              <div className="font-medium">{u.email}</div>
                              <div className="text-xs text-muted-foreground">{u.full_name || 'No name'}</div>
                            </td>
                            <td className="p-4 font-medium">{formatCurrency(Number(u.wallet_balance))}</td>
                            <td className="p-4">
                              <Badge variant="outline" className="capitalize">{u.role}</Badge>
                            </td>
                            <td className="p-4">
                              <Badge variant="outline" className={u.banned ? 'bg-red-500/10 text-red-600' : 'bg-green-500/10 text-green-600'}>
                                {u.banned ? 'Banned' : 'Active'}
                              </Badge>
                            </td>
                            <td className="p-4 text-muted-foreground">{formatDateTime(u.created_at)}</td>
                            <td className="p-4">
                              <Button size="sm" variant="outline" onClick={() => setSelected(u)}>
                                Manage
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Manage User Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage User</DialogTitle>
            <DialogDescription>{selected?.email}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Wallet Balance</div>
                  <div className="text-lg font-bold">{formatCurrency(Number(selected.wallet_balance))}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Role</div>
                  <div className="text-lg font-bold capitalize">{selected.role}</div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Credit Wallet</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                  />
                  <Button onClick={handleCredit} disabled={actionLoading}>
                    <Wallet className="mr-1 h-4 w-4" /> Credit
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium"><Receipt className="h-4 w-4" /> Transactions</div>
                {transactionsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : transactions.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No transactions for this user.</p>
                ) : (
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {transactions.map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                        <div>
                          <div className="font-medium">{transaction.description || transaction.type}</div>
                          <div className="text-xs text-muted-foreground">{formatDateTime(transaction.created_at)}</div>
                        </div>
                        <div className={transaction.type === 'credit' ? 'font-semibold text-green-600' : 'font-semibold text-red-600'}>
                          {transaction.type === 'credit' ? '+' : '-'}{formatCurrency(Number(transaction.amount))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                variant={selected.banned ? 'default' : 'destructive'}
                className="w-full"
                onClick={() => handleBan(selected.id, selected.banned)}
                disabled={actionLoading}
              >
                {selected.banned ? <><CheckCircle2 className="mr-2 h-4 w-4" /> Unban User</> : <><Ban className="mr-2 h-4 w-4" /> Ban User</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
