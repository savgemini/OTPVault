'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Smartphone, Loader2, ArrowLeft, MailCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
      toast.success('Password reset link sent to your email');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute inset-0 grid-bg opacity-10" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Smartphone className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold">OTPSuite</span>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reset your password</CardTitle>
            <CardDescription>
              {sent ? "Check your email for the reset link" : "Enter your email and we'll send you a reset link"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <MailCheck className="h-12 w-12 text-green-500" />
                <p className="text-sm text-muted-foreground">
                  We've sent a password reset link to <strong className="text-foreground">{email}</strong>.
                  Check your inbox and follow the link to reset your password.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Reset Link
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <div className="text-sm text-muted-foreground">
              Remember your password?{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </div>
            <Link href="/" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-1 h-3 w-3" /> Back to home
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
