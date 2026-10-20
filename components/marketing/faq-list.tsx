import { ChevronDown } from "lucide-react";
import { faqItems } from "@/lib/marketing-content";

const groups = [
  "Getting started",
  "Seller forms",
  "Sheets & PDFs",
  "Plans & billing",
] as const;
type Group = (typeof groups)[number];
const groupByQuestion: Record<string, Group> = {
  "Who is UtilitySheet for?": "Getting started",
  "Can I use one link for every property?": "Seller forms",
  "Can I save more than one seller form?": "Seller forms",
  "Can I choose what sellers are asked?": "Seller forms",
  "Does UtilitySheet collect HOA or condo association details?": "Seller forms",
  "When should I send the seller link?": "Getting started",
  "What is the Property Handoff Packet?": "Sheets & PDFs",
  "Does the seller need an account or app?": "Seller forms",
  "Do sellers actually complete the form?": "Seller forms",
  "How does PDF delivery work?": "Sheets & PDFs",
  "Can I edit a submitted sheet?": "Sheets & PDFs",
  "How do provider suggestions work?": "Seller forms",
  "What happens if I hit the free plan limit?": "Plans & billing",
  "How long does it take to get started?": "Getting started",
  "What happens after I sign up?": "Getting started",
};

// A plain grouped list. Questions keep their order from faqItems; a question
// missing from groupByQuestion falls into "Getting started" so it still shows.
export function MarketingFaqList() {
  return (
    <section
      className="marketing-container faq-groups"
      aria-label="Frequently asked questions"
    >
      {groups.map((group) => {
        const items = faqItems.filter(
          (faq) => (groupByQuestion[faq.question] ?? "Getting started") === group,
        );
        if (!items.length) return null;
        return (
          <div key={group} className="faq-group">
            <h2>{group}</h2>
            <div className="faq-accordions">
              {items.map((faq) => (
                <details key={faq.question} className="faq-item">
                  <summary>
                    {faq.question}
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
