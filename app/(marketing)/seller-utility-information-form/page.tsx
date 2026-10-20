import type { Metadata } from 'next';

import { MarketingHeroArt } from '@/components/marketing/hero-art';
import { MarketingBreadcrumbs, MarketingCtaBand, MarketingPageHero, MarketingPointsSection, MarketingRelatedLinks, MarketingSection, MarketingStepRow } from '@/components/marketing/page-shell';
import { MockGuidedForm, MockSuggestions } from '@/components/marketing/product-mockups';
import { JsonLd } from '@/components/seo/JsonLd';
import { workflowSteps } from '@/lib/marketing-content';
import { createPageMetadata } from '@/lib/seo/site';
import { breadcrumbSchema } from '@/lib/seo/schema';

export const metadata: Metadata = createPageMetadata({
  title: 'Seller Utility Information Form',
  description:
    'A guided utility form sellers finish on their phone, no account needed. One reusable link returns a clean utility sheet and PDF for the buyer.',
  path: '/seller-utility-information-form',
  keywords: [
    'seller utility information form',
    'seller utility form for real estate',
    'real estate utility information form',
  ],
});

export default function SellerUtilityInformationFormPage() {
  return (
    <div className="bg-background">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Seller Utility Information Form', path: '/seller-utility-information-form' },
          ]),
        ]}
      />

      <MarketingPageHero
        showActions
        art={<MarketingHeroArt primary={<MockGuidedForm />} secondary={<MockSuggestions />} />}
        eyebrow="Seller form"
        title="The utility form sellers can finish on their phone."
        description="Many real estate teams still collect utility details through loose checklists, emails, or text chains. UtilitySheet turns that into a guided seller form and gives your team a cleaner utility sheet at the end."
      >
        <MarketingBreadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Seller Utility Information Form', href: '/seller-utility-information-form' },
          ]}
        />
      </MarketingPageHero>

      <MarketingPointsSection
        title="Why this works better than a plain checklist"
        description="The seller experience is simple on purpose, but the structure behind it gives your team more consistent data."
        points={[
          {
            title: 'Guided completion',
            copy: 'The seller follows one flow instead of guessing which details your team still needs. You choose the utilities and whether to ask about an HOA or condo association.',
          },
          {
            title: 'Cleaner provider details',
            copy: 'Address-based suggestions help sellers confirm the right utilities instead of leaving vague answers.',
          },
          {
            title: 'Better final output',
            copy: 'The submitted information becomes a utility sheet you can actually hand off to buyers or support staff, and on Pro and Teams you can refine it later in your dashboard.',
          },
        ]}
      />

      <MarketingSection title="What the seller utility form flow looks like">
        <MarketingStepRow
          steps={workflowSteps.map((step) => ({ title: step.title, copy: step.description }))}
        />
      </MarketingSection>

      <MarketingRelatedLinks
        title="Related pages"
        description="These pages help if you are evaluating the workflow for a specific role or process."
        links={[
          { href: '/utility-sheet-for-transaction-coordinators', label: 'For transaction coordinators' },
          { href: '/utility-sheet-for-real-estate-agents', label: 'For real estate agents' },
          { href: '/real-estate-closing-utility-checklist', label: 'Closing utility checklist' },
        ]}
      />

      <MarketingCtaBand
        title="Replace the messy seller utility checklist"
        description="Use one guided form, get a cleaner utility sheet at the end of the process, and add paid dashboard editing if your team needs that extra control."
      />
    </div>
  );
}
