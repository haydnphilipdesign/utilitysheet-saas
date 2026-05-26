import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingBreadcrumbs, MarketingCtaBand, MarketingPageHero, MarketingSection } from '@/components/marketing/page-shell';
import { JsonLd } from '@/components/seo/JsonLd';
import { workflowSteps } from '@/lib/marketing-content';
import { createPageMetadata } from '@/lib/seo/site';
import { breadcrumbSchema, softwareApplicationSchema } from '@/lib/seo/schema';

export const metadata: Metadata = createPageMetadata({
  title: 'Seller Utility Information Form With a Reusable Link',
  description:
    'UtilitySheet provides a guided seller utility information form through one reusable link, helping teams collect utility details, generate a polished utility sheet PDF, and correct submitted sheets on paid plans.',
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
          softwareApplicationSchema({
            path: '/seller-utility-information-form',
            description:
              'A guided seller utility information form for real estate teams that need cleaner utility handoff data, ready-to-share PDFs, and dashboard-side corrections on paid plans.',
          }),
        ]}
      />

      <MarketingPageHero
        eyebrow="Search Intent"
        title="A seller utility information form that starts with one reusable link"
        description="Many real estate teams still collect utility details through loose checklists, emails, or text chains. UtilitySheet turns that into a guided seller form and gives your team a cleaner utility sheet at the end."
      >
        <MarketingBreadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Seller Utility Information Form', href: '/seller-utility-information-form' },
          ]}
        />
      </MarketingPageHero>

      <MarketingSection
        title="Why this works better than a plain checklist"
        description="The seller experience is simple on purpose, but the structure behind it gives your team more consistent data."
      >
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: 'Guided completion',
              copy: 'The seller follows one flow instead of guessing which details your team still needs. Nearly 86% of started UtilitySheets are completed.',
            },
            {
              title: 'Cleaner provider details',
              copy: 'Address-based suggestions help sellers confirm the right utilities instead of leaving vague answers.',
            },
            {
              title: 'Better final output',
              copy: 'The submitted information becomes a utility sheet you can actually hand off to buyers or support staff, and Pro/Teams can refine it later inside the dashboard.',
            },
          ].map((item) => (
            <article key={item.title} className="rounded-3xl border border-border bg-card/30 p-6">
              <h3 className="text-2xl font-semibold text-foreground">{item.title}</h3>
              <p className="mt-3 leading-7 text-muted-foreground">{item.copy}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection title="What the seller utility form flow looks like">
        <div className="grid gap-6 md:grid-cols-3">
          {workflowSteps.map((step) => (
            <article key={step.number} className="rounded-3xl border border-border bg-card/20 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">{step.number}</p>
              <h3 className="mt-3 text-2xl font-semibold text-foreground">{step.title}</h3>
              <p className="mt-3 leading-7 text-muted-foreground">{step.description}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection title="Related pages" description="These pages help if you are evaluating the workflow for a specific role or process.">
        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/utility-sheet-for-transaction-coordinators" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            For transaction coordinators
          </Link>
          <Link href="/utility-sheet-for-real-estate-agents" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            For real estate agents
          </Link>
          <Link href="/real-estate-closing-utility-checklist" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            Closing utility checklist
          </Link>
        </div>
      </MarketingSection>

      <MarketingCtaBand
        title="Replace the messy seller utility checklist"
        description="Use one guided form, get a cleaner utility sheet at the end of the process, and add paid dashboard editing if your team needs that extra control."
      />
    </div>
  );
}
