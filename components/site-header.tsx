'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Smartphone, Wallet, LayoutDashboard } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function SiteHeader() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { href: '/#services', label: 'Services' },
    { href: '/#how-it-works', label: 'How It Works' },
    { href: '/#pricing', label: 'Pricing' },
    { href: '/#faq', label: 'FAQ' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Smartphone className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">OTPSuite</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          {user ? (
            <div className="flex items-center gap-2">
              {profile?.role === 'admin' && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin">
                    <LayoutDashboard className="mr-1 h-4 w-4" /> Admin
                  </Link>
                </Button>
              )}
              <Button size="sm" asChild>
                <Link href="/dashboard">
                  <Wallet className="mr-1 h-4 w-4" />
                  {profile ? `₦${profile.wallet_balance.toFixed(2)}` : 'Dashboard'}
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Get Started</Link>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="mt-8 flex flex-col gap-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="text-base font-medium text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="my-2 h-px bg-border" />
                {user ? (
                  <>
                    <Button asChild onClick={() => setOpen(false)}>
                      <Link href="/dashboard">Dashboard</Link>
                    </Button>
                    {profile?.role === 'admin' && (
                      <Button variant="outline" asChild onClick={() => setOpen(false)}>
                        <Link href="/admin">Admin Panel</Link>
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Button variant="outline" asChild onClick={() => setOpen(false)}>
                      <Link href="/login">Sign In</Link>
                    </Button>
                    <Button asChild onClick={() => setOpen(false)}>
                      <Link href="/register">Get Started</Link>
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
