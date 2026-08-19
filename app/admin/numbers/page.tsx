'use client';

import { useEffect, useState } from 'react';
import { AdminSidebar } from '@/components/admin-sidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Smartphone } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDateTime, statusColor } from '@/lib/format';

export default function AdminNumbersPage() {
  const [numbers, setNumbers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('numbers')
        .select(`
          *,
          profiles!inner(email),
          services(name),
          countries(name, flag),
          providers(name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      setNumbers(data ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = filter === 'all' ? numbers : numbers.filter((n) => n.status === filter);

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <div className="lg:pl-64">
        <div className="mt-16 lg:mt-0">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Numbers</h1>
                <p className="mt-1 text-muted-foreground">All purchased numbers on the platform</p>
              </div>
              <div className="w-full sm:w-48">
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
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
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <Smartphone className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No numbers found</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr className="text-left text-muted-foreground">
                          <th className="p-4 font-medium">Number</th>
                          <th className="p-4 font-medium">User</th>
                          <th className="p-4 font-medium">Service</th>
                          <th className="p-4 font-medium">Country</th>
                          <th className="p-4 font-medium">Cost</th>
                          <th className="p-4 font-medium">Status</th>
                          <th className="p-4 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((n) => (
                          <tr key={n.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="p-4 font-mono">{n.phone_number || 'Pending'}</td>
                            <td className="p-4">{n.profiles?.email}</td>
                            <td className="p-4">{n.services?.name}</td>
                            <td className="p-4">{n.countries?.flag} {n.countries?.name}</td>
                            <td className="p-4">{formatCurrency(Number(n.cost))}</td>
                            <td className="p-4"><Badge variant="outline" className={statusColor(n.status)}>{n.status}</Badge></td>
                            <td className="p-4 text-muted-foreground">{formatDateTime(n.created_at)}</td>
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
