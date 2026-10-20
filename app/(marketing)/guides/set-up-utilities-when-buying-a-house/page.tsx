import type { Metadata } from 'next';
import Link from 'next/link';
import '../guide.css';

import { MarketingBreadcrumbs, MarketingCtaBand } from '@/components/marketing/page-shell';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbSchema } from '@/lib/seo/schema';
import { createPageMetadata } from '@/lib/seo/site';

const path = '/guides/set-up-utilities-when-buying-a-house';
const pageName = 'How to Set Up Utilities When You Buy a House';

export const metadata: Metadata = createPageMetadata({
  title: pageName,
  description:
    'Who to call, when to call, and what to have ready so the power, water, and internet are on when you move into your new home. Includes a checklist.',
  path,
  keywords: [
    'set up utilities new house checklist',
    'how to set up utilities when buying a house',
    'utilities after closing',
    'new homeowner utilities checklist',
  ],
});

const contents = [
  { id: 'who-provides-service', label: 'Who provides service' },
  { id: 'when-to-do-what', label: 'When to do what' },
  { id: 'what-to-ask', label: 'What to ask each provider' },
  { id: 'what-to-have-ready', label: 'What to have ready' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'questions', label: 'Questions' },
];

const timeline = [
  {
    stage: 'Once you’re under contract',
    items: [
      'Get the provider list from your agent, or ask the seller for it through your agent.',
      'Find out whether the home uses propane or heating oil, a well, or a septic system, since those need their own contacts.',
      'Check which internet providers serve the address.',
    ],
  },
  {
    stage: 'Two to three weeks before closing',
    items: [
      'Contact each utility to start service in your name on your closing date or the next business day.',
      'Schedule internet installation. Earlier is better if you work from home.',
      'Ask whether a deposit or credit check is needed, so it doesn’t hold up your start date.',
      'Set up mail forwarding from your old address (in the US, through USPS).',
    ],
  },
  {
    stage: 'Closing week',
    items: [
      'Confirm each start date. If closing moves, move your start dates too.',
      'At the final walkthrough, check that the lights, water, heat, and air conditioning work.',
      'On move-in day, consider taking dated photos of the meters you can reach. They help if your first bill looks wrong.',
    ],
  },
  {
    stage: 'After you move in',
    items: [
      'Set up online accounts and autopay once each account is active.',
      'Note your trash and recycling pickup day.',
      'If the home uses propane or heating oil, set up deliveries with a supplier.',
      'Watch your first bills and check that the start dates match.',
    ],
  },
];

const providerQuestions = [
  {
    utility: 'Electric',
    ask: 'Start date, whether a deposit is needed, whether you can choose a supplier where you live, and how to report outages.',
  },
  {
    utility: 'Natural gas',
    ask: 'Start date, whether a deposit is needed, and whether a technician needs to visit to turn service on or relight pilot lights.',
  },
  {
    utility: 'Water and sewer',
    ask: 'Who runs it, since it’s often the town or a water authority. Ask about the start date and how billing works. In some areas water accounts follow the owner and change at closing, so check with your agent or closing company.',
  },
  {
    utility: 'Trash and recycling',
    ask: 'Whether service is public or a private hauler, the pickup day, and whether the bins come with the house.',
  },
  {
    utility: 'Propane or heating oil',
    ask: 'Whether the tank is owned or leased, how deliveries work, and how fuel left in the tank is handled. Check your purchase contract too.',
  },
  {
    utility: 'Internet and cable/TV',
    ask: 'Which providers serve the address, the earliest installation date, and what equipment you’ll need.',
  },
  {
    utility: 'Well, septic, security, and other services',
    ask: 'Who the seller used for service, and whether any agreements pass to you or need to be set up fresh.',
  },
];

const checklist = [
  'Get the list of providers for the home',
  'Check for propane, heating oil, a well, or septic',
  'Find the internet providers for the address',
  'Schedule electric, gas, water, and trash to start on closing day or the next business day',
  'Book internet installation',
  'Ask about deposits or credit checks',
  'Forward your mail',
  'Confirm start dates in closing week, and move them if closing moves',
  'Check the utilities at the final walkthrough',
  'Set up online accounts and autopay',
  'Note your trash pickup day',
];

const faqs = [
  {
    question: 'Do I need to cancel the seller’s service?',
    answer:
      'No. The seller stops service in their name, and you start yours. You only need to contact providers about your own accounts.',
  },
  {
    question: 'What if the power or water is off when I move in?',
    answer:
      'Contact the provider and ask them to start service. Many can do it quickly, but it isn’t guaranteed, which is why it helps to schedule ahead.',
  },
  {
    question: 'Can I keep the seller’s internet service?',
    answer:
      'Usually not. The account is in the seller’s name, so you’ll set up your own, even if it’s with the same provider.',
  },
  {
    question: 'Do I need to be home when service starts?',
    answer:
      'Often not for electric or water. Internet installation, and sometimes gas, may need someone there. Ask when you schedule.',
  },
  {
    question: 'Who pays for propane or heating oil left in the tank?',
    answer:
      'It depends on your contract and where you live. In some areas the buyer pays the seller for it at closing. Ask your agent.',
  },
];

