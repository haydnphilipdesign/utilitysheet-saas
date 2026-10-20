import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import '../guide.css';

import { MarketingBreadcrumbs, MarketingCtaBand } from '@/components/marketing/page-shell';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbSchema } from '@/lib/seo/schema';
import { createPageMetadata } from '@/lib/seo/site';

const path = '/guides/transfer-utilities-when-selling-a-house';
const pageName = 'Transferring Utilities When Selling a House';

export const metadata: Metadata = createPageMetadata({
  title: pageName,
  description:
    'When to call each utility provider when you sell your home, why service should stay on through the final walkthrough, and what to leave for the buyer.',
  path,
  keywords: [
    'how to transfer utilities when selling a house',
    'when to shut off utilities when selling a house',
    'cancel utilities when selling home',
    'utilities final walkthrough',
  ],
});

const contents = [
  { id: 'when-to-do-what', label: 'When to do what' },
  { id: 'what-to-ask', label: 'What to ask each provider' },
  { id: 'final-walkthrough', label: 'The final walkthrough' },
  { id: 'equipment-and-hoa', label: 'Equipment, fuel, and the HOA' },
  { id: 'buyer-utility-sheet', label: 'Leave the buyer a utility sheet' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'questions', label: 'Questions' },
];

const timeline: { stage: string; items: ReactNode[] }[] = [
  {
    stage: 'As soon as you list',
    items: [
      'Pull up a recent bill or log in to each online account, so every provider name and phone number is in one place.',
      'Note the less obvious services: propane or heating oil delivery, a private trash hauler, septic service, well equipment, or a security system.',
      'If your agent sends you a utility form, fill it in now while it’s fresh.',
    ],
  },
  {
    stage: 'Two to three weeks before closing',
    items: [
      'Contact each provider to schedule a stop date. They’ll ask for your account details, but the buyer won’t need them.',
      'Ask how the final bill works: whether there’s a final meter reading, where the bill will be sent, and whether a deposit is refunded.',
      'Set up service at your new home, so there’s no gap where you’re going.',
      'For internet and cable, ask how to return equipment, or whether you can move service to your new address.',
      'Forward your mail (in the US, through USPS), so final bills reach you.',
    ],
  },
  {
    stage: 'Closing week',
    items: [
      'Confirm each stop date. Closing dates move; if yours does, move your stop dates too.',
      <>
        Leave service on for the <a href="#final-walkthrough">final walkthrough</a>.
      </>,
      'On your last day, consider taking dated photos of any meters you can reach. They help if a final bill looks wrong.',
      'Leave the utility list for the buyer, or confirm your agent has it.',
    ],
  },
  {
    stage: 'After closing',
    items: [
      'Watch for final bills and pay them from your new address.',
      'Return internet and cable equipment by the provider’s deadline, and keep the receipt.',
      'Turn off autopay only after the final bills have cleared.',
      'Keep the final statements in case you need to dispute a charge for service after closing day.',
    ],
  },
];

const providerQuestions = [
  {
    utility: 'Electric',
    ask: 'Stop date, final meter reading, where the final bill goes, and any deposit refund.',
  },
  {
    utility: 'Natural gas',
    ask: 'The same as electric. If service will be shut off at the meter, ask whether the buyer will need an appointment to turn it back on.',
  },
  {
    utility: 'Water and sewer',
    ask: 'Who takes the final reading and sends the final bill. In some towns this is the city or a water authority, and the final bill is settled through closing. Ask your agent or closing company how it works where you live.',
  },
  {
    utility: 'Trash and recycling',
    ask: 'Whether service is public or a private hauler, when to stop it, and whether the bins stay with the house.',
  },
  {
    utility: 'Propane or heating oil',
    ask: 'Whether you own or lease the tank, how to close the account, and how fuel left in the tank is handled. Check your purchase contract too.',
  },
  {
    utility: 'Internet and cable/TV',
    ask: 'Whether to cancel or move service, how and when to return equipment, and any early termination fee.',
  },
  {
    utility: 'Septic, well, security, and other services',
    ask: 'Whether service agreements can pass to the buyer or should be cancelled, and who the buyer can call.',
  },
];

