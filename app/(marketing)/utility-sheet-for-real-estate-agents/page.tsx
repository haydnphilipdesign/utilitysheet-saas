import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingHeroArt } from '@/components/marketing/hero-art';
import { MarketingBreadcrumbs, MarketingCtaBand, MarketingPageHero, MarketingPointsSection, MarketingRelatedLinks } from '@/components/marketing/page-shell';
import { MockCompletionEmail, MockSheet } from '@/components/marketing/product-mockups';
import { JsonLd } from '@/components/seo/JsonLd';
import { createPageMetadata } from '@/lib/seo/site';
import { breadcrumbSchema } from '@/lib/seo/schema';

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
        ]}
      />

      <MarketingPageHero
        showActions
        art={<MarketingHeroArt primary={<MockSheet />} secondary={<MockCompletionEmail />} />}
        eyebrow="Use Case"
        title="A thoughtful handoff for your buyers."
        description="Agents want smooth closings, fewer last-minute requests, and a client experience that feels organized. UtilitySheet gives agents and their support teams one reusable seller link for utility details, then a clean sheet and PDF to review before sharing."
      >
        <MarketingBreadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'For Real Estate Agents', href: '/utility-sheet-for-real-estate-agents' },
          ]}
        />
      </MarketingPageHero>

      <MarketingPointsSection
        title="Where agents use it"
        description="UtilitySheet is useful whether you collect utilities yourself or hand the workflow to a TC or support assistant."
        points={[
          {
            title: 'Listing prep and closing coordination',
            copy: 'Add the link to your seller welcome email or listing checklist, or send it as closing approaches, so utility details are not left for the last week.',
          },
          {
            title: 'Buyer handoff',
            copy: 'Share a utility sheet that feels more professional than a forwarded email or messy note.',
          },
          {
            title: 'Team support',
            copy: 'Give assistants and coordinators a repeatable process instead of relying on ad hoc reminders.',
          },
        ]}
      >
        <p className="marketing-section-note">
          When the sheet goes to your buyer, send the{' '}
          <Link href="/guides/set-up-utilities-when-buying-a-house" className="font-semibold text-foreground underline underline-offset-4">
            buyer guide to setting up utilities
          </Link>{' '}
          with it. It covers when to call each provider and what to ask.
        </p>
      </MarketingPointsSection>

      <MarketingPointsSection
        title="What agents usually care about most"
        points={[
          { copy: 'Sellers can complete the form without a login or app install.' },
          { copy: 'The finished utility sheet is easy to share with buyers and support staff.' },
          { copy: 'Pro and Teams can correct submitted sheets in the dashboard when small details change before closing.' },
          { copy: 'Paid plans let you brand the output so the experience feels like part of your business.' },
        ]}
      />

      <MarketingRelatedLinks
        links={[
          { href: '/utility-sheet-for-transaction-coordinators', label: 'For transaction coordinators' },
          { href: '/seller-utility-information-form', label: 'Seller utility information form' },
          { href: '/pricing', label: 'Pricing' },
        ]}
      />

      <MarketingCtaBand
        title="Give buyers a cleaner utility handoff"
        description="Try UtilitySheet free and turn utility collection into a process that supports the rest of your closing experience."
      />
    </div>
  );
}
