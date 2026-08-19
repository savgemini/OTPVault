'use client';

import { useEffect, useState } from 'react';
import { AdminSidebar } from '@/components/admin-sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Server, Trash2, Edit, Save, X, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', base_url: '', api_key_encrypted: '', priority: 0, markup_percent: 0, active: true });

  const fetchProviders = async () => {
    const { data } = await supabase.from('providers').select('*').order('priority', { ascending: true });
    setProviders(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchProviders(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.slug || !form.base_url) {
      toast.error('Name, slug, and base URL are required');
      return;
    }
    if (editing) {
      const { error } = await supabase.from('providers').update(form).eq('id', editing.id);
      if (error) toast.error('Failed to update provider');
      else toast.success('Provider updated');
    } else {
      const { error } = await supabase.from('providers').insert(form);
      if (error) toast.error('Failed to create provider');
      else toast.success('Provider created');
    }
    setEditing(null);
    setShowForm(false);
    setForm({ name: '', slug: '', base_url: '', api_key_encrypted: '', priority: 0, markup_percent: 0, active: true });
    fetchProviders();
  };

  const handleEdit = (p: any) => {
    setEditing(p);
    setForm({ name: p.name, slug: p.slug, base_url: p.base_url, api_key_encrypted: p.api_key_encrypted, priority: p.priority, markup_percent: Number(p.markup_percent), active: p.active });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('providers').delete().eq('id', id);
    if (error) toast.error('Failed to delete provider');
    else { toast.success('Provider deleted'); fetchProviders(); }
  };

  const handleToggle = async (p: any) => {
    await supabase.from('providers').update({ active: !p.active }).eq('id', p.id);
    fetchProviders();
  };

  const sync5simPrices = async (provider: any) => {
    setSyncing(provider.id);
    try {
      const { data, error } = await supabase.functions.invoke('sync-5sim-prices', { body: { provider_id: provider.id } });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Price sync failed');
      const failed = data?.failures?.length ? ` ${data.failures.length} mappings were unavailable.` : '';
      toast.success(`5sim prices synced for ${data?.updated ?? 0} mappings.${failed}`);
    } catch (err: any) {
      toast.error(err.message || 'Price sync failed');
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <div className="lg:pl-64">
        <div className="mt-16 lg:mt-0">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Number Providers</h1>
                <p className="mt-1 text-muted-foreground">Manage SMS provider integrations</p>
              </div>
              <Button onClick={() => { setEditing(null); setForm({ name: '', slug: '', base_url: '', api_key_encrypted: '', priority: 0, markup_percent: 0, active: true }); setShowForm(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Add Provider
              </Button>
            </div>

            {showForm && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    {editing ? 'Edit Provider' : 'New Provider'}
                    <Button size="icon" variant="ghost" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="5sim" /></div>
                    <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="5sim" /></div>
                    <div><Label>Base URL</Label><Input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://5sim.net" /></div>
                    <div><Label>API Key (encrypted)</Label><Input type="password" value={form.api_key_encrypted} onChange={(e) => setForm({ ...form, api_key_encrypted: e.target.value })} placeholder="sk-..." /></div>
                    <div><Label>Priority (lower = higher)</Label><Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) })} /></div>
                    <div><Label>Markup %</Label><Input type="number" step="0.01" value={form.markup_percent} onChange={(e) => setForm({ ...form, markup_percent: parseFloat(e.target.value) })} /></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.active} onCheckedChange={(checked) => setForm({ ...form, active: checked })} />
                    <Label>Active</Label>
                  </div>
                  <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" /> Save Provider</Button>
                </CardContent>
              </Card>
            )}

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <div className="grid gap-4">
                {providers.map((p) => (
                  <Card key={p.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Server className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.base_url} · Priority {p.priority} · Markup {p.markup_percent}%</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {String(p.slug).toLowerCase() === '5sim' && (
                          <Button size="sm" variant="outline" onClick={() => sync5simPrices(p)} disabled={syncing === p.id}>
                            {syncing === p.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                            Sync Prices
                          </Button>
                        )}
                        <Badge variant="outline" className={p.active ? 'bg-green-500/10 text-green-600' : 'bg-gray-500/10 text-gray-500'}>
                          {p.active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Switch checked={p.active} onCheckedChange={() => handleToggle(p)} />
                        <Button size="sm" variant="outline" onClick={() => handleEdit(p)}><Edit className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
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
