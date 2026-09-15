import type { Metadata } from 'next';
import Link from 'next/link';

import { PricingSection } from '@/components/landing/PricingSection';
import { MarketingBreadcrumbs, MarketingCtaBand, MarketingPageHero, MarketingSection } from '@/components/marketing/page-shell';
import { JsonLd } from '@/components/seo/JsonLd';

import { createPageMetadata } from '@/lib/seo/site';
import { breadcrumbSchema, softwareApplicationSchema } from '@/lib/seo/schema';

export const metadata: Metadata = createPageMetadata({
  title: 'UtilitySheet Pricing for Seller Utility Link Workflows',
  description:
    'View UtilitySheet pricing for Starter, Pro, and Teams. Compare reusable seller links, free requests, submitted-sheet editing, branded utility sheet output, Property Handoff Packet mode, and team workflows.',
  path: '/pricing',
  keywords: [
    'utility sheet pricing',
    'transaction coordinator software pricing',
    'real estate utility packet pricing',
  ],
});

export default function PricingPage() {
  return (
    <div className="bg-background">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Pricing', path: '/pricing' },
          ]),
          softwareApplicationSchema({
            path: '/pricing',
            description:
              'UtilitySheet pricing for real estate teams that need seller utility forms, submitted-sheet editing on paid plans, utility sheet PDFs, and branded packet workflows.',
          }),
        ]}
      />

      <MarketingPageHero showActions
        eyebrow="Pricing"
        title="A small price for a smoother handoff."
        description="Start with three live files per month, free. Add unlimited requests, your branding, and submitted-sheet editing with Pro. Bring your team together with Teams."
      >
        <MarketingBreadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Pricing', href: '/pricing' },
          ]}
        />
      </MarketingPageHero>

      <PricingSection />



      <MarketingSection
        title="Common reasons teams upgrade"
        description="Most upgrades happen when UtilitySheet becomes part of the regular listing-to-closing process."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {[
            'You want every seller utility form and PDF to reflect your own branding instead of UtilitySheet branding.',
            'You want Property Handoff Packet mode so the finished packet includes home systems, access details, and service providers, not just utilities.',
            'You need unlimited requests because the workflow is now part of every transaction.',
            'You need to correct submitted sheets inside the dashboard instead of sending the seller back through the public form.',
            'You need teammates inside the same workspace with shared defaults, shared visibility, and shared editing access.',
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-border bg-card/20 p-5 text-muted-foreground">
              {item}
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection title="Related pages" description="If you are still comparing options, these pages give more context.">
        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/features" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            Explore features
          </Link>
          <Link href="/how-it-works" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            See the workflow
          </Link>
          <Link href="/faq" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            Read the FAQ
          </Link>
        </div>
      </MarketingSection>

      <MarketingCtaBand
        title="Start on the free plan and upgrade when the workflow sticks"
        description="That is the easiest way to see if UtilitySheet saves your team the time and back-and-forth it is meant to save before you add paid editing, branding, or team features."
      />
    </div>
  );
}
