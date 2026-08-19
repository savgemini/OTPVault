'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Shield, Loader2, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', user!.id);
    setSaving(false);
    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated');
      refreshProfile();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <div className="lg:pl-64">
        <div className="mt-16 lg:mt-16">
          <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
              <p className="mt-1 text-muted-foreground">Manage your account settings</p>
            </div>

            <div className="grid gap-6">
              {/* Profile Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Account Information</CardTitle>
                  <CardDescription>Update your personal details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="h-8 w-8" />
                    </div>
                    <div>
                      <div className="font-medium">{profile?.email}</div>
                      <div className="text-sm text-muted-foreground">Member since {formatDate(profile?.created_at ?? new Date())}</div>
                      <Badge variant="outline" className="mt-1 capitalize">{profile?.role}</Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={profile?.email ?? ''} disabled />
                    <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                  </div>

                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                  </Button>
                </CardContent>
              </Card>

              {/* Wallet Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Wallet Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border p-4">
                      <div className="text-sm text-muted-foreground">Current Balance</div>
                      <div className="mt-1 text-2xl font-bold text-primary">{formatCurrency(profile?.wallet_balance ?? 0)}</div>
                    </div>
                    <div className="rounded-lg border p-4">
                      <div className="text-sm text-muted-foreground">Account Status</div>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant="outline" className={profile?.banned ? 'bg-red-500/10 text-red-600' : 'bg-green-500/10 text-green-600'}>
                          {profile?.banned ? 'Banned' : 'Active'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Security */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" /> Security
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Your account is secured with email and password authentication. If you need to reset your password,
                    use the forgot password link on the sign-in page.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
