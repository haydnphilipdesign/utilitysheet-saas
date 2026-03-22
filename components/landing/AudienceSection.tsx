import Link from 'next/link';

import { audiencePages } from '@/lib/marketing-content';

export function AudienceSection() {
  return (
    <section className="border-t border-border/50 bg-background px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">Use cases</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Built for the real estate teams chasing utility details every week
          </h2>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            UtilitySheet is not generic form software. It is designed around the people who need seller utility information before closing and want a cleaner, more professional handoff.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {audiencePages.map((page) => (
            <article key={page.href} className="rounded-3xl border border-border bg-card/40 p-6">
              <h3 className="text-xl font-semibold text-foreground">{page.title}</h3>
              <p className="mt-3 leading-7 text-muted-foreground">{page.description}</p>
              <Link
                href={page.href}
                className="mt-5 inline-flex text-sm font-semibold text-slate-700 underline underline-offset-4 hover:text-slate-900"
              >
                Explore this use case
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
