import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Link2, ClipboardCheck, Send } from "lucide-react";

const steps = [
  {
    icon: Link2,
    title: "Share your seller link",
    description:
      "Copy your reusable link from the dashboard. Add it to a listing email, text it to a seller, or include it in your closing checklist.",
    image: "/landing/demo-seller-link-dashboard.jpg",
    alt: "Dashboard with a reusable seller link ready to copy",
    detail: "One link, ready for your next property.",
  },
  {
    icon: ClipboardCheck,
    title: "Let the seller fill in the details",
    description:
      "Sellers enter the address and follow a guided form. They can confirm suggested providers, search, or enter their own details. No account or app needed.",
    image: "/landing/demo-provider-confirmation.jpg",
    alt: "Guided seller form for confirming utility information",
    detail: "A simple form that works on their phone.",
  },
  {
    icon: Send,
    title: "Review it. Then hand it off.",
    description:
      "Get a clean web sheet and downloadable PDF. Review the details, then share with the buyer or your team. Pro and Teams let you correct submitted sheets.",
    image: "/landing/demo-dashboard-saved.jpg",
    alt: "Submitted sheets ready to review, share, and download as a PDF",
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
            ({ icon: Icon, title, description, image, alt, detail }, index) => (
              <li key={title}>
                <span className="timeline-number">
                  <span className="sr-only">Step </span>
                  {index + 1}
                </span>
                <div className="timeline-preview">
                  <Image
                    src={image}
                    alt={alt}
                    width={1600}
                    height={900}
                    sizes="(max-width: 767px) 90vw, 30vw"
                  />
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
          Get your seller link <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}