export default function SetUpUtilitiesWhenBuyingPage() {
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
            <p className="marketing-eyebrow">Buyer guide</p>
            <h1 className="text-balance">How to set up utilities when you buy a house</h1>
            <p className="guide-lead">
              When you buy a home, the seller usually stops service in their name around closing, and you
              start service in yours. Here’s who to call, when to call, and what to have ready, so the lights,
              water, and internet are on when you move in.
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
              <li>Get the list of providers for the home. Your agent may already have it.</li>
              <li>
                Two to three weeks before closing, ask each provider to start service in your name on your
                closing date or the next business day.
              </li>
              <li>Book internet early, since installation dates can be a week or two out.</li>
              <li>
                Keep your closing documents handy. Some providers ask for proof of ownership or a deposit.
              </li>
            </ul>
          </div>
          <aside className="guide-aside" aria-labelledby="guide-starting-title">
            <h3 id="guide-starting-title">You’re starting service, not taking it over</h3>
            <p>
              The seller closes their accounts and you open your own. You won’t need the seller’s account
              numbers, only the name of each provider.
            </p>
          </aside>
        </div>
      </section>

      <section id="who-provides-service" className="marketing-inner-section guide-section guide-section-alt">
        <div className="marketing-container">
          <div className="guide-prose">
            <h2 className="marketing-inner-title">Find out who provides service</h2>
            <p>
              Start by asking your agent. Many agents and transaction coordinators collect a list of the
              seller’s providers before closing. If you don’t have one, ask the seller through your agent.
              They know who they’ve been paying.
            </p>
            <p>
              You can also check the home’s town or county website for water, sewer, and trash, and the
              electric and gas companies’ websites, which usually let you check service by address. For
              internet, search providers by the exact address, because coverage can change from one street to
              the next.
            </p>
            <p>
              In some areas you can choose who supplies your electricity or gas, while the local utility still
              delivers it and handles outages. The local utility can tell you whether that applies to your
              home.
            </p>
          </div>
        </div>
      </section>

      <section id="when-to-do-what" className="marketing-inner-section guide-section">
        <div className="marketing-container">
          <h2 className="marketing-inner-title">When to do what</h2>
          <ol className="guide-timeline">
            {timeline.map((stage) => (
              <li key={stage.stage}>
                <h3>{stage.stage}</h3>
                <ul>
                  {stage.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="what-to-ask" className="marketing-inner-section guide-section guide-section-alt">
        <div className="marketing-container">
          <h2 className="marketing-inner-title">What to ask each provider</h2>
          <p className="guide-intro">
            Every provider handles new service a little differently. These questions cover what usually
            matters.
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

      <section id="what-to-have-ready" className="marketing-inner-section guide-section">
        <div className="marketing-container guide-two-col">
          <div className="guide-prose">
            <h2 className="marketing-inner-title">What to have ready when you call</h2>
            <ul className="guide-bullets">
              <li>The property address, including any unit number</li>
              <li>Your closing date</li>
              <li>Your phone number and email</li>
              <li>
                ID, and possibly your Social Security number if the provider runs a credit check (in the US)
              </li>
              <li>Proof of ownership or your closing documents, if they ask</li>
            </ul>
          </div>
          <aside className="guide-aside" aria-labelledby="guide-sheet-title">
            <h3 id="guide-sheet-title">Got a utility sheet from your agent?</h3>
            <p>
              Start there. It lists the providers the seller used, with phone numbers and websites. It won’t
              include the seller’s account numbers, because you open accounts in your own name.
            </p>
            <p className="guide-aside-link">
              <Link href="/utility-sheet-template#what-is-a-utility-sheet">What’s a utility sheet?</Link>
            </p>
          </aside>
        </div>
      </section>

      <section id="checklist" className="marketing-inner-section guide-section guide-section-alt">
        <div className="marketing-container">
          <h2 className="marketing-inner-title">Buyer utility checklist</h2>
          <ul className="guide-checklist">
            {checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section id="questions" className="marketing-inner-section guide-section">
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
        title="Agents and TCs: send this with the buyer’s utility sheet"
        description="Share this guide with buyers along with their utility sheet. UtilitySheet collects the seller’s providers through one link and gives you a clean sheet and PDF to pass on. Free for 3 submitted sheets a month."
      />
    </div>
  );
}
