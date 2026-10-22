import Link from "next/link";
import {
  ArrowRight,
  Check,
  Droplets,
  FileText,
  Flame,
  Globe,
  ListChecks,
  MapPin,
  Search,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  MockBranding,
  MockCompletionEmail,
  MockEditSheet,
  MockFormSettings,
  MockGuidedForm,
  MockPacketSections,
  MockSellerLink,
  MockSheet,
  MockSuggestions,
  MockTeam,
} from "@/components/marketing/product-mockups";

function HeroArt() {
  return (
    <figure className="ft-hero-art">
      <div className="ft-hero-stage" aria-hidden="true">
        <div className="ft-geometry"><i /><i /><i /><i /></div>
        <div className="ft-browser">
          <div className="ft-browser-bar">
            <span className="ft-browser-dots"><i /><i /><i /></span>
            <span className="ft-browser-url">Seller form</span>
          </div>
          <div className="ft-browser-body">
            <ol className="ft-stepper">
              <li className="is-done"><span><Check size={12} /></span>Home</li>
              <li className="is-current"><span>2</span>Utilities</li>
              <li><span>3</span>HOA</li>
              <li><span>4</span>Review</li>
            </ol>
            <p className="ft-browser-title">Who provides utilities here?</p>
            <p className="ft-browser-address"><MapPin size={13} /> 123 Maple Ave, Springfield</p>
            <ul className="ft-browser-rows">
              {[
                { icon: Zap, utility: "Electricity", provider: "Maple Electric", done: true },
                { icon: Droplets, utility: "Water & sewer", provider: "Springfield Water", done: true },
                { icon: Flame, utility: "Natural gas", provider: "Springfield Gas", done: false },
              ].map(({ icon: Icon, utility, provider, done }) => (
                <li key={utility}>
                  <span className="mock-icon"><Icon size={14} /></span>
                  <span className="mock-stack"><b>{provider}</b><small>{utility} · Suggested</small></span>
                  {done ? <span className="mock-confirmed"><Check size={13} /> Confirmed</span> : <span className="mock-button mock-button-small">Confirm</span>}
                </li>
              ))}
            </ul>
            <p className="mock-footnote"><Search size={13} /> Not right? Search or enter your own.</p>
          </div>
        </div>
        <div className="ft-float ft-float-list">
          <p className="mock-title"><ListChecks size={15} /> On this sheet</p>
          <ul>
            {["Electricity", "Natural gas", "Water & sewer", "Internet", "Trash & recycling"].map((item) => (
              <li key={item}><Check size={12} />{item}</li>
            ))}
          </ul>
        </div>
        <div className="ft-float ft-float-done">
          <span className="ft-done-icon"><Check size={16} /></span>
          <span className="mock-stack"><b>Seller submitted</b><small><Globe size={11} /> Web sheet + <FileText size={11} /> PDF ready</small></span>
        </div>
      </div>
      <figcaption>Illustrative preview with a sample property and providers.</figcaption>
    </figure>
  );
}

const essentials: { title: string; copy: string; mock: ReactNode }[] = [
  {
    title: "One link for every property",
    copy: "Add your reusable seller link to a welcome email, text template, or closing checklist. Sellers start with the property address, so the same link works on your next file.",
    mock: <MockSellerLink />,
  },
  {
    title: "A form that works on their phone",
    copy: "Sellers answer one clear question at a time, with HOA and condo questions built in. No account to create and no app to download.",
    mock: <MockGuidedForm />,
  },
  {
    title: "A head start on providers",
    copy: "Address-based suggestions help sellers find likely providers when available. They confirm the match, search for another, or enter their own.",
    mock: <MockSuggestions />,
  },
  {
    title: "Ask what matters for the file",
    copy: "Choose utilities, HOA questions, and the electric meter number on a saved form or a single request. Free includes one saved form; Pro and Teams include up to ten.",
    mock: <MockFormSettings />,
  },
  {
    title: "A sheet that is ready to share",
    copy: "Every submission becomes a clean web sheet and a downloadable PDF, with each provider and its contact details in one organized place.",
    mock: <MockSheet rows={3} />,
  },
  {
    title: "Know the moment it is done",
    copy: "Get a completion email when the seller submits, with the PDF attached if you want it. Track every request from your dashboard.",
    mock: <MockCompletionEmail />,
  },
];

