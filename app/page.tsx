'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Smartphone, Zap, Shield, Globe, CreditCard, MessageSquare,
  CheckCircle2, ArrowRight, Star, Clock, Lock, Users,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

const services = [
  { name: 'WhatsApp', icon: '💬', color: 'from-green-400 to-green-600' },
  { name: 'Telegram', icon: '✈️', color: 'from-blue-400 to-blue-600' },
  { name: 'Instagram', icon: '📷', color: 'from-pink-400 to-purple-600' },
  { name: 'Facebook', icon: '👥', color: 'from-blue-500 to-blue-700' },
  { name: 'Google', icon: '🔍', color: 'from-red-400 to-yellow-500' },
  { name: 'TikTok', icon: '🎵', color: 'from-pink-500 to-cyan-400' },
  { name: 'Twitter/X', icon: '🐦', color: 'from-gray-400 to-gray-600' },
  { name: 'Discord', icon: '🎮', color: 'from-indigo-400 to-purple-600' },
  { name: 'Tinder', icon: '❤️', color: 'from-orange-400 to-red-500' },
  { name: 'Snapchat', icon: '👻', color: 'from-yellow-300 to-yellow-500' },
  { name: 'Microsoft', icon: '🪟', color: 'from-blue-400 to-cyan-500' },
  { name: 'Signal', icon: '🔐', color: 'from-blue-500 to-indigo-600' },
];

const features = [
  { icon: Zap, title: 'Instant Delivery', desc: 'Receive OTP codes in real-time the moment they arrive. No waiting, no delays.' },
  { icon: Globe, title: '100+ Countries', desc: 'Numbers available from over 100 countries with coverage on every continent.' },
  { icon: Shield, title: 'Private & Secure', desc: 'Your numbers are temporary and disposable. Keep your real phone private.' },
  { icon: CreditCard, title: 'Wallet System', desc: 'Fund your wallet once and buy numbers with a single click. No repeat payments.' },
  { icon: Clock, title: 'Auto-Release', desc: 'Numbers auto-release if no SMS arrives, with automatic wallet refund.' },
  { icon: Users, title: 'Multi-Provider', desc: 'We aggregate multiple SMS providers for the best prices and highest availability.' },
];

const steps = [
  { num: '01', title: 'Create an Account', desc: 'Sign up for free with just your email. No verification needed to get started.' },
  { num: '02', title: 'Fund Your Wallet', desc: 'Add funds via bank transfer or virtual account. Your balance is available instantly.' },
  { num: '03', title: 'Pick Country & Service', desc: 'Choose from 100+ countries and 500+ services. Compare prices across providers.' },
  { num: '04', title: 'Get Your OTP', desc: 'Receive your SMS verification code in real-time on your dashboard. Done.' },
];

const pricing = [
  {
    name: 'Starter',
    price: '₦500',
    desc: 'Perfect for one-time verifications',
    features: ['1 virtual number', 'Any service', '15-minute validity', 'Real-time SMS inbox', 'Auto-refund on failure'],
    cta: 'Start Small',
    popular: false,
  },
  {
    name: 'Pro',
    price: '₦5,000',
    desc: 'Best value for regular users',
    features: ['10+ virtual numbers', 'Priority provider routing', '20-minute validity', 'Full SMS history', 'Email support', 'Bulk discounts'],
    cta: 'Go Pro',
    popular: true,
  },
  {
    name: 'Business',
    price: '₦50,000',
    desc: 'For agencies & power users',
    features: ['Unlimited numbers', 'API access', 'Dedicated numbers', '30-day SMS logs', 'Priority support', 'Custom integrations'],
    cta: 'Contact Sales',
    popular: false,
  },
];

