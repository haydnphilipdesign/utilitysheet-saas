import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

type BreadcrumbItem = {
  label: string;
  href: string;
};

export function MarketingBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <li key={item.href} className="flex items-center gap-2">
            {index > 0 ? <span>/</span> : null}
            {index === items.length - 1 ? (
              <span className="text-foreground">{item.label}</span>
            ) : (
              <Link href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function MarketingPageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden px-4 pb-14 pt-24 sm:px-6 sm:pb-18 sm:pt-28 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_48%),linear-gradient(180deg,rgba(71,85,105,0.06),transparent_45%)]" />
      <div className="mx-auto max-w-6xl">
        <div className="max-w-4xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">{eyebrow}</p>
          <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl text-balance">{title}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground sm:text-xl text-pretty">{description}</p>
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}

export function MarketingSection({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="px-4 py-14 sm:px-6 sm:py-18 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">{title}</h2>
          {description ? (
            <p className="mt-4 text-lg leading-8 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

export function MarketingCtaBand({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-lg bg-slate-700 px-6 py-10 text-center shadow-2xl shadow-slate-500/20 sm:px-10 sm:py-14">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl text-balance">{title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-200">{description}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/auth/signup" className="w-full sm:w-auto">
            <Button className="w-full bg-emerald-500 text-white hover:bg-emerald-400 sm:w-auto">
              Start Free
            </Button>
          </Link>
          <Link href="/demo" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full border-white/30 text-white hover:bg-white/10 sm:w-auto">
              Try the Demo
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
