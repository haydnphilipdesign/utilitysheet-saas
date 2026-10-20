"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { useInView } from "framer-motion";
import { trackEvent } from "@/lib/analytics/events";

const steps = [
  { title: "Share a reusable link", copy: "Send your seller link in the emails, texts, and checklists you already use." },
  { title: "Seller completes the guided form", copy: "They add their utility details with helpful provider suggestions. No account needed." },
  { title: "Review and share the handoff", copy: "Get an organized utility sheet, ready to share as a web link or PDF." },
];

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true });

  useEffect(() => {
    if (!isInView) return;
    trackEvent("landing_section_viewed", { section_id: "hero", page: "landing", location: "hero" });
    trackEvent("landing_primary_cta_viewed", { cta_id: "primary_hero_start_free", page: "landing", location: "hero" });
  }, [isInView]);

  return (
    <section ref={sectionRef} className="handoff-hero" aria-labelledby="hero-title">
      <div className="marketing-container handoff-hero-grid">
        <div className="hero-copy">
          <p className="marketing-eyebrow">SELLER UTILITY DETAILS <ArrowRight size={16} aria-hidden="true" /> BUYER HANDOFF</p>
          <h1 id="hero-title">The utility handoff,<br />finally organized</h1>
          <p className="hero-description">Reusable seller links, guided forms, and polished buyer handoffs make collecting and sharing utility information one less thing to chase.</p>
          <p className="hero-audience">For transaction coordinators &amp; real estate agents.</p>
          <div className="marketing-actions">
            <Link href="/auth/signup" className="marketing-button" data-testid="hero-signup-cta" onClick={() => trackEvent("landing_primary_cta_clicked", { cta_id: "primary_hero_start_free", destination: "/auth/signup", location: "hero" })}>Start free</Link>
            <Link href="/demo" className="marketing-button marketing-button-outline" onClick={() => trackEvent("landing_cta_clicked", { cta_id: "secondary_hero_demo", destination: "/demo", location: "hero" })}>Try the seller experience</Link>
          </div>
          <p className="hero-fineprint">3 submitted sheets per month, free. No credit card required.</p>
        </div>
        <figure className="handoff-hero-art">
          <Image src="/landing/diffui/hero-handoff.webp" alt="Illustrative seller form on a phone beside a two-column UtilitySheet handoff with electric, water, gas, and internet provider details." width={1385} height={1136} sizes="(max-width: 767px) 100vw, (max-width: 1100px) 58vw, 820px" preload />
          <figcaption>Illustrative preview · Seller details, ready for the handoff.</figcaption>
        </figure>
      </div>
      <div className="handoff-workflow" aria-label="How UtilitySheet works">
        <ol className="marketing-container handoff-workflow-grid">
          {steps.map(({ title, copy }, index) => (
            <li key={title}>
              <span className="handoff-step-number">{index + 1}</span>
              <div><h2>{title}</h2><p>{copy}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
