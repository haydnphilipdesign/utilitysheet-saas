import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingBreadcrumbs, MarketingCtaBand, MarketingPageHero, MarketingSection } from '@/components/marketing/page-shell';
import { JsonLd } from '@/components/seo/JsonLd';
import { createPageMetadata } from '@/lib/seo/site';
import { breadcrumbSchema, softwareApplicationSchema } from '@/lib/seo/schema';

export const metadata: Metadata = createPageMetadata({
  title: 'Utility Sheet Workflow for Real Estate Agents',
  description:
    'UtilitySheet helps real estate agents share one seller utility link, reduce closing friction, and deliver a more professional utility sheet to buyers.',
  path: '/utility-sheet-for-real-estate-agents',
  keywords: [
    'utility sheet for real estate agents',
    'seller utility form for agents',
    'real estate utility handoff software',
  ],
});

export default function UtilitySheetForRealEstateAgentsPage() {
  return (
    <div className="bg-background">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Utility Sheet for Real Estate Agents', path: '/utility-sheet-for-real-estate-agents' },
          ]),
          softwareApplicationSchema({
            path: '/utility-sheet-for-real-estate-agents',
            description:
              'UtilitySheet helps real estate agents collect seller utility information and deliver a better utility handoff before closing.',
          }),
        ]}
      />

      <MarketingPageHero
        eyebrow="Use Case"
        title="UtilitySheet for real estate agents who want a cleaner seller utility handoff"
        description="Agents want smooth closings, fewer last-minute requests, and a client experience that feels organized. UtilitySheet gives agents and their support teams one reusable seller link for utility details, then a clean sheet and PDF to review before sharing."
      >
        <MarketingBreadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'For Real Estate Agents', href: '/utility-sheet-for-real-estate-agents' },
          ]}
        />
      </MarketingPageHero>

      <MarketingSection
        title="Where agents use it"
        description="UtilitySheet is useful whether you collect utilities yourself or hand the workflow to a TC or support assistant."
      >
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: 'Listing prep and closing coordination',
              copy: 'Keep seller utility details from turning into one more late-stage closing task.',
            },
            {
              title: 'Buyer handoff',
              copy: 'Share a utility sheet that feels more professional than a forwarded email or messy note.',
            },
            {
              title: 'Team support',
              copy: 'Give assistants and coordinators a repeatable process instead of relying on ad hoc reminders.',
            },
          ].map((item) => (
            <article key={item.title} className="rounded-3xl border border-border bg-card/30 p-6">
              <h3 className="text-2xl font-semibold text-foreground">{item.title}</h3>
              <p className="mt-3 leading-7 text-muted-foreground">{item.copy}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection
        title="What agents usually care about most"
        description="These are the parts of the workflow that tend to matter most when an agent is evaluating whether a tool is worth adopting."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {[
            'Sellers can complete the form without a login or app install.',
            'The finished utility sheet is easy to share with buyers and support staff.',
            'Pro and Teams can correct submitted sheets in the dashboard when small details change before closing.',
            'The workflow helps the transaction feel more organized and less reactive.',
            'Paid plans let you brand the output so the experience feels like part of your business.',
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-border bg-card/20 p-5 text-muted-foreground">
              {item}
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection title="Related pages" description="If your team uses coordinators or assistants, these pages add more context.">
        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/utility-sheet-for-transaction-coordinators" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            For transaction coordinators
          </Link>
          <Link href="/seller-utility-information-form" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            Seller utility information form
          </Link>
          <Link href="/pricing" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            Pricing
          </Link>
        </div>
      </MarketingSection>

      <MarketingCtaBand
        title="Give buyers a cleaner utility handoff"
        description="Try UtilitySheet free and turn utility collection into a process that supports the rest of your closing experience."
      />
    </div>
  );
}
