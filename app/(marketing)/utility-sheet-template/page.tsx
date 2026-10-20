import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowDown, ArrowRight, Download } from 'lucide-react';
import './template.css';

import { MarketingBreadcrumbs, MarketingCtaBand } from '@/components/marketing/page-shell';
import { JsonLd } from '@/components/seo/JsonLd';
import { UTILITY_CATEGORIES } from '@/lib/constants';
import { breadcrumbSchema } from '@/lib/seo/schema';
import { createPageMetadata } from '@/lib/seo/site';

const pdfHref = '/templates/utility-info-sheet.pdf';

export const metadata: Metadata = createPageMetadata({
  title: 'Free Utility Sheet Template (Printable PDF)',
  description:
    'Download a free, printable utility sheet template for home sellers: providers, phone numbers, home basics, HOA details, and buyer next steps on one page.',
  path: '/utility-sheet-template',
  keywords: [
    'utility sheet template',
    'utility information sheet for buyers',
    'seller utility information form pdf',
    'utility list for home buyers',
    'what is a utility sheet in real estate',
  ],
});

const sections = [
  {
    title: 'Property and seller',
    body: 'Address, seller name and phone, and the date the sheet was filled in.',
  },
  {
    title: 'Home basics',
    body: 'Water source, sewer or septic, and primary heating fuel, each with a “Not sure” option.',
  },
  {
    title: 'Utility providers',
    body: 'Electric, natural gas, propane, heating oil, water, sewer, trash and recycling, internet, and cable/TV, with provider, phone, and website.',
  },
  {
    title: 'Electric meter number',
    body: 'Optional, for teams that collect it.',
  },
  {
    title: 'HOA or condo association',
    body: 'Association name, management contact, dues, and where dues are paid or documents are found.',
  },
  {
    title: 'Buyer next steps',
    body: 'Four short steps that tell the buyer what to do with the sheet after closing.',
  },
];

const comparison = [
  { row: 'How the seller fills it in', paper: 'On paper or in a PDF editor', link: 'On their phone, with no account' },
  { row: 'Provider names', paper: 'From memory', link: 'Suggested from the property address where available, then confirmed' },
  { row: 'Knowing it’s done', paper: 'When it comes back', link: 'A completion email, with the PDF attached if you want it' },
  { row: 'What you end up with', paper: 'Handwriting to check and retype', link: 'A clean web sheet and PDF' },
  { row: 'Cost', paper: 'Free', link: 'Free for 3 submitted sheets a month' },
];

const basics = [
  {
    title: 'Who fills it in',
    body: 'The seller, since they pay the bills today. A listing agent or transaction coordinator usually sends the request and reviews the answers.',
  },
  {
    title: 'When',
    body: 'Often at listing or once the home is under contract, so it’s ready well before closing. A quick check before closing catches any provider changes.',
  },
  {
    title: 'Where it goes',
    body: 'Into the transaction file, then to the buyer or the buyer’s agent, usually around closing.',
  },
];

const faqs = [
  {
    question: 'Is the template really free?',
    answer: 'Yes. Download it, print it, and share it with sellers, your team, or other agents. No signup or email needed.',
  },
  {
    question: 'Can I put my logo on it?',
    answer: 'This PDF is the same for everyone. If you want your logo and colors on the finished sheet, UtilitySheet’s Pro and Teams plans add custom branding to the web sheet and PDF.',
  },
];

function SheetPreview() {
  return (
    <figure className="ust-preview">
      <div className="ust-paper" aria-hidden="true">
        <p className="ust-paper-brand">UtilitySheet</p>
        <p className="ust-paper-title">Utility Info Sheet</p>
        <span className="ust-paper-line ust-paper-line-wide" />
        <div className="ust-paper-split">
          <span className="ust-paper-line" />
          <span className="ust-paper-line" />
        </div>
        <p className="ust-paper-heading">Utility providers</p>
        <div className="ust-paper-table">
          <span className="ust-paper-th">Utility</span>
          <span className="ust-paper-th">Provider</span>
          <span className="ust-paper-th">Phone</span>
          {UTILITY_CATEGORIES.map((row) => (
            <span key={row.key} className="ust-paper-row">
              <b>{row.label}</b>
              <i />
              <i />
            </span>
          ))}
        </div>
        <p className="ust-paper-heading">HOA or condo association</p>
        <div className="ust-paper-split">
          <span className="ust-paper-line" />
          <span className="ust-paper-line" />
        </div>
        <p className="ust-paper-heading">Buyer next steps</p>
        <span className="ust-paper-text" />
        <span className="ust-paper-text ust-paper-text-short" />
        <span className="ust-paper-text" />
      </div>
      <figcaption>Preview of the one-page template.</figcaption>
    </figure>
  );
}

