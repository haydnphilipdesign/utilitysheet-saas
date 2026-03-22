import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingBreadcrumbs, MarketingCtaBand, MarketingPageHero, MarketingSection } from '@/components/marketing/page-shell';
import { JsonLd } from '@/components/seo/JsonLd';
import { featureHighlights } from '@/lib/marketing-content';
import { createPageMetadata } from '@/lib/seo/site';
import { breadcrumbSchema, softwareApplicationSchema } from '@/lib/seo/schema';

export const metadata: Metadata = createPageMetadata({
  title: 'Utility Sheet Software Features for Real Estate Teams',
  description:
    'Explore UtilitySheet features for collecting seller utility information, generating utility sheet PDFs, tracking request status, and branding the handoff experience.',
  path: '/features',
  keywords: [
    'utility sheet features',
    'seller utility information software',
    'real estate utility form software',
  ],
});

export default function FeaturesPage() {
  return (
    <div className="bg-background">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Features', path: '/features' },
          ]),
          softwareApplicationSchema({
            path: '/features',
            description:
              'UtilitySheet features for transaction coordinators and real estate agents who need a better seller utility information workflow.',
          }),
        ]}
      />

      <MarketingPageHero
        eyebrow="Product"
        title="Utility sheet software features built for real estate closings"
        description="UtilitySheet helps transaction coordinators and agents replace scattered texts, PDFs, and reminders with one guided workflow that collects seller utility information and turns it into polished output."
      >
        <MarketingBreadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Features', href: '/features' },
          ]}
        />
      </MarketingPageHero>

      <MarketingSection
        title="What UtilitySheet helps your team do"
        description="Each feature is designed around the actual work of moving a listing from seller intake to buyer-ready handoff."
      >
        <div className="grid gap-6 md:grid-cols-2">
          {featureHighlights.map((feature) => (
            <article key={feature.title} className="rounded-3xl border border-border bg-card/40 p-6">
              <h3 className="text-2xl font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-3 leading-7 text-muted-foreground">{feature.description}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection
        title="Why these features matter in a transaction"
        description="The value is not just collecting utility data. It is reducing delay, cleaning up the handoff, and helping your team look more organized."
      >
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: 'Less follow-up',
              copy: 'Address-based suggestions and a guided seller experience reduce the usual round of “who is your provider?” follow-up messages.',
            },
            {
              title: 'More consistent files',
              copy: 'Every transaction gets the same structure, whether you need a simple utility sheet or a fuller closing-prep packet.',
            },
            {
              title: 'More professional delivery',
              copy: 'UtilitySheet gives your team a clear web view and PDF instead of a stitched-together note or screenshot collection.',
            },
          ].map((item) => (
            <article key={item.title} className="rounded-3xl border border-border bg-card/20 p-6">
              <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
              <p className="mt-3 leading-7 text-muted-foreground">{item.copy}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection title="Keep exploring" description="The strongest pages to read next depend on whether you are comparing workflow, pricing, or role-specific use cases.">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              href: '/how-it-works',
              title: 'How UtilitySheet works',
              copy: 'See the full path from seller link to utility sheet PDF.',
            },
            {
              href: '/pricing',
              title: 'Pricing',
              copy: 'Compare Starter, Pro, and Teams plans.',
            },
            {
              href: '/utility-sheet-for-transaction-coordinators',
              title: 'For transaction coordinators',
              copy: 'Learn how the workflow fits a TC process.',
            },
          ].map((link) => (
            <Link key={link.href} href={link.href} className="rounded-3xl border border-border bg-card/20 p-6 transition-colors hover:bg-card/40">
              <h3 className="text-lg font-semibold text-foreground">{link.title}</h3>
              <p className="mt-2 text-muted-foreground">{link.copy}</p>
            </Link>
          ))}
        </div>
      </MarketingSection>

      <MarketingCtaBand
        title="See the features inside a real workflow"
        description="Start free, send a seller utility form on a live file, and see how much back-and-forth disappears."
      />
    </div>
  );
}
