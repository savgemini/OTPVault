'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Smartphone, LayoutDashboard, Wallet, ListOrdered, User,
  LogOut, Menu, Shield, HeadphonesIcon,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/buy', label: 'Buy Numbers', icon: Smartphone },
  { href: '/dashboard/wallet', label: 'Wallet', icon: Wallet },
  { href: '/dashboard/numbers', label: 'My Numbers', icon: ListOrdered },
  { href: '/dashboard/transactions', label: 'Transactions', icon: ListOrdered },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
];

export function DashboardSidebar() {
  const { profile, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Smartphone className="h-4 w-4" />
          </div>
          <span className="font-bold">OTPSuite</span>
        </Link>
      </div>

      <div className="border-b p-4">
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="text-xs text-muted-foreground">Wallet Balance</div>
          <div className="mt-1 text-2xl font-bold text-primary">
            ₦{profile?.wallet_balance.toFixed(2) ?? '0.00'}
          </div>
          <Button size="sm" className="mt-2 w-full" asChild>
            <Link href="/dashboard/wallet">Fund Wallet</Link>
          </Button>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
        {profile?.role === 'admin' && (
          <Link
            href="/admin"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Shield className="h-4 w-4" />
            Admin Panel
          </Link>
        )}
      </nav>

      <div className="border-t p-4">
        <div className="mb-2 flex items-center gap-3 px-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{profile?.full_name || profile?.email}</div>
            <div className="truncate text-xs text-muted-foreground">{profile?.email}</div>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r bg-card lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <div className="fixed left-0 top-0 z-50 flex h-16 w-full items-center justify-between border-b bg-card px-4 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Smartphone className="h-4 w-4" />
          </div>
          <span className="font-bold">OTPSuite</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SidebarContent />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop top bar */}
      <div className="fixed left-64 top-0 z-30 hidden h-16 w-[calc(100%-16rem)] items-center justify-end border-b bg-card/80 px-6 backdrop-blur lg:flex">
        <ThemeToggle />
      </div>
    </>
  );
}