export default function UtilitySheetTemplatePage() {
  return (
    <div className="bg-background">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Utility Sheet Template', path: '/utility-sheet-template' },
          ]),
        ]}
      />

      <section className="marketing-inner-hero ust-hero">
        <div className="marketing-container ust-hero-grid">
          <div>
            <p className="marketing-eyebrow">Free printable template</p>
            <h1 className="text-balance">Free utility sheet template for real estate closings</h1>
            <p className="ust-lead">
              A one-page form sellers fill in with their utility providers, so the buyer knows who to call
              after closing. Print it, add it to your listing paperwork, or email the PDF. No signup needed.
            </p>
            <div className="marketing-actions mt-7">
              <a href={pdfHref} download className="marketing-button">
                <Download size={17} aria-hidden="true" /> Download the PDF
              </a>
              <a href="#send-as-link" className="marketing-text-link">
                Or send it as a link <ArrowDown size={17} aria-hidden="true" />
              </a>
            </div>
            <p className="ust-meta">US Letter · 1 page · Free to print and share</p>
            <MarketingBreadcrumbs
              items={[
                { label: 'Home', href: '/' },
                { label: 'Utility Sheet Template', href: '/utility-sheet-template' },
              ]}
            />
          </div>
          <SheetPreview />
        </div>
      </section>

      <section id="what-is-a-utility-sheet" className="marketing-inner-section ust-section ust-section-alt">
        <div className="marketing-container ust-two-col">
          <div>
            <h2 className="marketing-inner-title">What is a utility sheet?</h2>
            <p className="ust-intro">
              A utility sheet is a one-page list of the companies that provide service to a home: electric, gas,
              water, sewer, trash, internet, and any fuel delivery. In a home sale, the seller fills it in so the
              buyer knows who to call to start service after closing.
            </p>
            <p className="ust-intro">
              You may also hear it called a utility information sheet, a utility list, or a seller utility form.
            </p>
            <p className="ust-note ust-definition-note">
              This template is the paper version. UtilitySheet collects the same details through a link and gives
              you back a finished sheet and PDF. <a href="#send-as-link">See how it compares</a>.
            </p>
          </div>
          <dl className="ust-basics">
            {basics.map((item) => (
              <div key={item.title}>
                <dt>{item.title}</dt>
                <dd>{item.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="marketing-inner-section ust-section">
        <div className="marketing-container">
          <h2 className="marketing-inner-title">What’s on the template</h2>
          <p className="ust-intro">
            The same sections UtilitySheet uses on every finished sheet, so nothing important gets skipped.
          </p>
          <dl className="ust-sections">
            {sections.map((section) => (
              <div key={section.title}>
                <dt>{section.title}</dt>
                <dd>{section.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="marketing-inner-section ust-section ust-section-alt">
        <div className="marketing-container ust-two-col">
          <div>
            <h2 className="marketing-inner-title">How to use it</h2>
            <ol className="ust-steps">
              <li>
                <b>Send it early.</b> Include it with your listing paperwork or seller welcome email, so the
                details are ready long before closing.
              </li>
              <li>
                <b>Ask for providers, not accounts.</b> Sellers only need provider names, phone numbers, and
                websites. “Not sure” is a fine answer.
              </li>
              <li>
                <b>Review it, then pass it on.</b> Check for vague answers like “the gas company”, save it in
                the transaction file, and share it with the buyer side.
              </li>
            </ol>
            <p className="ust-note">
              Need the emails to send with it? The free{' '}
              <Link href="/tc-utility-handoff-kit">TC Utility Handoff Kit</Link> has copy-and-paste
              templates for listing intake, closing prep, and buyer-side requests. For sellers, the{' '}
              <Link href="/guides/transfer-utilities-when-selling-a-house">guide to transferring utilities when
              selling</Link> covers stop dates, final bills, and the final walkthrough.
            </p>
          </div>
          <div className="ust-callout">
            <h2 className="ust-callout-title">What not to put on a utility sheet</h2>
            <p>The sheet travels to the buyer, so keep private details off it:</p>
            <ul>
              <li>Account numbers</li>
              <li>Passwords, PINs, or security answers</li>
              <li>Copies of utility bills</li>
              <li>Payment information</li>
            </ul>
            <p>Buyers open service in their own name, so they don’t need the seller’s account details.</p>
          </div>
        </div>
      </section>

      <section id="send-as-link" className="marketing-inner-section ust-section">
        <div className="marketing-container">
          <h2 className="marketing-inner-title">Skip the printing: send it as a link</h2>
          <p className="ust-intro">
            Paper forms come back half-filled, and someone has to retype them. UtilitySheet turns the same
            sheet into one reusable link sellers finish on their phone.
          </p>
          <div className="ust-compare" role="table" aria-label="Printable template compared with a UtilitySheet link">
            <div className="ust-compare-row ust-compare-head" role="row">
              <span role="columnheader"><span className="sr-only">Comparison</span></span>
              <span role="columnheader">Printable template</span>
              <span role="columnheader">UtilitySheet link</span>
            </div>
            {comparison.map((item) => (
              <div key={item.row} className="ust-compare-row" role="row">
                <span role="rowheader">{item.row}</span>
                <span role="cell">{item.paper}</span>
                <span role="cell">{item.link}</span>
              </div>
            ))}
          </div>
          <div className="marketing-actions mt-8">
            <Link href="/auth/signup" className="marketing-button">
              Create your free seller link <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link href="/demo" className="marketing-text-link">
              Try the seller experience <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="marketing-inner-section ust-section ust-section-alt">
        <div className="marketing-container">
          <h2 className="marketing-inner-title">Questions</h2>
          <dl className="ust-faq">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <dt>{faq.question}</dt>
                <dd>{faq.answer}</dd>
              </div>
            ))}
            <div>
              <dt>How is this different from the closing utility checklist?</dt>
              <dd>
                The <Link href="/real-estate-closing-utility-checklist">closing utility checklist</Link> covers
                the steps your team follows. This template is the form the seller fills in. For a version
                sellers complete online, see the{' '}
                <Link href="/seller-utility-information-form">seller utility information form</Link>.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <MarketingCtaBand
        title="Ready to stop retyping utility forms?"
        description="Create your free seller link and try it on your next listing. Three submitted sheets a month, free. No credit card required."
      />
    </div>
  );
}
