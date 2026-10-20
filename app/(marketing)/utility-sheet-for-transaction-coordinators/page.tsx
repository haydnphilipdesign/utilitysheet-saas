import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check, FileText, Globe, Mail } from 'lucide-react';
import './tc.css';

import { customerTestimonials } from '@/components/landing/SocialProofBar';
import { MarketingBreadcrumbs, MarketingCtaBand } from '@/components/marketing/page-shell';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbSchema } from '@/lib/seo/schema';
import { createPageMetadata } from '@/lib/seo/site';

const path = '/utility-sheet-for-transaction-coordinators';

export const metadata: Metadata = createPageMetadata({
  title: 'Utility Sheets for Transaction Coordinators',
  description:
    'Put one reusable seller link in the emails you already send, track who’s finished, and hand off a clean utility sheet and PDF. 3 free sheets a month.',
  path,
  keywords: [
    'utility sheet for transaction coordinators',
    'transaction coordinator checklist utilities',
    'transaction coordinator utility form',
    'TC workflow utilities',
  ],
});

const stages = [
  {
    side: 'Listing side',
    title: 'At listing intake',
    body: 'Add the link to your seller welcome email. Sellers fill it in while they’re already gathering paperwork, so the details are ready long before closing. Take a quick look again before closing, since providers can change.',
    kitEmail: 'Listing welcome',
  },
  {
    side: 'Listing side',
    title: 'During closing prep',
    body: 'If it wasn’t collected at intake, send it with your closing-prep email. The dashboard shows which sellers have finished. If you created the request with the seller’s email, you can send them a reminder from there.',
    kitEmail: 'Listing side, closing prep',
  },
  {
    side: 'Buyer side',
    title: 'On the buyer side',
    body: 'You usually don’t have the seller’s contact details, so ask the listing agent to forward your link. The seller fills it in, and the finished sheet comes back to you.',
    kitEmail: 'Buyer side, via listing agent',
  },
];

const returns = [
  {
    title: 'A completion email',
    body: 'when the seller submits, with the PDF attached if you turn that on.',
  },
  {
    title: 'A web sheet and PDF',
    body: 'listing each provider’s name, phone number, and website, plus home basics and HOA details when the seller has them.',
  },
  {
    title: 'A dashboard of every request',
    body: 'showing what’s sent, in progress, and submitted.',
  },
  {
    title: 'Edits after submission',
    plan: 'Pro and Teams',
    body: 'fix a provider name, replace a “Not sure”, or leave a utility off. New PDF downloads use your changes.',
  },
  {
    title: 'Your branding',
    plan: 'Pro and Teams',
    body: 'on the link, the web sheet, and the PDF.',
  },
  {
    title: 'A shared workspace',
    plan: 'Teams',
    body: 'where any teammate with access to a request can update it. $7 per seat a month, 3-seat minimum.',
  },
];

const faqs = [
  {
    question: 'Does the seller need an account?',
    answer: 'No. They open the link on their phone or computer, enter the property address, and start.',
  },
  {
    question: 'Can I use it on buyer-side files?',
    answer: 'Yes. Ask the listing agent to forward your link to the seller. The finished sheet comes back to you.',
  },
  {
    question: 'Does it connect to my transaction software?',
    answer:
      'No, and it doesn’t need to. The link works anywhere you can paste it: an email template, a text, or a checklist task.',
  },
  {
    question: 'What if the seller doesn’t know a provider?',
    answer:
      'They can answer “Not sure”, and the sheet shows it. On Pro and Teams you can fill in the right provider later from your dashboard.',
  },
];

const sampleRequests = [
  { address: '123 Maple Ave', status: 'Submitted', tone: 'done' },
  { address: '48 Oak Street', status: 'In progress', tone: 'progress' },
  { address: '9 Birch Lane', status: 'Sent', tone: 'sent' },
] as const;

function RequestsPreview() {
  return (
    <figure className="tcp-hero-art">
      <div className="tcp-stage" aria-hidden="true">
        <div className="tcp-geometry">
          <i />
          <i />
        </div>
        <div className="tcp-panel">
          <div className="tcp-panel-bar">Seller requests</div>
          <ul className="tcp-requests">
            {sampleRequests.map((request) => (
              <li key={request.address}>
                <span className="tcp-request-copy">
                  <b>{request.address}</b>
                  {request.tone === 'done' ? (
                    <small>
                      <Globe size={11} /> Sheet + <FileText size={11} /> PDF ready
                    </small>
                  ) : (
                    <small>Seller utility form</small>
                  )}
                </span>
                <span className={`tcp-status tcp-status-${request.tone}`}>{request.status}</span>
                {request.tone === 'sent' && <span className="tcp-mock-button">Send reminder</span>}
              </li>
            ))}
          </ul>
        </div>
        <div className="tcp-float">
          <span className="tcp-float-icon">
            <Mail size={15} />
          </span>
          <span className="tcp-request-copy">
            <b>Seller submitted</b>
            <small>123 Maple Ave</small>
          </span>
        </div>
      </div>
      <figcaption>Illustrative preview with sample properties.</figcaption>
    </figure>
  );
}

