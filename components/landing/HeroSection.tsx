"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Droplets,
  Flame,
  Link2,
  Zap,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useInView } from "framer-motion";
import { trackEvent } from "@/lib/analytics/events";

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true });
  useEffect(() => {
    if (!isInView) return;
    trackEvent("landing_section_viewed", {
      section_id: "hero",
      page: "landing",
      location: "hero",
    });
    trackEvent("landing_primary_cta_viewed", {
      cta_id: "primary_hero_start_free",
      page: "landing",
      location: "hero",
    });
  }, [isInView]);

  return (
    <section ref={sectionRef} className="editorial-hero">
      <div className="marketing-container hero-grid">
        <div className="hero-copy">
          <p className="marketing-eyebrow">
            <span /> FROM LISTING INTAKE TO CLOSING DAY
          </p>
          <h1>
            Seller utility details.
            <br />Ready for the <em>handoff.</em>
          </h1>
          <p className="hero-description">
            Collect them at listing intake, under contract, or as closing
            approaches. Send your reusable link to the seller directly or
            through the listing agent, and turn their answers into a clear
            utility sheet for a smoother closing.
          </p>
          <p className="hero-audience">
            For transaction coordinators &amp; real estate agents.
          </p>
          <div className="marketing-actions">
            <Link
              href="/auth/signup"
              className="marketing-button"
              data-testid="hero-signup-cta"
              onClick={() =>
                trackEvent("landing_primary_cta_clicked", {
                  cta_id: "primary_hero_start_free",
                  destination: "/auth/signup",
                  location: "hero",
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
                  cta_id: "secondary_hero_demo",
                  destination: "/demo",
                  location: "hero",
                })
              }
            >
              Try the seller experience <ArrowUpRight size={17} />
            </Link>
          </div>
          <p className="hero-fineprint">
            3 live files per month, free. No credit card required.
          </p>
        </div>
        <div className="handoff-scene">
          <div className="scene-caption">
            <span>FROM SELLER DETAILS</span>
            <span>
              TO CLOSING-READY <ArrowUpRight size={14} />
            </span>
          </div>
          <div className="sample-sheet">
            <div className="sample-sheet-brand">
              <span className="sample-monogram">U.</span>
              <span>
                UTILITYSHEET
                <br />
                <small>THE PROPERTY HANDOFF</small>
              </span>
              <span className="sample-label">SAMPLE</span>
            </div>
            <div className="sample-address">
              <p>UTILITY INFORMATION</p>
              <h2>123 Main Street</h2>
              <span>Springfield · Prepared for the next chapter</span>
            </div>
            <div className="sample-table-heading">
              <span>UTILITY / PROVIDER</span>
              <span>CONTACT DETAILS</span>
            </div>
            {[
              {
                icon: Zap,
                name: "Electric",
                provider: "Springfield Electric",
                phone: "(800) 555-0100",
              },
              {
                icon: Flame,
                name: "Natural gas",
                provider: "County Gas Co.",
                phone: "(800) 555-0101",
              },
              {
                icon: Droplets,
                name: "Water",
                provider: "Springfield Water",
                phone: "(800) 555-0102",
              },
            ].map(({ icon: Icon, name, provider, phone }) => (
              <div className="sample-utility" key={name}>
                <Icon size={18} />
                <div>
                  <span>{name}</span>
                  <strong>{provider}</strong>
                </div>
                <span className="sample-phone">{phone}</span>
              </div>
            ))}
            <div className="sample-note">
              <Check size={15} />
              <span>Seller details, organized in one place.</span>
            </div>
            <div className="sample-sheet-footer">
              <span>ONE PROPERTY. EVERY DETAIL.</span>
              <span>01</span>
            </div>
          </div>
          <div className="sample-notification">
            <span className="notification-icon">
              <Link2 size={20} />
            </span>
            <div>
              <strong>One link. A simpler handoff.</strong>
              <span>Sellers fill it out. You review and share.</span>
            </div>
            <Check size={17} />
          </div>
          <p className="scene-footnote">
            Illustrative sheet · Shareable web view + downloadable PDF
          </p>
        </div>
      </div>
      <div className="hero-benefits marketing-container">
        <span>
          <Check size={16} /> No seller account needed
        </span>
        <span>
          <Check size={16} /> One reusable seller link
        </span>
        <span>
          <Check size={16} /> A clean PDF for every file
        </span>
      </div>
    </section>
  );
}
