'use client';

import { useEffect, useState } from 'react';
import { AdminSidebar } from '@/components/admin-sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Globe, Trash2, Edit, Save, X, Smartphone } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function AdminServicesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState('services');
  const [form, setForm] = useState({ name: '', slug: '', provider_id: '', active: true });
  const [countryPrices, setCountryPrices] = useState<Record<string, number>>({});
  const [countryMaxPrices, setCountryMaxPrices] = useState<Record<string, number>>({});
  const [countryForm, setCountryForm] = useState({ name: '', code: '', flag: '', sort_order: 0, active: true });

  const fetchData = async () => {
    const [{ data: svcs }, { data: ctrys }, { data: provs }] = await Promise.all([
      supabase.from('services').select('*').order('sort_order'),
      supabase.from('countries').select('*').order('sort_order'),
      supabase.from('providers').select('id, name, slug, active').order('priority'),
    ]);
    setServices(svcs ?? []);
    setCountries(ctrys ?? []);
    setProviders(provs ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const selectedProvider = providers.find((provider) => provider.id === form.provider_id);
  const is5sim = selectedProvider?.slug?.toLowerCase() === '5sim';

  const handleSaveService = async () => {
    if (!form.name || !form.slug || !form.provider_id) {
      toast.error('Name, slug, and provider are required');
      return;
    }

    const countriesToAssign = countries.filter((country) => country.active && typeof countryPrices[country.id] === 'number');
    const validCountryPrices = countriesToAssign.filter((country) => Number(countryPrices[country.id]) >= 0);

    if (!validCountryPrices.length) {
      toast.error('Add at least one price for an active country');
      return;
    }

    const invalidMaxPrice = validCountryPrices.find((country) => {
      const ourPrice = Number(countryPrices[country.id] || 0);
      const maxPrice = Number(countryMaxPrices[country.id] ?? ourPrice ?? 0);
      return maxPrice > 0 && maxPrice < ourPrice;
    });

    if (invalidMaxPrice) {
      toast.error(`Max price must be at least the selling price for ${countries.find((country) => country.id === invalidMaxPrice.id)?.name ?? 'this country'}`);
      return;
    }

    let serviceId = editing?.id;
    if (editing) {
      const { provider_id, active, ...serviceForm } = form;
      const { error } = await supabase.from('services').update({ ...serviceForm, active }).eq('id', editing.id);
      if (error) {
        toast.error('Failed to update service');
        return;
      }
    } else {
      const { provider_id, active, ...serviceForm } = form;
      const { data, error } = await supabase.from('services').insert({ ...serviceForm, active }).select('id').single();
      serviceId = data?.id;
      if (error) {
        toast.error('Failed to create service');
        return;
      }
    }

    const relationRows = validCountryPrices.map((country) => ({
      provider_id: form.provider_id,
      service_id: serviceId,
      country_id: country.id,
      provider_price: 0,
      our_price: Number(countryPrices[country.id] || 0),
      max_price: Number(countryMaxPrices[country.id] ?? countryPrices[country.id] ?? 0),
      stock: 0,
      active: true,
    }));

    const { error: relationError } = await supabase.from('provider_services').upsert(
      relationRows,
      { onConflict: 'provider_id,service_id,country_id' }
    );

    if (relationError) {
      toast.error('Service saved, but country pricing failed');
      return;
    }

    toast.success(editing ? 'Service updated' : 'Service created');
    setEditing(null);
    setShowForm(false);
    setForm({ name: '', slug: '', provider_id: '', active: true });
    setCountryPrices({});
    setCountryMaxPrices({});
    fetchData();
  };

  const handleSaveCountry = async () => {
    if (!countryForm.name || !countryForm.code) { toast.error('Name and code are required'); return; }
    if (editing) {
      const { error } = await supabase.from('countries').update(countryForm).eq('id', editing.id);
      if (error) toast.error('Failed to update'); else toast.success('Country updated');
    } else {
      const { error } = await supabase.from('countries').insert(countryForm);
      if (error) toast.error('Failed to create'); else toast.success('Country created');
    }
    setEditing(null); setShowForm(false);
    setCountryForm({ name: '', code: '', flag: '', sort_order: 0, active: true });
    fetchData();
  };

  const handleDeleteService = async (id: string) => {
    await supabase.from('services').delete().eq('id', id);
    fetchData();
    toast.success('Service deleted');
  };

  const handleDeleteCountry = async (id: string) => {
    await supabase.from('countries').delete().eq('id', id);
    fetchData();
    toast.success('Country deleted');
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <div className="lg:pl-64">
        <div className="mt-16 lg:mt-0">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight">Services Catalog</h1>
              <p className="mt-1 text-muted-foreground">Manage apps/services and countries</p>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="services">Services</TabsTrigger>
                <TabsTrigger value="countries">Countries</TabsTrigger>
              </TabsList>

              {/* Services Tab */}
              <TabsContent value="services">
                <div className="mb-4">
                  <Button onClick={() => { setEditing(null); setForm({ name: '', slug: '', provider_id: '', active: true }); setCountryPrices({}); setCountryMaxPrices({}); setShowForm(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> Add Service
                  </Button>
                </div>

                {showForm && tab === 'services' && (
                  <Card className="mb-4">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center justify-between">
                        {editing ? 'Edit Service' : 'New Service'}
                        <Button size="icon" variant="ghost" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="WhatsApp" /></div>
                        <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="whatsapp" /></div>
                        <div className="sm:col-span-2">
                          <Label>Provider</Label>
                          <Select value={form.provider_id} onValueChange={(value) => setForm({ ...form, provider_id: value })}>
                            <SelectTrigger><SelectValue placeholder="Choose provider" /></SelectTrigger>
                            <SelectContent>{providers.filter((provider) => provider.active).map((provider) => <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="rounded-lg border p-3">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-medium">Country pricing</h3>
                          <span className="text-xs text-muted-foreground">Set your selling price and Tiger max price per country</span>
                        </div>
                        <div className="space-y-3">
                          {countries.filter((country) => country.active).map((country) => (
                            <div key={country.id} className="grid grid-cols-[1fr_120px_120px] items-center gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{country.flag}</span>
                                <span className="text-sm font-medium">{country.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="Our price"
                                  value={countryPrices[country.id] ?? ''}
                                  onChange={(e) => setCountryPrices((prev) => ({
                                    ...prev,
                                    [country.id]: e.target.value === '' ? 0 : Number(e.target.value),
                                  }))}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="Max price"
                                  value={countryMaxPrices[country.id] ?? countryPrices[country.id] ?? ''}
                                  onChange={(e) => setCountryMaxPrices((prev) => ({
                                    ...prev,
                                    [country.id]: e.target.value === '' ? 0 : Number(e.target.value),
                                  }))}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {is5sim && <p className="text-xs text-muted-foreground">For 5sim, keep only the country price here. Stock is synced separately.</p>}
                      <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(c) => setForm({ ...form, active: c })} /><Label>Active</Label></div>
                      <Button onClick={handleSaveService}><Save className="mr-2 h-4 w-4" /> Save</Button>
                    </CardContent>
                  </Card>
                )}

                {loading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {services.map((s) => (
                      <Card key={s.id}>
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            <Smartphone className="h-5 w-5 text-primary" />
                            <div>
                              <div className="font-medium">{s.name}</div>
                              <div className="text-xs text-muted-foreground">{s.slug}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={s.active ? 'bg-green-500/10 text-green-600' : 'bg-gray-500/10'}>{s.active ? 'On' : 'Off'}</Badge>
                            <Button size="sm" variant="outline" onClick={async () => {
                              const { data: relation } = await supabase.from('provider_services').select('*').eq('service_id', s.id).limit(1).maybeSingle();
                              setEditing(s);
                              const { data: relations } = await supabase
                                .from('provider_services')
                                .select('*')
                                .eq('service_id', s.id)
                                .order('updated_at', { ascending: false });
                              const nextCountryPrices: Record<string, number> = {};
                              const nextCountryMaxPrices: Record<string, number> = {};
                              (relations ?? []).forEach((rel) => {
                                nextCountryPrices[rel.country_id] = Number(rel.our_price ?? 0);
                                nextCountryMaxPrices[rel.country_id] = Number(rel.max_price ?? rel.our_price ?? 0);
                              });
                              setForm({ name: s.name, slug: s.slug, provider_id: relation?.provider_id ?? '', active: s.active });
                              setCountryPrices(nextCountryPrices);
                              setCountryMaxPrices(nextCountryMaxPrices);
                              setShowForm(true);
                            }}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteService(s.id)}>
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Countries Tab */}
              <TabsContent value="countries">
                <div className="mb-4">
                  <Button onClick={() => { setEditing(null); setCountryForm({ name: '', code: '', flag: '', sort_order: 0, active: true }); setShowForm(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> Add Country
                  </Button>
                </div>

                {showForm && tab === 'countries' && (
                  <Card className="mb-4">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center justify-between">
                        {editing ? 'Edit Country' : 'New Country'}
                        <Button size="icon" variant="ghost" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div><Label>Name</Label><Input value={countryForm.name} onChange={(e) => setCountryForm({ ...countryForm, name: e.target.value })} placeholder="Nigeria" /></div>
                        <div><Label>Code</Label><Input value={countryForm.code} onChange={(e) => setCountryForm({ ...countryForm, code: e.target.value.toUpperCase() })} placeholder="NG" /></div>
                        <div><Label>Flag Emoji</Label><Input value={countryForm.flag} onChange={(e) => setCountryForm({ ...countryForm, flag: e.target.value })} placeholder="🇳🇬" /></div>
                        <div><Label>Sort Order</Label><Input type="number" value={countryForm.sort_order} onChange={(e) => setCountryForm({ ...countryForm, sort_order: parseInt(e.target.value) })} /></div>
                      </div>
                      <div className="flex items-center gap-2"><Switch checked={countryForm.active} onCheckedChange={(c) => setCountryForm({ ...countryForm, active: c })} /><Label>Active</Label></div>
                      <Button onClick={handleSaveCountry}><Save className="mr-2 h-4 w-4" /> Save</Button>
                    </CardContent>
                  </Card>
                )}

                {loading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {countries.map((c) => (
                      <Card key={c.id}>
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{c.flag}</span>
                            <div>
                              <div className="font-medium">{c.name}</div>
                              <div className="text-xs text-muted-foreground">{c.code}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" onClick={() => { setEditing(c); setCountryForm({ name: c.name, code: c.code, flag: c.flag, sort_order: c.sort_order, active: c.active }); setShowForm(true); }}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteCountry(c.id)}>
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
