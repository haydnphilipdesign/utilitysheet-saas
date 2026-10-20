import type { Metadata } from 'next';

import { MarketingHeroArt } from '@/components/marketing/hero-art';
import { MarketingBreadcrumbs, MarketingCtaBand, MarketingPageHero, MarketingPointsSection, MarketingRelatedLinks, MarketingSection, MarketingStepRow } from '@/components/marketing/page-shell';
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

const tcProcess = [
  {
    title: 'Add it once',
    copy: 'Add your seller link to your email signature, listing email template, or text template once.',
  },
  {
    title: 'Send it when a file opens',
    copy: 'When a new file opens, text or email the seller your link. They enter the property address, confirm suggested providers when available, or type their own answers.',
  },
  {
    title: 'Review, then share',
    copy: 'Your completion email can include the finished PDF automatically. On Pro and Teams, if anything needs cleanup after submission, update the live sheet in the dashboard before you share the web link or PDF forward.',
  },
] as const;

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
          {
            title: 'Collect only the details the file needs',
            copy: 'Keep standard utility sheets fast and switch the HOA question on or off on any plan. On Pro and Teams, add transition details like lawn care, security, mailbox, and access notes when the file needs more context, and save a form for each kind of file.',
          },
        ]}
      />

      <MarketingSection title="The TC process" description="Drop the link into the messages you already send.">
        <MarketingStepRow steps={tcProcess} />
        <p className="marketing-section-note">
          Paste your reusable link into email, text, Dotloop, Skyslope, Brokermint, or your TC checklist. Open
          UtilitySheet when you need to review a submission, fix a typo, update provider details, manage branding,
          or adjust settings.
        </p>
      </MarketingSection>

      <MarketingRelatedLinks
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