const extras = [
  {
    title: 'Internet and TV equipment',
    body: 'Modems, routers, and TV boxes often belong to the provider, and unreturned equipment can be charged to you. Equipment you bought yourself is yours to take or leave.',
  },
  {
    title: 'Fuel tanks',
    body: 'Propane tanks are often leased from the supplier. Heating oil tanks usually stay with the house. Either way, tell the supplier you’re selling, and check what your contract says about fuel left in the tank. In some areas the buyer pays the seller for it at closing.',
  },
  {
    title: 'Trash and recycling bins',
    body: 'In many towns, bins belong to the hauler or the town and stay with the address. Ask before you take them.',
  },
  {
    title: 'HOA or condo association',
    body: 'Dues are usually settled at closing by your closing company. Give the buyer the association name and management contact so they know who to call.',
  },
];

const checklist = [
  'List every utility and service, with provider names and phone numbers',
  'Schedule stop dates, often closing day or the day after',
  'Ask about final readings, final bills, and deposit refunds',
  'Set up utilities at your new home',
  'Forward your mail',
  'Arrange internet and TV equipment returns',
  'Check your contract for how fuel in the tank is handled',
  'Confirm stop dates in closing week, and move them if closing moves',
  'Keep service on through the final walkthrough',
  'Leave the buyer a utility sheet, without account numbers',
  'Pay final bills, then turn off autopay',
];

const faqs = [
  {
    question: 'Do I transfer my utilities to the buyer or cancel them?',
    answer:
      'Usually you stop service in your name and the buyer starts their own. A few providers let the buyer take over an existing service, and many call the whole process a transfer. Ask each provider what they need from you.',
  },
  {
    question: 'When should I schedule the shut-off?',
    answer:
      'Many sellers choose closing day or the day after, so service stays on for the final walkthrough and the buyer has no gap. Your agent can tell you if your contract says otherwise.',
  },
  {
    question: 'Should I give the buyer my account numbers?',
    answer:
      'No. The buyer opens accounts in their own name and only needs provider names and contact details.',
  },
  {
    question: 'What if closing is delayed?',
    answer:
      'Contact each provider and move your stop dates. Otherwise service could end while you still own the home.',
  },
  {
    question: 'Who pays the final water bill?',
    answer:
      'It depends on where you live. In some areas you pay it directly after a final reading; in others it’s settled at closing. Ask your agent or closing company.',
  },
];

