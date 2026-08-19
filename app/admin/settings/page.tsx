'use client';

import { useEffect, useState } from 'react';
import { AdminSidebar } from '@/components/admin-sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('settings').select('*');
      const map: Record<string, string> = {};
      (data ?? []).forEach((s) => { map[s.key] = s.value; });
      setSettings(map);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    for (const [key, value] of Object.entries(settings)) {
      await supabase.from('settings').upsert({
        key,
        value,
        is_public: ['site_name', 'site_tagline', 'currency', 'currency_symbol', 'maintenance_mode', 'support_email', 'footer_text'].includes(key),
      }, { onConflict: 'key' });
    }
    setSaving(false);
    toast.success('Settings saved');
  };

  const fields = [
    { key: 'site_name', label: 'Site Name', type: 'text' },
    { key: 'site_tagline', label: 'Site Tagline', type: 'text' },
    { key: 'currency', label: 'Currency Code', type: 'text' },
    { key: 'currency_symbol', label: 'Currency Symbol', type: 'text' },
    { key: 'min_deposit', label: 'Minimum Deposit', type: 'number' },
    { key: 'support_email', label: 'Support Email', type: 'email' },
    { key: 'footer_text', label: 'Footer Text', type: 'text' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <div className="lg:pl-64">
        <div className="mt-16 lg:mt-0">
          <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight">Site Settings</h1>
              <p className="mt-1 text-muted-foreground">Configure platform-wide settings</p>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" /> General Settings
                  </CardTitle>
                  <CardDescription>Changes apply immediately after saving</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {fields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={field.key}>{field.label}</Label>
                      <Input
                        id={field.key}
                        type={field.type}
                        value={settings[field.key] ?? ''}
                        onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                      />
                    </div>
                  ))}

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <Label>Maintenance Mode</Label>
                      <p className="text-xs text-muted-foreground">Disable the platform for all users</p>
                    </div>
                    <Switch
                      checked={settings.maintenance_mode === 'true'}
                      onCheckedChange={(checked) => setSettings({ ...settings, maintenance_mode: checked ? 'true' : 'false' })}
                    />
                  </div>

                  <Button onClick={handleSave} disabled={saving} className="w-full">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save All Settings
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
