import type { Metadata } from 'next';
import Link from 'next/link';

import { ForTcsSection } from '@/components/landing/ForTcsSection';
import { MarketingBreadcrumbs, MarketingCtaBand, MarketingPageHero, MarketingSection } from '@/components/marketing/page-shell';
import { JsonLd } from '@/components/seo/JsonLd';
import { createPageMetadata } from '@/lib/seo/site';
import { breadcrumbSchema, softwareApplicationSchema } from '@/lib/seo/schema';

export const metadata: Metadata = createPageMetadata({
  title: 'Utility Sheet Workflow for Transaction Coordinators',
  description:
    'UtilitySheet helps transaction coordinators reuse one seller link, reduce utility follow-up, and deliver cleaner utility sheet PDFs for every file.',
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
          softwareApplicationSchema({
            path: '/utility-sheet-for-transaction-coordinators',
            description:
              'Utility sheet software for transaction coordinators who want a repeatable seller utility collection workflow.',
          }),
        ]}
      />

      <MarketingPageHero
        eyebrow="Use Case"
        title="UtilitySheet for transaction coordinators who need one repeatable utility workflow"
        description="Transaction coordinators are usually the ones chasing seller utility details, cleaning up inconsistent answers, and turning that information into something buyers can actually use. UtilitySheet gives you one reusable seller link and a cleaner review step after submission."
      >
        <MarketingBreadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'For Transaction Coordinators', href: '/utility-sheet-for-transaction-coordinators' },
          ]}
        />
      </MarketingPageHero>

      <MarketingSection
        title="Why TCs adopt UtilitySheet"
        description="The job is not just collecting utility names. It is keeping the file moving while still delivering a professional handoff."
      >
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: 'Fewer seller chase-downs',
              copy: 'Instead of multiple follow-up emails or texts, you send one guided link and let the seller complete the form in a cleaner flow. Nearly 86% of started UtilitySheets are completed.',
            },
            {
              title: 'More consistent files',
              copy: 'Every transaction gets the same utility handoff structure, which helps your process feel standardized instead of improvised.',
            },
            {
              title: 'Better handoff quality',
              copy: 'The finished utility sheet looks polished enough to share with buyers, agents, and support teams right away, and Pro/Teams can clean up submitted details before it goes out.',
            },
          ].map((item) => (
            <article key={item.title} className="rounded-3xl border border-border bg-card/30 p-6">
              <h3 className="text-2xl font-semibold text-foreground">{item.title}</h3>
              <p className="mt-3 leading-7 text-muted-foreground">{item.copy}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      <ForTcsSection />

      <MarketingSection title="Related pages" description="These pages are useful if you are comparing plans or sharing UtilitySheet with an agent or team lead.">
        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/pricing" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            View pricing
          </Link>
          <Link href="/how-it-works" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            See the workflow
          </Link>
          <Link href="/utility-sheet-for-real-estate-agents" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            For real estate agents
          </Link>
        </div>
      </MarketingSection>

      <MarketingCtaBand
        title="Make utility collection one less thing to babysit"
        description="Start free and test UtilitySheet on a real file to see how much TC follow-up time it cuts out before you decide whether paid editing belongs in your workflow."
      />
    </div>
  );
}
