import Link from 'next/link';
import { Smartphone, Mail, Twitter, Github } from 'lucide-react';

export function SiteFooter() {
  return (
    <footer className="border-t bg-card/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Smartphone className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold">OTPSuite</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              Instant temporary virtual numbers for OTP & SMS verification across 100+ countries.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/#services" className="hover:text-foreground">Services</Link></li>
              <li><Link href="/#pricing" className="hover:text-foreground">Pricing</Link></li>
              <li><Link href="/#how-it-works" className="hover:text-foreground">How It Works</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/#faq" className="hover:text-foreground">FAQ</Link></li>
              <li><Link href="/register" className="hover:text-foreground">Sign Up</Link></li>
              <li><Link href="/login" className="hover:text-foreground">Sign In</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold">Connect</h4>
            <div className="flex gap-3">
              <a href="mailto:support@otpsuite.com" className="text-muted-foreground hover:text-foreground" aria-label="Email">
                <Mail className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground" aria-label="Twitter">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground" aria-label="GitHub">
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
          © 2026 OTPSuite. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