const growth: { eyebrow: string; title: ReactNode; copy: string; points: string[]; mock: ReactNode }[] = [
  {
    eyebrow: "BRANDING",
    title: <>Your name on <em>the handoff.</em></>,
    copy: "Branding Profiles carry your logo, colors, and contact details onto the seller form, the web sheet, and the PDF.",
    points: ["Your own link name", "Branded PDFs and completion attachments", "No UtilitySheet footer"],
    mock: <MockBranding />,
  },
  {
    eyebrow: "EDITING",
    title: <>Fix a detail <em>without starting over.</em></>,
    copy: "Details collected early can change before closing. Correct the sheet from your dashboard instead of sending the seller back through the form.",
    points: ["Providers, phone numbers, and websites", "Address, home basics, and HOA details", "New PDF downloads use your saved changes"],
    mock: <MockEditSheet />,
  },
  {
    eyebrow: "PROPERTY HANDOFF PACKET",
    title: <>More than <em>the utility companies.</em></>,
    copy: "Packet mode collects utilities, home systems, access details, and service contacts in the same seller handoff, so the buyer gets the whole picture.",
    points: ["Turn each optional section on or off", "Lawn, snow, irrigation, and mailbox details", "Recurring home service contacts"],
    mock: <MockPacketSections />,
  },
];

export function FeaturesShowcase() {
  return (
    <>
      <section className="ft-hero" aria-labelledby="features-title">
        <div className="marketing-container ft-hero-grid">
          <div className="ft-hero-copy">
            <p className="marketing-eyebrow">FEATURES</p>
            <h1 id="features-title">
              Everything the handoff needs.
              <br />
              <em>Nothing it doesn’t.</em>
            </h1>
            <p className="ft-lead">
              Reusable seller links, a guided form sellers finish on their phone, provider suggestions, and a clean web sheet and PDF. Add branding, editing, and team access as your workflow grows.
            </p>
            <div className="marketing-actions">
              <Link href="/auth/signup" className="marketing-button">Start free</Link>
              <Link href="/demo" className="marketing-button marketing-button-outline">Try the seller experience</Link>
            </div>
            <p className="ft-fineprint">3 submitted sheets per month, free. No credit card required.</p>
          </div>
          <HeroArt />
        </div>
      </section>

      <section className="ft-essentials marketing-section" aria-labelledby="essentials-title">
        <div className="marketing-container">
          <div className="section-heading-row">
            <div>
              <p className="marketing-eyebrow">INCLUDED ON EVERY PLAN</p>
              <h2 id="essentials-title">The essentials, <em>built in.</em></h2>
            </div>
            <p>Everything a seller needs to finish the form, and everything you need to share what they send back. Free to start.</p>
          </div>
          <div className="ft-grid">
            {essentials.map(({ title, copy, mock }, index) => (
              <article className="ft-card" key={title}>
                <span className="ft-card-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
                <div className="ft-card-stage">{mock}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ft-growth marketing-section" aria-labelledby="growth-title">
        <div className="marketing-container">
          <div className="section-heading-row">
            <div>
              <p className="marketing-eyebrow">PRO + TEAMS</p>
              <h2 id="growth-title">When it becomes part <em>of every file.</em></h2>
            </div>
            <p>Upgrade when the workflow sticks. Pro and Teams add your branding, editing after submission, and a fuller property handoff.</p>
          </div>
          <div className="ft-rows">
            {growth.map(({ eyebrow, title, copy, points, mock }) => (
              <article className="ft-row" key={eyebrow}>
                <div className="ft-row-copy">
                  <p className="capability-label">{eyebrow}</p>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                  <ul>
                    {points.map((point) => (
                      <li key={point}><span><Check size={12} aria-hidden="true" /></span>{point}</li>
                    ))}
                  </ul>
                </div>
                <div className="ft-row-stage">{mock}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ft-team marketing-section" aria-labelledby="team-title">
        <div className="marketing-container ft-team-grid">
          <div>
            <p className="marketing-eyebrow">TEAMS</p>
            <h2 id="team-title">One workspace. <em>Everyone on the same file.</em></h2>
            <p className="ft-team-copy">
              Coordinators, agents, and support staff share request access and Branding Profiles in one workspace. Each member keeps their own seller forms, up to ten each.
            </p>
            <ul className="ft-team-points">
              <li><Check size={15} aria-hidden="true" /> Invite members and assign Admin or Member roles</li>
              <li><Check size={15} aria-hidden="true" /> Any teammate with request access can edit submitted sheets</li>
              <li><Check size={15} aria-hidden="true" /> $7 per seat each month, with a 3-seat minimum</li>
            </ul>
            <Link href="/pricing" className="marketing-text-link">
              Compare plans <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <figure className="ft-team-art">
            <div className="ft-team-stage">
              <MockTeam />
            </div>
            <figcaption>Illustrative preview with sample team members.</figcaption>
          </figure>
        </div>
      </section>
    </>
  );
}
