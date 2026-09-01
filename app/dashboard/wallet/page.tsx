'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, ArrowDownToLine, Clock, Loader2, Landmark } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDateTime, statusColor } from '@/lib/format';
import { toast } from 'sonner';

export default function WalletPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [deposits, setDeposits] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [bankDetails, setBankDetails] = useState<any | null>(null);
  const [bankDetailsLoading, setBankDetailsLoading] = useState(true);

  const handlePaystackCheckout = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 100) {
      toast.error('Minimum deposit is ₦100');
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-deposit', {
        body: { amount: amt, method: 'paystack' },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Failed to start Paystack checkout');
      if (!data?.checkout_url) {
        if (data?.account_number || data?.bank_name) {
          throw new Error('The deployed create-deposit function is still using the old virtual-account flow. Deploy the updated function before trying again.');
        }
        throw new Error('Paystack checkout was not initialized. Deploy the updated create-deposit function and run the Paystack deposit migration.');
      }

      setAmount('');
      window.location.assign(data.checkout_url);
    } catch (err: any) {
      toast.error(err.message || 'Unable to start Paystack checkout');
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('deposits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setDeposits(data ?? []);
      setLoading(false);

      const reference = new URLSearchParams(window.location.search).get('reference');
      if (reference) {
        const { data: verification, error } = await supabase.functions.invoke('create-deposit', {
          body: { action: 'verify', reference },
        });
        window.history.replaceState({}, '', '/dashboard/wallet');
        if (error || verification?.error) {
          toast.error(verification?.error || error?.message || 'Unable to verify Paystack payment');
        } else if (verification?.status === 'successful') {
          await refreshProfile();
          await refreshDeposits();
          toast.success('Payment confirmed. Your wallet has been credited.');
        }
      }
    })();
  }, [user]);

  // Fetch bank transfer details from gateway settings
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('gateways')
          .select('account_number, bank_name, account_name')
          .eq('slug', 'vpay')
          .maybeSingle();
        
        if (data) {
          setBankDetails({
            account_number: data.account_number,
            bank_name: data.bank_name,
            account_name: data.account_name,
          });
        }
      } catch (err) {
        console.error('Failed to fetch bank details:', err);
      } finally {
        setBankDetailsLoading(false);
      }
    })();
  }, []);

  const refreshDeposits = async () => {
    if (!user) return;
    const { data: deps } = await supabase
      .from('deposits')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setDeposits(deps ?? []);
  };

  const handleManualDeposit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 100) {
      toast.error('Minimum deposit is ₦100');
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-deposit', {
        body: { amount: amt, method: 'manual' },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Failed to create deposit');
      toast.success('Deposit request submitted. An admin will review and approve it shortly.');
      setAmount('');
      refreshDeposits();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const formatStatus = (status: string) => {
    if (status === 'awaiting_payment') return 'Awaiting Payment';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <div className="lg:pl-64">
        <div className="mt-16 lg:mt-16">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
              <p className="mt-1 text-muted-foreground">Fund your account and view deposit history</p>
            </div>

            {/* Balance Card */}
            <Card className="mb-6 border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" /> Wallet Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-primary">{formatCurrency(profile?.wallet_balance ?? 0)}</div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Fund Wallet */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Fund Your Wallet</CardTitle>
                  <CardDescription>Choose a deposit method below</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="paystack">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="paystack">Paystack</TabsTrigger>
                      <TabsTrigger value="manual">Manual / Bank Transfer</TabsTrigger>
                    </TabsList>

                    <TabsContent value="paystack" className="space-y-4">
                      <div>
                        <Label htmlFor="amount-paystack">Amount (₦)</Label>
                        <Input
                          id="amount-paystack"
                          type="number"
                          placeholder="500"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                        />
                        <p className="mt-1 text-xs text-muted-foreground">Minimum: ₦100</p>
                      </div>
                      <Button className="w-full" onClick={handlePaystackCheckout} disabled={creating}>
                        {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowDownToLine className="mr-2 h-4 w-4" />}
                        Continue to Paystack
                      </Button>

                      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                        Paystack handles the checkout page, so there are no virtual account details to generate here.
                      </div>
                    </TabsContent>

                    <TabsContent value="manual" className="space-y-4">
                      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                        <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                          <Landmark className="h-4 w-4" /> Bank Transfer Details
                        </div>
                        <p>Transfer to our corporate account, then submit the deposit for admin approval:</p>
                        <div className="mt-2 space-y-1">
                          {bankDetailsLoading ? (
                            <p className="text-xs text-muted-foreground">Loading bank details...</p>
                          ) : bankDetails ? (
                            <>
                              <div><strong>Bank:</strong> {bankDetails.bank_name || 'Bank information not configured'}</div>
                              <div><strong>Account:</strong> {bankDetails.account_number || 'Account number not configured'}</div>
                              <div><strong>Name:</strong> {bankDetails.account_name || 'Account name not configured'}</div>
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground">Bank details are not yet configured. Please contact support.</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="amount-man">Amount (₦)</Label>
                        <Input
                          id="amount-man"
                          type="number"
                          placeholder="500"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                        />
                      </div>
                      <Button className="w-full" onClick={handleManualDeposit} disabled={creating || !bankDetails}>
                        {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
                        Submit for Approval
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Your deposit will be reviewed by an admin. Once approved, your wallet will be credited automatically.
                      </p>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Deposit History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Deposit History</CardTitle>
                  <CardDescription>Your recent funding requests</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>
                  ) : deposits.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No deposits yet</p>
                  ) : (
                    <div className="space-y-3">
                      {deposits.map((d) => (
                        <div key={d.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <div className="text-sm font-medium">{formatCurrency(Number(d.amount))}</div>
                            <div className="text-xs text-muted-foreground">{formatDateTime(d.created_at)}</div>
                            <div className="text-xs text-muted-foreground capitalize">{d.method.replace('_', ' ')}</div>
                          </div>
                          <Badge variant="outline" className={statusColor(d.status === 'awaiting_payment' ? 'pending' : d.status)}>
                            {formatStatus(d.status)}
                          </Badge>
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
