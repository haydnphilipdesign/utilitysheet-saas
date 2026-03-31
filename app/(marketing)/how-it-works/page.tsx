import type { Metadata } from 'next';
import Link from 'next/link';

import { HowItWorks } from '@/components/landing/HowItWorks';
import { MarketingBreadcrumbs, MarketingCtaBand, MarketingPageHero, MarketingSection } from '@/components/marketing/page-shell';
import { JsonLd } from '@/components/seo/JsonLd';
import { workflowSteps } from '@/lib/marketing-content';
import { createPageMetadata } from '@/lib/seo/site';
import { breadcrumbSchema, softwareApplicationSchema } from '@/lib/seo/schema';

export const metadata: Metadata = createPageMetadata({
  title: 'How UtilitySheet Works for Seller Utility Handoffs',
  description:
    'See how UtilitySheet works: send one seller utility information form, collect cleaner provider details, generate a buyer-ready utility sheet PDF, and update submitted sheets on paid plans.',
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

      <MarketingPageHero
        eyebrow="Workflow"
        title="How UtilitySheet turns seller utility info into a clean closing handoff"
        description="UtilitySheet is designed to be simple for sellers and useful for transaction teams. One reusable link starts the process, guided provider confirmation keeps the information cleaner, and finished output is ready to review, share, and update from the dashboard."
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
        title="The three parts of the workflow"
        description="Each part is lightweight on purpose so the process is easy to repeat across listings."
      >
        <div className="grid gap-6 md:grid-cols-3">
          {workflowSteps.map((step) => (
            <article key={step.number} className="rounded-3xl border border-border bg-card/30 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">{step.number}</p>
              <h3 className="mt-3 text-2xl font-semibold text-foreground">{step.title}</h3>
              <p className="mt-3 leading-7 text-muted-foreground">{step.description}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection
        title="Where it fits in your process"
        description="Transaction coordinators and agents usually slot UtilitySheet into the same moment they would normally send a utility checklist, email, or follow-up text."
      >
        <div className="grid gap-6 md:grid-cols-2">
          {[
            'Add the seller link to your listing-to-closing checklist or email template once, then reuse it on every file.',
            'When the seller submits, review the finished utility sheet in the dashboard before sharing it with buyers, agents, support staff, or anyone else who needs the information.',
            'On Pro and Teams, you can correct capitalization, addresses, provider names, or contact details after submission without reopening the seller form.',
            'Use Simple mode when you just need utilities, or Advanced Utility Packet mode when the deal needs deeper transition details.',
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
