import type { Metadata } from 'next';

import { ForTcsSection } from '@/components/landing/ForTcsSection';
import { MarketingHeroArt } from '@/components/marketing/hero-art';
import { MarketingBreadcrumbs, MarketingCtaBand, MarketingPageHero, MarketingPointsSection, MarketingRelatedLinks } from '@/components/marketing/page-shell';
import { MockCompletionEmail, MockSellerLink } from '@/components/marketing/product-mockups';
import { JsonLd } from '@/components/seo/JsonLd';
import { createPageMetadata } from '@/lib/seo/site';
import { breadcrumbSchema } from '@/lib/seo/schema';

export const metadata: Metadata = createPageMetadata({
  title: 'Utility Sheets for Transaction Coordinators',
  description:
    'Send one reusable seller link, stop chasing utility details, and hand off a clean utility sheet and PDF on every file. Free for 3 sheets a month.',
  path: '/utility-sheet-for-transaction-coordinators',
  keywords: [
    'utility sheet for transaction coordinators',
    'transaction coordinator utility form',
    'seller utility info for tc',
  ],
});

export default function UtilitySheetForTransactionCoordinatorsPage() {
  return (
    <div className="bg-background">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Utility Sheet for Transaction Coordinators', path: '/utility-sheet-for-transaction-coordinators' },
          ]),
        ]}
      />

      <MarketingPageHero
        showActions
        art={<MarketingHeroArt primary={<MockSellerLink />} secondary={<MockCompletionEmail />} />}
        eyebrow="For Transaction Coordinators"
        title="One less loose end on every file."
        description="One seller link. Cleaner submissions. Buyer-ready utility sheets. UtilitySheet gives TCs a repeatable workflow for the utility handoff that usually turns into follow-up texts, blank forms, and last-minute cleanup."
      >
        <MarketingBreadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'For Transaction Coordinators', href: '/utility-sheet-for-transaction-coordinators' },
          ]}
        />
      </MarketingPageHero>

      <MarketingPointsSection
        title="Why TCs adopt UtilitySheet"
        description="The job is not just collecting utility names. It is keeping the file moving while still delivering a professional buyer handoff."
        points={[
          {
            title: 'Fewer seller chase-downs',
            copy: 'Instead of multiple follow-up emails or texts, you send one guided link and let the seller complete the form in a cleaner flow.',
          },
          {
            title: 'One workflow on every file',
            copy: 'Add the reusable seller link once to your seller welcome email, listing checklist, closing-prep email, or signature. Buyer-side TCs can ask the listing agent to forward it to the seller.',
          },
          {
            title: 'Better buyer handoff quality',
            copy: 'The finished utility sheet looks polished enough to share with buyers, agents, and support teams, and on Pro and Teams you can clean up submitted details before it goes out.',
          },
        ]}
      />

      <ForTcsSection />

      <MarketingRelatedLinks
        title="Related pages"
        description="These pages are useful if you are comparing plans or sharing UtilitySheet with an agent or team lead."
        links={[
          { href: '/pricing', label: 'View pricing' },
          { href: '/how-it-works', label: 'See the workflow' },
          { href: '/utility-sheet-for-real-estate-agents', label: 'For real estate agents' },
        ]}
      />

      <MarketingCtaBand
        title="Make utility collection one less thing to babysit"
        description="Start free and test UtilitySheet on a real file. If it belongs in your monthly TC workflow, Pro adds branded output, post-submission editing, and use on every transaction."
      />
    </div>
  );
}
