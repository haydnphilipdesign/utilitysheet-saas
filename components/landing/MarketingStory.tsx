"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useInView } from "framer-motion";
import { ArrowUpRight, Check, FileText, PencilLine, Send } from "lucide-react";
import { trackEvent } from "@/lib/analytics/events";

export function MarketingWorkflow() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true });
  useEffect(() => {
    if (!isInView) return;
    trackEvent("landing_section_viewed", {
      section_id: "how_it_works",
      page: "landing",
      location: "how_it_works",
    });
  }, [isInView]);
  return (
    <section
      ref={sectionRef}
      className="marketing-workflow marketing-section"
      id="how-it-works"
    >
      <div className="marketing-container">
        <div className="section-heading-row">
          <div>
            <p className="marketing-eyebrow">A SMALL TASK, TAKEN CARE OF</p>
            <h2>
              From “who’s your provider?”
              <br />
              to <em>ready to share.</em>
            </h2>
          </div>
          <p>
            Give every property the same simple process. No blank forms to
            format or scattered answers to piece together.
          </p>
        </div>
        <div className="workflow-grid">
          {[
            {
              number: "01",
              icon: Send,
              title: "Send your seller link",
              copy: "Copy your reusable link into an email, text, or checklist you already use. Use it again for the next property.",
            },
            {
              number: "02",
              icon: PencilLine,
              title: "Let the seller fill in the details",
              copy: "Sellers enter the address and confirm their providers on their phone. Suggestions help them get started. No login needed.",
            },
            {
              number: "03",
              icon: FileText,
              title: "Review. Download. Hand off.",
              copy: "Get a completion notification, review the finished sheet, and share the web link or PDF with the people who need it.",
            },
          ].map(({ number, icon: Icon, title, copy }) => (
            <article key={number}>
              <div className="workflow-step-top">
                <span>{number}</span>
                <Icon size={22} />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <div className="workflow-moments">
          <div>
            <p className="marketing-eyebrow">
              WHEN TO SEND IT
            </p>
            <p className="workflow-moments-intro">
              Closing is the outcome. It does not have to be the collection
              date.
            </p>
          </div>
          <ul>
            {[
              {
                label: "At listing intake",
                copy: "Add the link to your seller welcome email or listing checklist. Review the details before you share them later.",
              },
              {
                label: "Listing side, before closing",
                copy: "Send the link directly to your seller as part of closing prep.",
              },
              {
                label: "Buyer side, before closing",
                copy: "Ask the listing agent to forward the link to the seller, who fills in the details.",
              },
            ].map(({ label, copy }) => (
              <li key={label}>
                <h3>{label}</h3>
                <p>{copy}</p>
              </li>
            ))}
          </ul>
          <Link href="/tc-utility-handoff-kit" className="marketing-text-link">
            Copy an email for each <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="workflow-video">
          <div>
            <p className="marketing-eyebrow">SEE THE REAL WORKFLOW</p>
            <h3>
              A minute here.
              <br />
              One less thing on your list.
            </h3>
            <p>
              Watch the 66-second walkthrough, from seller link to finished
              sheet.
            </p>
            <Link href="/demo" className="marketing-text-link">
              Try it yourself <ArrowUpRight size={17} />
            </Link>
          </div>
          <video
            controls
            muted
            playsInline
            preload="none"
            poster="/landing/utilitysheet-demo-poster.jpg"
            aria-label="UtilitySheet 66-second product walkthrough"
            onPlay={() =>
              trackEvent("landing_demo_video_played", {
                page: "landing",
                location: "workflow",
              })
            }
          >
            <source src="/landing/utilitysheet-demo.mp4" type="video/mp4" />
            Your browser does not support video.
          </video>
        </div>
      </div>
    </section>
  );
}

export function MarketingCapabilities() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true });
  useEffect(() => {
    if (!isInView) return;
    trackEvent("landing_section_viewed", {
      section_id: "features",
      page: "landing",
      location: "features",
    });
    trackEvent("pdf_attachment_value_prop_viewed", {
      section_id: "features",
      page: "landing",
      location: "features",
    });
  }, [isInView]);
  return (
    <section
      ref={sectionRef}
      className="marketing-capabilities marketing-section"
    >
      <div className="marketing-container capability-grid">
        <div>
          <p className="marketing-eyebrow">THE DETAILS MAKE THE DIFFERENCE</p>
          <h2>
            A thoughtful finish
            <br />
            for <em>every file.</em>
          </h2>
          <p className="capability-intro">
            Start with utilities. Add your branding, make a correction, or
            collect a fuller property handoff as your workflow grows.
          </p>
          <Link href="/features" className="marketing-text-link">
            Explore all features <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="capability-list">
          {[
            [
              "01",
              "Ready when the seller is done",
              "Completion email + PDF attachment",
              "The completed PDF can attach to your completion email. Review it, download it, and keep the closing file moving.",
            ],
            [
              "02",
              "Your name on the handoff",
              "PRO + TEAMS",
              "Add your logo and colors to the finished PDF and use a branded seller link for a consistent client experience.",
            ],
            [
              "03",
              "Room for a correction before handoff",
              "PRO + TEAMS",
              "Details collected early can change before closing. Edit submitted details from your dashboard. Future PDF downloads reflect your changes; earlier email attachments stay as sent.",
            ],
            [
              "04",
              "More than the utility companies",
              "PRO + TEAMS",
              "Property Handoff Packet mode adds home systems, access details, and service contacts to the same seller handoff. Check codes and key handoff details closer to closing.",
            ],
          ].map(([number, title, label, copy]) => (
            <article key={number}>
              <span className="capability-number">{number}</span>
              <div>
                <p className="capability-label">{label}</p>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MarketingAudience() {
  return (
    <section className="marketing-audience">
      <div className="marketing-container">
        <p>
          Made for the people
          <br />
          <strong>moving a file from listing to closing.</strong>
        </p>
        <Link href="/utility-sheet-for-transaction-coordinators">
          Transaction coordinators <ArrowUpRight size={19} />
        </Link>
        <Link href="/utility-sheet-for-real-estate-agents">
          Real estate agents <ArrowUpRight size={19} />
        </Link>
        <Link href="/tc-utility-handoff-kit">
          <Check size={17} /> Free handoff templates <ArrowUpRight size={19} />
        </Link>
      </div>
    </section>
  );
}
