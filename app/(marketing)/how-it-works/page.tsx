import type { Metadata } from 'next';
import Link from 'next/link';

import { HowItWorks } from '@/components/landing/HowItWorks';
import { MarketingBreadcrumbs, MarketingCtaBand, MarketingPageHero, MarketingSection } from '@/components/marketing/page-shell';
import { JsonLd } from '@/components/seo/JsonLd';

import { createPageMetadata } from '@/lib/seo/site';
import { breadcrumbSchema, softwareApplicationSchema } from '@/lib/seo/schema';

export const metadata: Metadata = createPageMetadata({
  title: 'How UtilitySheet Works After Signup',
  description:
    'See how UtilitySheet works after signup: copy your reusable seller link, collect utility details, review the finished utility sheet PDF, and update submitted sheets on paid plans.',
  path: '/how-it-works',
  keywords: [
    'how utility sheet works',
    'seller utility form workflow',
    'real estate utility handoff process',
  ],
});

export default function HowItWorksPage() {
  return (
    <div className="bg-background">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'How It Works', path: '/how-it-works' },
          ]),
          softwareApplicationSchema({
            path: '/how-it-works',
            description:
              'A step-by-step workflow for collecting seller utility information, delivering a utility sheet, and managing corrections after submission on paid plans.',
          }),
        ]}
      />

      <MarketingPageHero showActions
        eyebrow="Workflow"
        title="Send a link. Get the details. Hand it off."
        description="A simple seller experience, from the first question to the finished PDF. Here is how UtilitySheet fits into your next closing."
      >
        <MarketingBreadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'How It Works', href: '/how-it-works' },
          ]}
        />
      </MarketingPageHero>

      <HowItWorks />



      <MarketingSection
        title="Where it fits in your process"
        description="Transaction coordinators and agents usually slot UtilitySheet into the same moment they would normally send a utility checklist, email, or follow-up text."
      >
        <div className="grid gap-6 md:grid-cols-2">
          {[
            'Add the reusable seller link to your listing-to-closing checklist or email template once, then reuse it on every file.',
            'When the seller submits, review the finished utility sheet in the dashboard before sharing it with buyers, agents, support staff, or anyone else who needs the information.',
            'On Pro and Teams, you can correct capitalization, addresses, provider names, or contact details after submission without reopening the seller form.',
            'Use Simple Utility Sheet mode when you just need utilities, or Property Handoff Packet mode to collect utilities, home systems, access details, and service-provider information in one seller handoff.',
            'Keep the workflow branded on paid plans so the handoff matches the rest of your client communication.',
          ].map((item) => (
            <div key={item} className="rounded-3xl border border-border bg-card/20 p-6 text-muted-foreground">
              {item}
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection title="Related pages" description="These pages go deeper on role-specific use cases and plan details.">
        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/features" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            Explore features
          </Link>
          <Link href="/pricing" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            View pricing
          </Link>
          <Link href="/seller-utility-information-form" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            Seller utility information form
          </Link>
        </div>
      </MarketingSection>

      <MarketingCtaBand
        title="Try the workflow on a real transaction"
        description="Start free, send a seller link, and see how much easier the utility handoff feels when the process is standardized."
      />
    </div>
  );
}
