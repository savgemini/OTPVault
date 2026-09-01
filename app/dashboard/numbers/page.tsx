'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Smartphone, MessageSquare, Clock, X, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDateTime, timeAgo, statusColor } from '@/lib/format';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function MyNumbersPage() {
  const { user, refreshProfile } = useAuth();
  const [numbers, setNumbers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedNumber, setSelectedNumber] = useState<any | null>(null);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [loadingSms, setLoadingSms] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const fetchNumbers = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('numbers')
      .select(`
        *,
        services(name),
        countries(name, flag),
        providers(name)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setNumbers(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchNumbers();
  }, [user]);

  const viewSms = async (number: any) => {
    setSelectedNumber(number);
    setLoadingSms(true);
    const { data } = await supabase
      .from('sms_logs')
      .select('*')
      .eq('number_id', number.id)
      .order('created_at', { ascending: false });
    setSmsLogs(data ?? []);
    setLoadingSms(false);
  };

  const handleCancel = async (numberId: string) => {
    if (cancelingId) return;
    setCancelingId(numberId);

    try {
      const { data, error } = await supabase.functions.invoke('cancel-number', {
        body: { number_id: numberId },
      });
      if (error || data?.error) throw new Error(data?.error || 'Cancel failed');
      toast.success('Number cancelled and wallet refunded');
      await refreshProfile();
      fetchNumbers();
      setSelectedNumber(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCancelingId(null);
    }
  };

  const filtered = filter === 'all' ? numbers : numbers.filter((n) => n.status === filter);

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <div className="lg:pl-64">
        <div className="mt-16 lg:mt-16">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">My Numbers</h1>
                <p className="mt-1 text-muted-foreground">View your purchased numbers and SMS logs</p>
              </div>
              <div className="w-full sm:w-48">
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Numbers</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Loading...</p>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <Smartphone className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No numbers found</p>
                  <Button asChild>
                    <a href="/dashboard/buy">Buy a Number</a>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filtered.map((n) => (
                  <Card key={n.id}>
                    <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Smartphone className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-mono text-lg font-bold">{n.phone_number || 'Pending...'}</div>
                          <div className="text-sm text-muted-foreground">
                            {n.services?.name} · {n.countries?.flag} {n.countries?.name} · {n.providers?.name}
                          </div>
                          <div className="text-xs text-muted-foreground">{formatDateTime(n.created_at)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-bold">{formatCurrency(Number(n.cost))}</div>
                        </div>
                        <Badge variant="outline" className={statusColor(n.status)}>{n.status}</Badge>
                        <Button size="sm" variant="outline" onClick={() => viewSms(n)}>
                          <MessageSquare className="mr-1 h-3 w-3" /> View SMS
                        </Button>
                        {(n.status === 'active' || n.status === 'pending') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCancel(n.id)}
                            disabled={cancelingId === n.id || !!cancelingId}
                          >
                            {cancelingId === n.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SMS Dialog */}
      <Dialog open={!!selectedNumber} onOpenChange={(open) => !open && setSelectedNumber(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> SMS Inbox
            </DialogTitle>
            <DialogDescription>
              {selectedNumber?.phone_number || 'Pending number'} · {selectedNumber?.services?.name}
            </DialogDescription>
          </DialogHeader>
          <div>
            {loadingSms ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : smsLogs.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No SMS received on this number
              </div>
            ) : (
              <div className="space-y-3">
                {smsLogs.map((sms) => (
                  <div key={sms.id} className="rounded-lg border bg-green-500/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{sms.sender || 'Unknown'}</span>
                      <span className="text-xs text-muted-foreground">{timeAgo(sms.created_at)}</span>
                    </div>
                    <p className="mt-1 text-sm">{sms.message}</p>
                    {sms.code && (
                      <div className="mt-2 inline-block rounded bg-primary/10 px-3 py-1 font-mono text-lg font-bold text-primary">
                        {sms.code}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