export default function TransferUtilitiesWhenSellingPage() {
  return (
    <div className="bg-background">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: pageName, path },
          ]),
        ]}
      />

      <section className="marketing-inner-hero guide-hero">
        <div className="marketing-container guide-hero-grid">
          <div>
            <p className="marketing-eyebrow">Seller guide</p>
            <h1 className="text-balance">How to transfer utilities when you sell your house</h1>
            <p className="guide-lead">
              Selling a home usually means stopping service in your name around closing day and leaving the
              buyer what they need to start their own. Here’s what to do and when, from a few weeks out to
              after the keys change hands.
            </p>
            <p className="guide-meta">Updated October 2026</p>
            <p className="guide-hedge">
              Rules and lead times vary by provider and region. Your agent, your closing company, and each
              provider have the final word for your home.
            </p>
            <MarketingBreadcrumbs
              items={[
                { label: 'Home', href: '/' },
                { label: pageName, href: path },
              ]}
            />
          </div>
          <nav className="guide-toc" aria-labelledby="guide-toc-title">
            <p id="guide-toc-title" className="guide-toc-title">
              On this page
            </p>
            <ol>
              {contents.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`}>{item.label}</a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </section>

      <section className="marketing-inner-section guide-section">
        <div className="marketing-container guide-two-col">
          <div className="guide-summary">
            <h2 className="marketing-inner-title">The short version</h2>
            <ul>
              <li>List every utility and service at the home, with each provider’s name and phone number.</li>
              <li>
                Two to three weeks before closing, schedule a stop date with each provider. Many sellers pick
                closing day or the day after.
              </li>
              <li>Keep everything on through the buyer’s final walkthrough.</li>
              <li>Leave the buyer a list of providers, without your account numbers.</li>
            </ul>
          </div>
          <aside className="guide-aside" aria-labelledby="guide-transfer-title">
            <h3 id="guide-transfer-title">About the word “transfer”</h3>
            <p>
              Most of the time you don’t hand your account to the buyer. You stop service in your name, and
              the buyer starts service in theirs. Providers often call this a transfer, and some let you move
              service to your new address in the same call.
            </p>
          </aside>
        </div>
      </section>

      <section id="when-to-do-what" className="marketing-inner-section guide-section guide-section-alt">
        <div className="marketing-container">
          <h2 className="marketing-inner-title">When to do what</h2>
          <ol className="guide-timeline">
            {timeline.map((stage) => (
              <li key={stage.stage}>
                <h3>{stage.stage}</h3>
                <ul>
                  {stage.items.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="what-to-ask" className="marketing-inner-section guide-section">
        <div className="marketing-container">
          <h2 className="marketing-inner-title">What to ask each provider</h2>
          <p className="guide-intro">
            Every provider handles this a little differently. These questions cover what usually matters.
          </p>
          <table className="guide-table">
            <thead>
              <tr>
                <th scope="col">Utility</th>
                <th scope="col">What to ask</th>
              </tr>
            </thead>
            <tbody>
              {providerQuestions.map((row) => (
                <tr key={row.utility}>
                  <th scope="row">{row.utility}</th>
                  <td>{row.ask}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="final-walkthrough" className="marketing-inner-section guide-section guide-section-alt">
        <div className="marketing-container">
          <div className="guide-prose">
            <h2 className="marketing-inner-title">Keep service on through the final walkthrough</h2>
            <p>
              Most buyers walk through the home shortly before closing to check that it’s in the condition
              they agreed to. They’ll flip switches, run the taps, and test the heat, air conditioning, and
              appliances. That only works if the power, water, and gas are still on.
            </p>
            <p>
              That’s why many sellers set stop dates for closing day or the day after, rather than the day
              they move out. Ask your agent what fits your closing, since some purchase contracts say how
              utilities must be left.
            </p>
            <p>
              If the home will sit empty in cold weather before closing, keep the heat on to help protect the
              pipes. Your homeowner’s insurance may also have rules for vacant homes.
            </p>
          </div>
        </div>
      </section>

      <section id="equipment-and-hoa" className="marketing-inner-section guide-section">
        <div className="marketing-container">
          <h2 className="marketing-inner-title">Equipment, fuel, bins, and the HOA</h2>
          <dl className="guide-extras">
            {extras.map((item) => (
              <div key={item.title}>
                <dt>{item.title}</dt>
                <dd>{item.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="buyer-utility-sheet" className="marketing-inner-section guide-section guide-section-alt">
        <div className="marketing-container guide-two-col">
          <div className="guide-prose">
            <h2 className="marketing-inner-title">Leave the buyer a utility sheet</h2>
            <p>
              A one-page list of who provides each service saves the next owner a week of guessing and calling
              the wrong company. It also saves your agent a follow-up call.
            </p>
            <p>
              The buyer opens new accounts in their own name, so they don’t need yours. If you’re buying your
              next home, the <Link href="/guides/set-up-utilities-when-buying-a-house">buyer guide</Link>{' '}
              covers the other side.
            </p>
            <div className="marketing-actions mt-6">
              <Link href="/utility-sheet-template" className="marketing-button">
                Get the free template <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <p className="guide-small">
              If your agent or transaction coordinator uses UtilitySheet, they may send you a link instead.
              You fill it in on your phone, without an account, and they receive the finished sheet.
            </p>
          </div>
          <div className="guide-lists">
            <div>
              <h3>Include</h3>
              <ul>
                <li>Provider name, phone number, and website for each utility</li>
                <li>Whether the home has public water or a well, sewer or septic, and what fuel heats it</li>
                <li>The HOA or condo association name and contact, if there is one</li>
              </ul>
            </div>
            <div className="guide-leave-off">
              <h3>Leave off</h3>
              <ul>
                <li>Account numbers</li>
                <li>Passwords, PINs, or security answers</li>
                <li>Copies of bills or payment details</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="checklist" className="marketing-inner-section guide-section">
        <div className="marketing-container">
          <h2 className="marketing-inner-title">Seller utility checklist</h2>
          <ul className="guide-checklist">
            {checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section id="questions" className="marketing-inner-section guide-section guide-section-alt">
        <div className="marketing-container">
          <h2 className="marketing-inner-title">Questions</h2>
          <dl className="guide-faq">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <dt>{faq.question}</dt>
                <dd>{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <MarketingCtaBand
        title="Agents and TCs: send this with your seller link"
        description="Share this guide when you list, and pair it with a UtilitySheet link. Sellers confirm their providers on their phone without an account, and you get a clean utility sheet and PDF back for the buyer. Free for 3 submitted sheets a month."
      />
    </div>
  );
}