const faqs = [
  { q: 'What is a virtual phone number?', a: 'A virtual phone number is a temporary phone number you can use to receive SMS/OTP verification codes without exposing your real phone number. Numbers are disposable and auto-release after use.' },
  { q: 'How fast do I receive my OTP code?', a: 'OTP codes are delivered in real-time. The moment the SMS arrives on the virtual number, it appears on your dashboard instantly — typically within seconds of the service sending it.' },
  { q: 'What happens if no SMS arrives?', a: 'If no SMS arrives within the validity period (usually 15-20 minutes), the number is automatically released and your wallet is refunded. You can also manually cancel and get an instant refund.' },
  { q: 'Which services and apps are supported?', a: 'We support 500+ services including WhatsApp, Telegram, Instagram, Facebook, Google, TikTok, Twitter, Discord, Tinder, Snapchat, Microsoft, Signal, and many more across 100+ countries.' },
  { q: 'How do I fund my wallet?', a: 'You can fund your wallet via bank transfer to a dedicated virtual account, or through supported payment gateways. Deposits are credited automatically once confirmed.' },
  { q: 'Is my data and number private?', a: 'Yes. We never share your data with third parties. Virtual numbers are temporary and disposable — once released, they cannot receive new messages and are recycled to other users.' },
  { q: 'Can I get a refund?', a: 'Wallet refunds are automatic for failed number purchases. For deposit refunds, please contact our support team and we will process your request within 48 hours.' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20" />
        <div className="absolute left-1/2 top-0 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />

        <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-16 sm:px-6 lg:px-8 lg:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm">
              <span className="flex h-2 w-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">Live · 50,000+ numbers available now</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Instant <span className="gradient-text">OTP Verification</span>
              <br />for Every App
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Buy temporary virtual phone numbers for SMS verification on WhatsApp, Telegram,
              Instagram, Google, and 500+ services across 100+ countries. Receive codes in real-time.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild className="w-full sm:w-auto glow">
                <Link href="/register">
                  Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                <Link href="/#how-it-works">See How It Works</Link>
              </Button>
            </div>

            <div className="mt-10 flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-500" /> No credit card</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-500" /> Pay as you go</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-500" /> Instant delivery</div>
            </div>
          </div>

          {/* Hero stats */}
          <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Countries', value: '100+' },
              { label: 'Services', value: '500+' },
              { label: 'Numbers Sold', value: '2M+' },
              { label: 'Uptime', value: '99.9%' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border bg-card/50 p-4 text-center">
                <div className="text-2xl font-bold text-primary sm:text-3xl">{stat.value}</div>
                <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section id="services" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Supported Services</h2>
            <p className="mt-4 text-muted-foreground">
              Verify accounts on all popular apps and platforms. One number works for any service.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {services.map((service) => (
              <div
                key={service.name}
                className="group flex flex-col items-center gap-3 rounded-xl border bg-card/50 p-6 transition-all hover:border-primary/50 hover:bg-card hover:shadow-lg"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${service.color} text-2xl`}>
                  {service.icon}
                </div>
                <span className="text-sm font-medium">{service.name}</span>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            + 488 more services including Uber, Signal, Line, Viber, Drom, and more
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="border-y bg-card/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built for speed and reliability
            </h2>
            <p className="mt-4 text-muted-foreground">
              Everything you need to verify accounts instantly, with a platform you can trust.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="border-border/50 bg-card/50">
                <CardHeader>
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription className="text-sm">{feature.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
            <p className="mt-4 text-muted-foreground">
              From sign-up to OTP in under 2 minutes.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div key={step.num} className="relative">
                <div className="text-5xl font-bold text-primary/20">{step.num}</div>
                <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Button size="lg" asChild>
              <Link href="/register">Create Your Account <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-y bg-card/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple, transparent pricing</h2>
            <p className="mt-4 text-muted-foreground">
              Fund your wallet with any amount. Numbers start from as low as ₦50.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {pricing.map((plan) => (
              <Card
                key={plan.name}
                className={plan.popular ? 'border-primary glow bg-card' : 'border-border/50 bg-card/50'}
              >
                <CardHeader>
                  {plan.popular && (
                    <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                      <Star className="h-3 w-3" /> Most Popular
                    </span>
                  )}
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.desc}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground"> / wallet</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button className="mt-6 w-full" variant={plan.popular ? 'default' : 'outline'} asChild>
                    <Link href="/register">{plan.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Frequently asked questions</h2>
            <p className="mt-4 text-muted-foreground">Everything you need to know about OTPSuite.</p>
          </div>

          <Accordion type="single" collapsible className="mt-10">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left text-base">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-card/30 py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-card to-card p-12">
            <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
            <Smartphone className="mx-auto h-12 w-12 text-primary" />
            <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to verify?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Join thousands of users who trust OTPSuite for fast, private, and reliable OTP verification.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/register">Create Free Account <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
