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
  const [form, setForm] = useState({ name: '', slug: '', provider_id: '', country_id: '', provider_price: 0, our_price: 0, stock: 0, sort_order: 0, active: true });
  const [allCountries, setAllCountries] = useState(false);
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
    if (!form.name || !form.slug || !form.provider_id || (!form.country_id && !allCountries)) { toast.error('Name, slug, provider, and country are required'); return; }
    let serviceId = editing?.id;
    if (editing) {
      const { provider_id, country_id, provider_price, our_price, stock, ...serviceForm } = form;
      const { error } = await supabase.from('services').update(serviceForm).eq('id', editing.id);
      if (error) toast.error('Failed to update'); else toast.success('Service updated');
    } else {
      const { provider_id, country_id, provider_price, our_price, stock, ...serviceForm } = form;
      const { data, error } = await supabase.from('services').insert(serviceForm).select('id').single();
      serviceId = data?.id;
      if (error) { toast.error('Failed to create'); return; }
    }
    const countriesToAssign = allCountries ? countries.filter((country) => country.active) : countries.filter((country) => country.id === form.country_id);
    const { error: relationError } = await supabase.from('provider_services').upsert(
      countriesToAssign.map((country) => ({
        provider_id: form.provider_id,
        service_id: serviceId,
        country_id: country.id,
        provider_price: form.provider_price,
        our_price: form.our_price,
        stock: form.stock,
        active: form.active,
      })),
      { onConflict: 'provider_id,service_id,country_id' }
    );
    if (relationError) { toast.error('Service saved, but provider assignment failed'); return; }
    toast.success(editing ? 'Service updated' : 'Service created');
    setEditing(null); setShowForm(false);
    setForm({ name: '', slug: '', provider_id: '', country_id: '', provider_price: 0, our_price: 0, stock: 0, sort_order: 0, active: true });
    setAllCountries(false);
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
                  <Button onClick={() => { setEditing(null); setForm({ name: '', slug: '', provider_id: '', country_id: '', provider_price: 0, our_price: 0, stock: 0, sort_order: 0, active: true }); setAllCountries(false); setShowForm(true); }}>
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
                        <div>
                          <Label>Provider</Label>
                          <Select value={form.provider_id} onValueChange={(value) => setForm({ ...form, provider_id: value })}>
                            <SelectTrigger><SelectValue placeholder="Choose provider" /></SelectTrigger>
                            <SelectContent>{providers.filter((provider) => provider.active).map((provider) => <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Country</Label>
                          <Select value={allCountries ? 'all' : form.country_id} onValueChange={(value) => { setAllCountries(value === 'all'); setForm({ ...form, country_id: value === 'all' ? '' : value }); }}>
                            <SelectTrigger><SelectValue placeholder="Choose country" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All active countries</SelectItem>
                              {countries.filter((country) => country.active).map((country) => <SelectItem key={country.id} value={country.id}>{country.flag} {country.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        {!is5sim && <div><Label>Provider Price</Label><Input type="number" min="0" step="0.01" value={form.provider_price} onChange={(e) => setForm({ ...form, provider_price: parseFloat(e.target.value) || 0 })} /></div>}
                        {!is5sim && <div><Label>Our Price</Label><Input type="number" min="0" step="0.01" value={form.our_price} onChange={(e) => setForm({ ...form, our_price: parseFloat(e.target.value) || 0 })} /></div>}
                        <div><Label>Stock</Label><Input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} /></div>
                        <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) })} /></div>
                      </div>
                      {is5sim && <p className="text-xs text-muted-foreground">5sim prices and stock are filled automatically. Use Sync Prices on the 5sim provider after saving.</p>}
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
                              setAllCountries(false);
                              setForm({ name: s.name, slug: s.slug, provider_id: relation?.provider_id ?? '', country_id: relation?.country_id ?? '', provider_price: Number(relation?.provider_price ?? 0), our_price: Number(relation?.our_price ?? 0), stock: Number(relation?.stock ?? 0), sort_order: s.sort_order, active: s.active });
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
