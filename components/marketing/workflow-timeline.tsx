import Link from "next/link";
import { ArrowRight, Link2, ClipboardCheck, Send } from "lucide-react";
import type { ReactNode } from "react";

import {
  MockSellerLink,
  MockSheet,
  MockSuggestions,
} from "@/components/marketing/product-mockups";

const steps: {
  icon: typeof Link2;
  title: string;
  description: string;
  preview: ReactNode;
  detail: string;
}[] = [
  {
    icon: Link2,
    title: "Share your seller link",
    description:
      "Copy your reusable link from the dashboard. Add it to a listing email, text it to a seller, or include it in your closing checklist.",
    preview: <MockSellerLink />,
    detail: "One link, ready for your next property.",
  },
  {
    icon: ClipboardCheck,
    title: "Let the seller fill in the details",
    description:
      "Sellers enter the address and follow a guided form. They can confirm suggested providers, search, or enter their own details. No account or app needed.",
    preview: <MockSuggestions />,
    detail: "A simple form that works on their phone.",
  },
  {
    icon: Send,
    title: "Review it. Then hand it off.",
    description:
      "Get a clean web sheet and downloadable PDF. Review the details, then share with the buyer or your team. Pro and Teams let you correct submitted sheets.",
    preview: <MockSheet rows={3} />,
    detail: "Buyer-ready information, all in one place.",
  },
];
export function WorkflowTimeline() {
  return (
    <>
      <section
        className="marketing-container workflow-timeline"
        aria-label="The three-step seller handoff"
      >
        <ol>
          {steps.map(
            ({ icon: Icon, title, description, preview, detail }, index) => (
              <li key={title}>
                <span className="timeline-number">
                  <span className="sr-only">Step </span>
                  {index + 1}
                </span>
                <div className="timeline-preview">
                  <div className="timeline-stage">{preview}</div>
                  <span>
                    <Icon size={23} aria-hidden="true" />
                  </span>
                </div>
                <h2>{title}</h2>
                <p>{description}</p>
                <span className="timeline-detail">{detail}</span>
              </li>
            ),
          )}
        </ol>
      </section>
      <section
        className="marketing-container workflow-start"
        aria-label="Try UtilitySheet"
      >
        <span className="subpage-icon">
          <Link2 size={26} aria-hidden="true" />
        </span>
        <div>
          <h2>Your next handoff starts with one link.</h2>
          <p>
            Start free with three submitted sheets per month. No credit card
            required.
          </p>
        </div>
        <Link href="/auth/signup" className="marketing-button">
          Create your free seller link <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}
