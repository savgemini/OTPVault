'use client';

import { useEffect, useState } from 'react';
import { AdminSidebar } from '@/components/admin-sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, CreditCard, Trash2, Edit, Save, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

type GatewayForm = {
  name: string;
  slug: string;
  gateway_type: string;
  public_key_encrypted: string;
  secret_key_encrypted: string;
  webhook_secret_encrypted: string;
  paystack_public_key: string;
  paystack_secret_key: string;
  paystack_webhook_secret: string;
  account_number: string;
  bank_name: string;
  account_name: string;
  active: boolean;
};

const emptyForm: GatewayForm = {
  name: '',
  slug: '',
  gateway_type: 'vpay',
  public_key_encrypted: '',
  secret_key_encrypted: '',
  webhook_secret_encrypted: '',
  paystack_public_key: '',
  paystack_secret_key: '',
  paystack_webhook_secret: '',
  account_number: '',
  bank_name: '',
  account_name: '',
  active: true,
};

export default function AdminGatewaysPage() {
  const [gateways, setGateways] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<GatewayForm>(emptyForm);

  const fetchGateways = async () => {
    const { data } = await supabase.from('gateways').select('*').order('created_at', { ascending: false });
    setGateways(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchGateways(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.slug) { toast.error('Name and slug are required'); return; }
    if (editing) {
      const { error } = await supabase.from('gateways').update(form).eq('id', editing.id);
      if (error) toast.error('Failed to update gateway'); else toast.success('Gateway updated');
    } else {
      const { error } = await supabase.from('gateways').insert(form);
      if (error) toast.error('Failed to create gateway'); else toast.success('Gateway created');
    }
    setEditing(null); setShowForm(false);
    setForm(emptyForm);
    fetchGateways();
  };

  const handleEdit = (g: any) => {
    setEditing(g);
    setForm({
      name: g.name,
      slug: g.slug,
      gateway_type: g.gateway_type ?? 'vpay',
      public_key_encrypted: g.public_key_encrypted ?? '',
      secret_key_encrypted: g.secret_key_encrypted ?? '',
      webhook_secret_encrypted: g.webhook_secret_encrypted ?? '',
      paystack_public_key: g.paystack_public_key ?? '',
      paystack_secret_key: g.paystack_secret_key ?? '',
      paystack_webhook_secret: g.paystack_webhook_secret ?? '',
      account_number: g.account_number ?? '',
      bank_name: g.bank_name ?? '',
      account_name: g.account_name ?? '',
      active: g.active,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('gateways').delete().eq('id', id);
    if (error) toast.error('Failed to delete gateway'); else { toast.success('Gateway deleted'); fetchGateways(); }
  };

  const handleToggle = async (g: any) => {
    await supabase.from('gateways').update({ active: !g.active }).eq('id', g.id);
    fetchGateways();
  };

  const isPaystack = form.gateway_type === 'paystack';

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <div className="lg:pl-64">
        <div className="mt-16 lg:mt-0">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Payment Gateways</h1>
                <p className="mt-1 text-muted-foreground">Manage payment provider integrations</p>
              </div>
              <Button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Add Gateway
              </Button>
            </div>

            {showForm && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    {editing ? 'Edit Gateway' : 'New Gateway'}
                    <Button size="icon" variant="ghost" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VPay" /></div>
                    <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="vpay" /></div>
                    <div>
                      <Label>Gateway Type</Label>
                      <Select value={form.gateway_type} onValueChange={(v) => setForm({ ...form, gateway_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vpay">VPay</SelectItem>
                          <SelectItem value="paystack">Paystack</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Bank Account Details only apply to VPay virtual-account flow */}
                  {!isPaystack && (
                    <div className="space-y-4 rounded-lg border p-4">
                      <h3 className="text-sm font-semibold text-muted-foreground">Bank Account Details</h3>
                      <p className="text-xs text-muted-foreground">This is the account users will send money to when funding their wallet.</p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div><Label>Account Number</Label><Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} placeholder="0123456789" /></div>
                        <div><Label>Bank Name</Label><Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="VPay Bank" /></div>
                        <div><Label>Account Name</Label><Input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} placeholder="OTPSuite Ltd" /></div>
                      </div>
                    </div>
                  )}

                  {/* VPay fields */}
                  {!isPaystack && (
                    <div className="space-y-4 rounded-lg border p-4">
                      <h3 className="text-sm font-semibold text-muted-foreground">VPay Credentials</h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div><Label>Public Key</Label><Input type="password" value={form.public_key_encrypted} onChange={(e) => setForm({ ...form, public_key_encrypted: e.target.value })} placeholder="pk_..." /></div>
                        <div><Label>Secret Key</Label><Input type="password" value={form.secret_key_encrypted} onChange={(e) => setForm({ ...form, secret_key_encrypted: e.target.value })} placeholder="sk_..." /></div>
                        <div><Label>Webhook Secret</Label><Input type="password" value={form.webhook_secret_encrypted} onChange={(e) => setForm({ ...form, webhook_secret_encrypted: e.target.value })} placeholder="whsec_..." /></div>
                      </div>
                    </div>
                  )}

                  {/* Paystack fields */}
                  {isPaystack && (
                    <div className="space-y-4 rounded-lg border p-4">
                      <h3 className="text-sm font-semibold text-muted-foreground">Paystack Checkout Credentials</h3>
                      <p className="text-xs text-muted-foreground">Paystack will handle the checkout page. No bank account details are needed here.</p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div><Label>Paystack Public Key</Label><Input type="password" value={form.paystack_public_key} onChange={(e) => setForm({ ...form, paystack_public_key: e.target.value })} placeholder="pk_test_..." /></div>
                        <div><Label>Paystack Secret Key</Label><Input type="password" value={form.paystack_secret_key} onChange={(e) => setForm({ ...form, paystack_secret_key: e.target.value })} placeholder="sk_test_..." /></div>
                        <div><Label>Paystack Webhook Secret</Label><Input type="password" value={form.paystack_webhook_secret} onChange={(e) => setForm({ ...form, paystack_webhook_secret: e.target.value })} placeholder="whsec_..." /></div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Switch checked={form.active} onCheckedChange={(checked) => setForm({ ...form, active: checked })} />
                    <Label>Active</Label>
                  </div>
                  <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" /> Save Gateway</Button>
                </CardContent>
              </Card>
            )}

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : gateways.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <CreditCard className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No gateways configured yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {gateways.map((g) => (
                  <Card key={g.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <CreditCard className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-medium">{g.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {g.slug} · <span className="capitalize">{g.gateway_type ?? 'vpay'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={g.active ? 'bg-green-500/10 text-green-600' : 'bg-gray-500/10 text-gray-500'}>
                          {g.active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Switch checked={g.active} onCheckedChange={() => handleToggle(g)} />
                        <Button size="sm" variant="outline" onClick={() => handleEdit(g)}><Edit className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(g.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
