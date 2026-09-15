"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics/events";
import { useEffect, useRef } from "react";
import { useInView } from "framer-motion";

export function FinalCtaSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true });
  useEffect(() => {
    if (!isInView) return;
    trackEvent("landing_section_viewed", {
      section_id: "final_cta",
      page: "landing",
      location: "final_cta",
    });
    trackEvent("landing_primary_cta_viewed", {
      cta_id: "primary_final_start_free",
      page: "landing",
      location: "final_cta",
    });
  }, [isInView]);
  return (
    <section ref={sectionRef} className="marketing-final marketing-section">
      <div className="marketing-container">
        <p className="marketing-eyebrow">READY FOR YOUR NEXT CLOSING</p>
        <h2>
          One less thing to chase.
          <br />
          <em>One better way to hand it off.</em>
        </h2>
        <p>
          Create your free seller link and try it on your next file. Three live
          files per month. No credit card required.
        </p>
        <div className="marketing-actions">
          <Link
            href="/auth/signup"
            className="marketing-button"
            data-testid="marketing-final-signup-cta"
            onClick={() =>
              trackEvent("landing_primary_cta_clicked", {
                cta_id: "primary_final_start_free",
                destination: "/auth/signup",
                location: "final_cta",
              })
            }
          >
            Start free <ArrowRight size={17} />
          </Link>
          <Link
            href="/demo"
            className="marketing-text-link"
            onClick={() =>
              trackEvent("landing_cta_clicked", {
                cta_id: "secondary_final_demo",
                destination: "/demo",
                location: "final_cta",
              })
            }
          >
            Try the seller experience <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    </section>
  );
}