export default function UtilitySheetForTransactionCoordinatorsPage() {
  return (
    <div className="bg-background">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Utility Sheet for Transaction Coordinators', path },
          ]),
        ]}
      />

      <section className="tcp-hero">
        <div className="marketing-container tcp-hero-grid">
          <div className="tcp-hero-copy">
            <p className="marketing-eyebrow">For transaction coordinators</p>
            <h1 className="text-balance">Seller utility details on every file, without the follow-up texts</h1>
            <p className="tcp-lead">
              Put one reusable link in the emails you already send. The seller confirms their providers on their
              phone, you get an email when it’s done, and the buyer side gets a clean utility sheet and PDF.
            </p>
            <div className="marketing-actions">
              <Link href="/auth/signup" className="marketing-button">
                Start free <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/tc-utility-handoff-kit" className="marketing-button marketing-button-outline">
                Get the free TC kit
              </Link>
            </div>
            <p className="tcp-fineprint">3 submitted sheets a month, free. No credit card required.</p>
            <MarketingBreadcrumbs
              items={[
                { label: 'Home', href: '/' },
                { label: 'For Transaction Coordinators', href: path },
              ]}
            />
          </div>
          <RequestsPreview />
        </div>
      </section>

      <section className="marketing-section tcp-section tcp-stages-section" aria-labelledby="tcp-stages-title">
        <div className="marketing-container">
          <div className="section-heading-row">
            <div>
              <p className="marketing-eyebrow">In your workflow</p>
              <h2 id="tcp-stages-title">Where the utility step fits</h2>
            </div>
            <p>The same link works at any stage. Most TCs send it at one of these three points.</p>
          </div>
          <ol className="tcp-stages">
            {stages.map((stage, index) => (
              <li key={stage.title}>
                <p className="tcp-stage-label">
                  <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span> {stage.side}
                </p>
                <h3>{stage.title}</h3>
                <p>{stage.body}</p>
                <p className="tcp-kit-email">
                  <Mail size={14} aria-hidden="true" /> Kit email: {stage.kitEmail}
                </p>
              </li>
            ))}
          </ol>
          <p className="tcp-note">
            The free <Link href="/tc-utility-handoff-kit">TC Utility Handoff Kit</Link> has copy-and-paste versions
            of all three emails.
          </p>
        </div>
      </section>

      <section className="marketing-section tcp-section tcp-section-alt" aria-labelledby="tcp-task-title">
        <div className="marketing-container tcp-two-col">
          <div className="tcp-prose">
            <h2 id="tcp-task-title">Make it a task in the checklist you already use</h2>
            <p>
              UtilitySheet doesn’t need to connect to your transaction software. Add one task to your file
              template, wherever you keep it, and paste your link into the task notes. The link is the same on every
              file, so the task never changes.
            </p>
            <p>
              On Pro and Teams you can save up to ten seller forms, each with its own link. That’s useful if listing
              files and buyer-side files need different questions.
            </p>
          </div>
          <figure className="tcp-tasks">
            <ul aria-hidden="true">
              <li className="is-done">
                <span className="tcp-box">
                  <Check size={12} />
                </span>
                Send seller welcome email
              </li>
              <li className="is-highlight">
                <span className="tcp-box" />
                <span className="tcp-request-copy">
                  <b>Send seller utility link</b>
                  <small>utilitysheet.com/i/your-team</small>
                </span>
              </li>
              <li>
                <span className="tcp-box" />
                Confirm closing date with title
              </li>
            </ul>
            <figcaption>Example task in a file checklist.</figcaption>
          </figure>
        </div>
      </section>

      <section className="marketing-section tcp-section" aria-labelledby="tcp-returns-title">
        <div className="marketing-container">
          <h2 id="tcp-returns-title" className="tcp-h2">
            What you get back
          </h2>
          <ul className="tcp-returns">
            {returns.map((item) => (
              <li key={item.title}>
                <span className="tcp-check" aria-hidden="true">
                  <Check size={14} />
                </span>
                <p>
                  <b>{item.title}</b>
                  {item.plan && <span className="tcp-plan"> ({item.plan})</span>} {item.body}
                </p>
              </li>
            ))}
          </ul>
          <Link href="/pricing" className="marketing-text-link tcp-compare">
            Compare plans <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="marketing-testimonials marketing-section" aria-labelledby="tcp-quotes-title">
        <div className="marketing-container">
          <h2 id="tcp-quotes-title">From TCs using it</h2>
          <div className="testimonial-grid">
            {customerTestimonials.map(({ quote, name, role }) => (
              <figure key={name}>
                <blockquote>&ldquo;{quote}&rdquo;</blockquote>
                <figcaption>
                  <strong>{name}</strong>
                  <span>{role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-section tcp-section" aria-labelledby="tcp-faq-title">
        <div className="marketing-container">
          <h2 id="tcp-faq-title" className="tcp-h2">
            TC questions
          </h2>
          <dl className="tcp-faq">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <dt>{faq.question}</dt>
                <dd>{faq.answer}</dd>
              </div>
            ))}
            <div>
              <dt>How many files can I run on the free plan?</dt>
              <dd>
                Three submitted sheets a month. A request only counts when the seller submits it.{' '}
                <Link href="/pricing">Pro</Link> is $9 a month and covers every file.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <MarketingCtaBand
        title="Put the link in your next file"
        description="Start free with three submitted sheets a month. No credit card required."
      />
    </div>
  );
}
