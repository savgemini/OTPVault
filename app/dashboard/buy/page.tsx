'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Smartphone, Search, Loader2, MessageSquare, RefreshCw, X, CheckCircle2, Clock, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDateTime, timeAgo, statusColor } from '@/lib/format';
import { toast } from 'sonner';

type Service = { id: string; name: string; slug: string };
type Country = { id: string; name: string; code: string; flag: string };
type Offer = {
  provider_id: string;
  provider_name: string;
  our_price: number;
  stock: number;
  provider_service_id: string;
};

export default function BuyNumbersPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedServiceUsa, setSelectedServiceUsa] = useState<string>('');
  const [selectedServiceOther, setSelectedServiceOther] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [offersUsa, setOffersUsa] = useState<Offer[]>([]);
  const [offersOther, setOffersOther] = useState<Offer[]>([]);
  const [offerError, setOfferError] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [purchasingUsa, setPurchasingUsa] = useState<string | null>(null);
  const [purchasingOther, setPurchasingOther] = useState<string | null>(null);
  const [activeNumber, setActiveNumber] = useState<any | null>(null);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [polling, setPolling] = useState(false);
  const [cancelingActiveNumber, setCancelingActiveNumber] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [usaCountryId, setUsaCountryId] = useState<string>('');
  const [usaServicesWithPrices, setUsaServicesWithPrices] = useState<any[]>([]);
  const [otherServicesWithPrices, setOtherServicesWithPrices] = useState<any[]>([]);

  const isUsaCountry = (country: Country) => {
    const code = country.code?.trim().toUpperCase();
    const name = country.name?.trim().toUpperCase();
    return code === 'US' || code === 'USA' || name === 'USA' || name === 'UNITED STATES' || name === 'UNITED STATES OF AMERICA';
  };

  // Restore active number and SMS logs from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('activeNumber');
    if (saved) {
      setActiveNumber(JSON.parse(saved));
    }
    const savedLogs = localStorage.getItem('activeSmsLogs');
    if (savedLogs) {
      setSmsLogs(JSON.parse(savedLogs));
    }
  }, []);

  // Persist active number to localStorage
  useEffect(() => {
    if (activeNumber) {
      localStorage.setItem('activeNumber', JSON.stringify(activeNumber));
    } else {
      localStorage.removeItem('activeNumber');
    }
  }, [activeNumber]);

  // Persist SMS logs to localStorage
  useEffect(() => {
    if (smsLogs.length > 0) {
      localStorage.setItem('activeSmsLogs', JSON.stringify(smsLogs));
    } else {
      localStorage.removeItem('activeSmsLogs');
    }
  }, [smsLogs]);

  // Timer countdown and auto-cancel
  useEffect(() => {
    if (!activeNumber) return;

    // Calculate time remaining (10 minutes = 600 seconds)
    const createdAt = new Date(activeNumber.created_at).getTime();
    const expiresAt = createdAt + 10 * 60 * 1000; // 10 minutes
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
    setTimeRemaining(remaining);

    // If time expired, auto-cancel
    if (remaining <= 0) {
      handleCancel();
      return;
    }

    // Countdown timer
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleCancel();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeNumber?.id]);

  // Initialize services and countries, find USA country
  useEffect(() => {
    (async () => {
      try {
        const [{ data: svcs }, { data: ctrys }] = await Promise.all([
          supabase.from('services').select('*').eq('active', true).order('sort_order'),
          supabase.from('countries').select('*').eq('active', true).order('sort_order'),
        ]);
        setServices(svcs ?? []);
        setCountries(ctrys ?? []);
        
        // Find USA country and load its services
        const usa = (ctrys ?? []).find(isUsaCountry);
        if (usa) {
          setUsaCountryId(usa.id);
          
          // Fetch USA services
          const { data: usaServices, error: usaServicesError } = await supabase
            .from('provider_services')
            .select(`
              service_id,
              our_price,
              services(id, name, slug)
            `)
            .eq('country_id', usa.id)
            .eq('active', true);

          if (usaServices) {
            const servicesMap = new Map<string, any>();
            usaServices.forEach((ps: any) => {
              if (ps.services && !servicesMap.has(ps.service_id)) {
                servicesMap.set(ps.service_id, {
                  id: ps.services.id,
                  name: ps.services.name,
                  slug: ps.services.slug,
                  price: Number(ps.our_price),
                });
              }
            });
            const sorted = Array.from(servicesMap.values()).sort((a, b) => a.price - b.price);
            setUsaServicesWithPrices(sorted);
          } else {
            console.error('Failed to load USA services:', usaServicesError);
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Failed to load initial data:', err);
        setLoading(false);
      }
    })();
  }, []);

  const searchOffers = useCallback(async (serviceId: string, countryId: string) => {
    if (!serviceId || !countryId) return;
    setSearching(true);
    setOfferError('');

    try {
      const { data: providerServices, error } = await supabase
        .from('provider_services')
        .select(`
          id, our_price, stock, active, provider_id,
          providers!inner(name, active)
        `)
        .eq('service_id', serviceId)
        .eq('country_id', countryId)
        .eq('active', true)
        .eq('providers.active', true)
        .order('our_price', { ascending: true });

      if (error) {
        setOfferError(error.message);
        setSearching(false);
        return;
      }

      const mapped: Offer[] = (providerServices ?? []).map((ps: any) => ({
        provider_id: ps.provider_id,
        provider_name: ps.providers.name,
        our_price: Number(ps.our_price),
        stock: ps.stock,
        provider_service_id: ps.id,
      }));

      // Set offers based on which country
      if (countryId === usaCountryId) {
        setOffersUsa(mapped);
      } else {
        setOffersOther(mapped);
      }
    } catch (err: any) {
      setOfferError(err.message);
    } finally {
      setSearching(false);
    }
  }, [usaCountryId]);

  // Fetch services with prices for a country
  const fetchServicesWithPrices = useCallback(async (countryId: string) => {
    try {
      const { data, error } = await supabase
        .from('provider_services')
        .select(`
          service_id,
          our_price,
          services(id, name, slug)
        `)
        .eq('country_id', countryId)
        .eq('active', true);

      if (!error && data) {
        const servicesMap = new Map<string, any>();
        data.forEach((ps: any) => {
          if (ps.services && !servicesMap.has(ps.service_id)) {
            servicesMap.set(ps.service_id, {
              id: ps.services.id,
              name: ps.services.name,
              slug: ps.services.slug,
              price: Number(ps.our_price),
            });
          }
        });
        const svcs = Array.from(servicesMap.values()).sort((a, b) => a.price - b.price);
        setOtherServicesWithPrices(svcs);
      }
    } catch (err: any) {
      console.error('Failed to fetch services:', err);
    }
  }, []);

  const handlePurchase = async (offer: Offer, isUsa: boolean = true) => {
    if (!user) return;
    if (!profile || profile.wallet_balance < offer.our_price) {
      toast.error('Insufficient wallet balance. Please fund your wallet first.');
      return;
    }

    if (isUsa) {
      setPurchasingUsa(offer.provider_service_id);
    } else {
      setPurchasingOther(offer.provider_service_id);
    }

    try {
      const countryId = isUsa ? usaCountryId : selectedCountry;
      const serviceId = isUsa ? selectedServiceUsa : selectedServiceOther;

      const { data, error } = await supabase.functions.invoke('purchase-number', {
        body: {
          provider_service_id: offer.provider_service_id,
          service_id: serviceId,
          country_id: countryId,
          cost: offer.our_price,
        },
      });

      if (error || data?.error) {
        let message = data?.error || error?.message || 'Purchase failed';
        if (error && 'context' in error && error.context) {
          try {
            const responseBody = await (error.context as Response).json();
            message = responseBody?.error || message;
          } catch {
            // Keep the generic function error when the response is not JSON.
          }
        }
        throw new Error(message);
      }

      toast.success('Number purchased successfully!');
      setActiveNumber(data.number);
      localStorage.setItem('activeNumber', JSON.stringify(data.number));
      await refreshProfile();
      setSelectedServiceUsa('');
      setSelectedServiceOther('');
      setSelectedCountry('');
      setOffersUsa([]);
      setOffersOther([]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to purchase number');
    } finally {
      if (isUsa) {
        setPurchasingUsa(null);
      } else {
        setPurchasingOther(null);
      }
    }
  };

  // Auto-search for USA when service is selected
  useEffect(() => {
    if (selectedServiceUsa && usaCountryId) {
      searchOffers(selectedServiceUsa, usaCountryId);
    }
  }, [selectedServiceUsa, usaCountryId, searchOffers]);

  // Auto-search for Other Countries when service and country are selected
  useEffect(() => {
    if (selectedServiceOther && selectedCountry && selectedCountry !== usaCountryId) {
      searchOffers(selectedServiceOther, selectedCountry);
    }
  }, [selectedServiceOther, selectedCountry, usaCountryId, searchOffers]);

  // Fetch services with prices when other country changes
  useEffect(() => {
    if (selectedCountry && selectedCountry !== usaCountryId) {
      fetchServicesWithPrices(selectedCountry);
      setSelectedServiceOther('');
      setOffersOther([]);
    }
  }, [selectedCountry, usaCountryId, fetchServicesWithPrices]);

  // Poll for SMS on active number
  useEffect(() => {
    if (!activeNumber) return;
    let interval: NodeJS.Timeout;

    const poll = async () => {
      setPolling(true);

      const [{ data: logs }, statusResult] = await Promise.all([
        supabase
          .from('sms_logs')
          .select('*')
          .eq('number_id', activeNumber.id)
          .order('created_at', { ascending: false }),
        supabase.functions.invoke('tiger-sms-status', {
          body: { number_id: activeNumber.id },
        }),
      ]);

      if (logs && logs.length > 0) {
        setSmsLogs(logs);
      }

      const { data: num } = await supabase
        .from('numbers')
        .select('*')
        .eq('id', activeNumber.id)
        .maybeSingle();

      if (num && (num.status === 'completed' || num.status === 'cancelled' || num.status === 'expired')) {
        clearInterval(interval);
        setActiveNumber((prev: any) => ({ ...prev, ...num }));
        // Don't clear localStorage here - keep showing the completed/expired number
      }

      if (statusResult?.data?.success && statusResult.data.code) {
        const { data: refreshedLogs } = await supabase
          .from('sms_logs')
          .select('*')
          .eq('number_id', activeNumber.id)
          .order('created_at', { ascending: false });

        if (refreshedLogs) {
          setSmsLogs(refreshedLogs);
        }
      }

      setPolling(false);
    };

    poll();
    interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [activeNumber?.id]);

  const handleCancel = async () => {
    if (!activeNumber || cancelingActiveNumber) return;
    setCancelingActiveNumber(true);

    try {
      const { data, error } = await supabase.functions.invoke('cancel-number', {
        body: { number_id: activeNumber.id },
      });
      if (error || data?.error) throw new Error(data?.error || 'Cancel failed');
      toast.success('Number cancelled and wallet refunded');
      await refreshProfile();
      setActiveNumber(null);
      setSmsLogs([]);
      localStorage.removeItem('activeNumber');
      localStorage.removeItem('activeSmsLogs');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCancelingActiveNumber(false);
    }
  };

  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatTimeRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <div className="lg:pl-64">
        <div className="mt-16 lg:mt-16">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight">Buy a Number</h1>
              <p className="mt-1 text-muted-foreground">Choose a country and service to get started</p>
            </div>

            <div className="mb-6 flex items-center gap-3 rounded-lg border bg-primary/5 px-4 py-3">
              <Wallet className="h-5 w-5 text-primary" />
              <span className="text-sm">Wallet Balance: <strong className="text-primary">{formatCurrency(profile?.wallet_balance ?? 0)}</strong></span>
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => window.location.href = '/dashboard/wallet'}>
                Fund Wallet
              </Button>
            </div>

            {/* Active Number / SMS Inbox */}
            {activeNumber && (
              <Card className="mb-6 border-primary">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Smartphone className="h-5 w-5 text-primary" /> Your Number
                      </CardTitle>
                      <CardDescription>Use this number to receive your verification code</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={statusColor(activeNumber.status)}>
                        {activeNumber.status}
                      </Badge>
                      <Badge variant={timeRemaining <= 60 ? 'destructive' : 'secondary'} className="font-mono">
                        ⏱ {formatTimeRemaining(timeRemaining)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="text-xs text-muted-foreground">Phone Number</div>
                    <div className="mt-1 font-mono text-2xl font-bold tracking-wider">
                      {activeNumber.phone_number || 'Waiting for number...'}
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> Expires in: <span className="font-semibold">{formatTimeRemaining(timeRemaining)}</span>
                    </div>
                  </div>

                  {/* SMS Inbox */}
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <MessageSquare className="h-4 w-4" /> SMS Inbox
                        {polling && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                      </div>
                      {(activeNumber.status === 'active' || activeNumber.status === 'pending') && (
                        <Button size="sm" variant="ghost" onClick={handleCancel} disabled={cancelingActiveNumber}>
                          {cancelingActiveNumber ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <X className="mr-1 h-3 w-3" />
                          )}
                          {cancelingActiveNumber ? 'Cancelling...' : 'Cancel & Refund'}
                        </Button>
                      )}
                    </div>

                    {smsLogs.length === 0 ? (
                      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-8 text-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Waiting for SMS... Codes appear here automatically</p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={async () => {
                            setPolling(true);
                            try {
                              const { data: statusResult } = await supabase.functions.invoke('tiger-sms-status', {
                                body: { number_id: activeNumber.id },
                              });
                              
                              if (statusResult?.success) {
                                const { data: logs } = await supabase
                                  .from('sms_logs')
                                  .select('*')
                                  .eq('number_id', activeNumber.id)
                                  .order('created_at', { ascending: false });
                                if (logs && logs.length > 0) {
                                  setSmsLogs(logs);
                                }
                              }
                            } catch (err: any) {
                              console.error('Manual status check failed:', err);
                            } finally {
                              setPolling(false);
                            }
                          }}
                          disabled={polling}
                        >
                          {polling ? 'Checking...' : 'Check Status Now'}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {smsLogs.map((sms) => (
                          <div key={sms.id} className="flex items-start gap-3 rounded-lg border bg-green-500/5 p-3">
                            <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-500 shrink-0" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{sms.sender || 'Unknown'}</span>
                                <span className="text-xs text-muted-foreground">{timeAgo(sms.created_at)}</span>
                              </div>
                              <p className="mt-1 text-sm">{sms.message}</p>
                              {sms.code && (
                                <div className="mt-2 inline-block rounded bg-primary/10 px-3 py-1 font-mono text-lg font-bold text-primary">
                                  Code: {sms.code}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button variant="outline" size="sm" className="mt-4" onClick={() => { setActiveNumber(null); setSmsLogs([]); localStorage.removeItem('activeNumber'); localStorage.removeItem('activeSmsLogs'); }}>
                    Buy another number
                  </Button>
                </CardContent>
              </Card>
            )}

            {!activeNumber && (
              <div className="grid gap-8 lg:grid-cols-2">
                {/* USA Numbers Section */}
                <div>
                  <h2 className="mb-4 text-xl font-bold">🇺🇸 USA Numbers</h2>
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Select a Service</CardTitle>
                        <CardDescription>Choose a service to get a US number</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {loading ? (
                          <Skeleton className="h-10 w-full" />
                        ) : usaServicesWithPrices.length > 0 ? (
                          <Select value={selectedServiceUsa} onValueChange={setSelectedServiceUsa}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a service" />
                            </SelectTrigger>
                            <SelectContent>
                              {usaServicesWithPrices.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name} • {formatCurrency(s.price)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="rounded-lg border border-dashed bg-muted/30 py-8 text-center">
                            <p className="text-sm text-muted-foreground">No USA services available</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Offers for USA */}
                    {selectedServiceUsa && offersUsa.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Available Providers</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {offersUsa.map((offer) => (
                              <div key={offer.provider_service_id} className="flex items-center justify-between rounded-lg border p-4">
                                <div>
                                  <div className="font-medium">{offer.provider_name}</div>
                                  <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <span className="h-2 w-2 rounded-full bg-green-500" /> {offer.stock > 0 ? `${offer.stock} in stock` : 'Available'}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <div className="text-lg font-bold">{formatCurrency(offer.our_price)}</div>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => handlePurchase(offer, true)}
                                    disabled={purchasingUsa === offer.provider_service_id}
                                  >
                                    {purchasingUsa === offer.provider_service_id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buy'}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {selectedServiceUsa && !searching && offersUsa.length === 0 && (
                      <div className="rounded-lg border border-dashed py-8 text-center">
                        <Smartphone className="mx-auto h-10 w-10 text-muted-foreground" />
                        <p className="mt-3 text-sm text-muted-foreground">{offerError || 'No available providers for this service.'}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Other Countries Section */}
                <div>
                  <h2 className="mb-4 text-xl font-bold">🌍 Other Countries</h2>
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Select Country & Service</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {loading ? (
                          <>
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                          </>
                        ) : (
                          <>
                            <div>
                              <Label className="mb-2 block text-sm">Country</Label>
                              <Select 
                                value={selectedCountry}
                                onValueChange={(value) => {
                                  setSelectedCountry(value);
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose a country" />
                                </SelectTrigger>
                                <SelectContent>
                                  {countries.filter((c) => !isUsaCountry(c)).map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                      <span className="mr-2">{c.flag}</span> {c.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label className="mb-2 block text-sm">Service</Label>
                              {!selectedCountry ? (
                                <div className="rounded-lg border border-dashed bg-muted/30 py-8 text-center">
                                  <p className="text-sm text-muted-foreground">Select a country first</p>
                                </div>
                              ) : otherServicesWithPrices.length > 0 ? (
                                <Select value={selectedServiceOther} onValueChange={setSelectedServiceOther}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Choose a service" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {otherServicesWithPrices.map((s) => (
                                      <SelectItem key={s.id} value={s.id}>
                                        {s.name} • {formatCurrency(s.price)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="rounded-lg border border-dashed bg-muted/30 py-8 text-center">
                                  <p className="text-sm text-muted-foreground">No services available for this country</p>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Offers for Other Countries */}
                    {selectedServiceOther && offersOther.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Available Providers</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {offersOther.map((offer) => (
                              <div key={offer.provider_service_id} className="flex items-center justify-between rounded-lg border p-4">
                                <div>
                                  <div className="font-medium">{offer.provider_name}</div>
                                  <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <span className="h-2 w-2 rounded-full bg-green-500" /> {offer.stock > 0 ? `${offer.stock} in stock` : 'Available'}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <div className="text-lg font-bold">{formatCurrency(offer.our_price)}</div>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => handlePurchase(offer, false)}
                                    disabled={purchasingOther === offer.provider_service_id}
                                  >
                                    {purchasingOther === offer.provider_service_id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buy'}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {selectedServiceOther && !searching && offersOther.length === 0 && (
                      <div className="rounded-lg border border-dashed py-8 text-center">
                        <Smartphone className="mx-auto h-10 w-10 text-muted-foreground" />
                        <p className="mt-3 text-sm text-muted-foreground">{offerError || 'No active provider is configured for this service and country.'}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
