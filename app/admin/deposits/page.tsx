'use client';

import { useEffect, useState } from 'react';
import { AdminSidebar } from '@/components/admin-sidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, XCircle, Loader2, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDateTime, statusColor } from '@/lib/format';
import { toast } from 'sonner';

export default function AdminDepositsPage() {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');

  const fetchDeposits = async () => {
    setLoadError('');
    const { data: rawDeposits, error } = await supabase
      .from('deposits')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      setLoadError(error.message);
      setDeposits([]);
      setLoading(false);
      return;
    }

    const userIds = [...new Set((rawDeposits ?? []).map((deposit) => deposit.user_id))];
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id, email, full_name').in('id', userIds)
      : { data: [] };
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    setDeposits((rawDeposits ?? []).map((deposit) => ({ ...deposit, profiles: profileById.get(deposit.user_id) })));
    setLoading(false);
  };

  useEffect(() => { fetchDeposits(); }, []);

  const handleApprove = async (depositId: string, amount: number) => {
    setActionLoading(depositId);
    const { error } = await supabase.functions.invoke('admin-action', {
      body: { action: 'approve_deposit', deposit_id: depositId, amount },
    });
    setActionLoading(null);
    if (error) {
      toast.error('Failed to approve deposit');
    } else {
      toast.success('Deposit approved and wallet credited');
      fetchDeposits();
    }
  };

  const handleReject = async (depositId: string) => {
    setActionLoading(depositId);
    const { error } = await supabase.functions.invoke('admin-action', {
      body: { action: 'reject_deposit', deposit_id: depositId },
    });
    setActionLoading(null);
    if (error) {
      toast.error('Failed to reject deposit');
    } else {
      toast.success('Deposit rejected');
      fetchDeposits();
    }
  };

  const filtered = filter === 'all' ? deposits : deposits.filter((d) => d.status === filter);

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <div className="lg:pl-64">
        <div className="mt-16 lg:mt-0">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Deposits</h1>
                <p className="mt-1 text-muted-foreground">Review and approve deposit requests</p>
              </div>
              <div className="w-full sm:w-48">
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Deposits</SelectItem>
                    <SelectItem value="awaiting_payment">Awaiting Payment</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="successful">Successful</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <CreditCard className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{loadError || 'No deposits found'}</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr className="text-left text-muted-foreground">
                          <th className="p-4 font-medium">User</th>
                          <th className="p-4 font-medium">Amount</th>
                          <th className="p-4 font-medium">Method</th>
                          <th className="p-4 font-medium">Status</th>
                          <th className="p-4 font-medium">Date</th>
                          <th className="p-4 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((d) => (
                          <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="p-4">
                              <div className="font-medium">{d.profiles?.email}</div>
                              <div className="text-xs text-muted-foreground">{d.profiles?.full_name || ''}</div>
                            </td>
                            <td className="p-4 font-bold">{formatCurrency(Number(d.amount))}</td>
                            <td className="p-4 capitalize">{d.method.replace('_', ' ')}</td>
                            <td className="p-4">
                              <Badge variant="outline" className={statusColor(d.status === 'awaiting_payment' ? 'pending' : d.status)}>
                                {d.status === 'awaiting_payment' ? 'Awaiting Payment' : d.status}
                              </Badge>
                            </td>
                            <td className="p-4 text-muted-foreground">{formatDateTime(d.created_at)}</td>
                            <td className="p-4">
                              {d.status === 'pending' || d.status === 'awaiting_payment' ? (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleApprove(d.id, Number(d.amount))}
                                    disabled={actionLoading === d.id}
                                  >
                                    {actionLoading === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleReject(d.id)}
                                    disabled={actionLoading === d.id}
                                  >
                                    <XCircle className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
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
    </div>
  );
}
