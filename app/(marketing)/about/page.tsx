import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  MarketingPageHero,
  MarketingSection,
  MarketingCtaBand,
} from "@/components/marketing/page-shell";
import { createPageMetadata } from "@/lib/seo/site";

export const metadata: Metadata = createPageMetadata({
  title: "About UtilitySheet",
  description:
    "Learn how UtilitySheet was built from real transaction coordination workflows to make seller utility collection faster, cleaner, and easier to share.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <div>
      <MarketingPageHero
        eyebrow="Our story"
        title="Built around a real TC’s working day."
        description="UtilitySheet began with a familiar closing task: collecting utility details from sellers. And a simple question: why does this still take so much chasing?"
        showActions
      />
      <section className="marketing-section">
        <div className="marketing-container about-story-grid">
          <div>
            <p className="marketing-eyebrow">
              A FAMILY CONNECTION. A PRACTICAL SOLUTION.
            </p>
            <h2>It started with my mom.</h2>
            <div className="about-story-copy">
              <p>
                My mom, <strong>Debbie O’Brien</strong>, runs{" "}
                <strong>PA Real Estate Support Services, LLC</strong>, a
                transaction coordination business. Watching her manage
                high-volume closings made one thing clear: collecting utility
                information was more chaotic than it needed to be.
              </p>
              <p>
                Back-and-forth texts. Half-filled forms. Sellers saying “the gas
                company” instead of the provider’s name. Then the cleanup, right
                before closing.
              </p>
              <p>
                I’m a web developer, and I’ve spent years building tools around
                her workflow. UtilitySheet came directly from that work: a
                simple way to collect the details and create a clean sheet that
                travels with the transaction.
              </p>
              <p className="about-signature">
                Haydn <span>Developer, UtilitySheet</span>
              </p>
            </div>
          </div>
          <div className="about-portraits">
            <figure>
              <Image
                src="/debbie_headshot.jpg"
                alt="Debbie O’Brien"
                width={360}
                height={420}
                className="about-portrait"
              />
              <figcaption>
                <strong>Debbie O’Brien</strong>
                <span>The transaction coordinator</span>
              </figcaption>
            </figure>
            <figure>
              <Image
                src="/haydn.jpg"
                alt="Haydn, developer of UtilitySheet"
                width={360}
                height={420}
                className="about-portrait"
              />
              <figcaption>
                <strong>Haydn</strong>
                <span>The developer</span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>
      <MarketingSection
        title="What UtilitySheet does"
        description="A focused tool for the last details, built to fit the process you already use."
      >
        <div className="grid gap-8 md:grid-cols-3">
          {[
            [
              "One link to send",
              "Share your reusable seller link in the same email, text, or checklist you already use for each file.",
            ],
            [
              "A simpler seller experience",
              "Sellers enter the property address and confirm their providers on a phone, without an account or app.",
            ],
            [
              "A handoff worth sharing",
              "Review the finished web sheet and PDF. Paid plans can also update submitted sheets from the dashboard and add your branding.",
            ],
          ].map(([title, copy]) => (
            <article key={title} className="border border-border p-6">
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {copy}
              </p>
            </article>
          ))}
        </div>
        <Link href="/how-it-works" className="marketing-text-link mt-7">
          See how it works <ArrowUpRight size={17} />
        </Link>
      </MarketingSection>
      <MarketingCtaBand
        title="Put it to work on your next file."
        description="Start free with three live files per month. See how a simpler utility handoff fits into your day."
      />
    </div>
  );
}
