"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Search,
  X,
  ListFilter,
  Rocket,
  CreditCard,
  SlidersHorizontal,
  FileText,
} from "lucide-react";
import { faqItems } from "@/lib/marketing-content";

const categories = [
  { name: "All questions", icon: ListFilter },
  { name: "Getting started", icon: Rocket },
  { name: "Plans & billing", icon: CreditCard },
  { name: "Seller forms", icon: SlidersHorizontal },
  { name: "Sheets & PDFs", icon: FileText },
] as const;
type Category = (typeof categories)[number]["name"];
const categoryByQuestion: Record<string, Category> = {
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
  "How do I cancel my plan?": "Plans & billing",
  "What happens when I cancel?": "Plans & billing",
  "What happens to my sheets if I go back to Free?": "Plans & billing",
  "Can I switch from Pro to Teams?": "Plans & billing",
  "What if a payment fails?": "Plans & billing",
  "How long does it take to get started?": "Getting started",
  "What happens after I sign up?": "Getting started",
};
export function MarketingFaqList() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All questions");
  const [sort, setSort] = useState("recommended");
  const searchRef = useRef<HTMLInputElement>(null);
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matching = faqItems.filter((faq) =>
    words.every((word) =>
      `${faq.question} ${faq.answer}`.toLocaleLowerCase().includes(word),
    ),
  );
  const results = matching.filter(
    (faq) =>
      category === "All questions" ||
      categoryByQuestion[faq.question] === category,
  );
  if (sort === "az")
    results.sort((a, b) => a.question.localeCompare(b.question));
  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, []);
  function reset() {
    setQuery("");
    setCategory("All questions");
    searchRef.current?.focus();
  }
  return (
    <section
      className="marketing-container faq-explorer"
      aria-label="Frequently asked questions"
    >
      <div className="faq-search">
        <Search size={21} aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          aria-label="Search frequently asked questions"
          placeholder="Search frequently asked questions…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-controls="faq-results"
        />
        {query ? (
          <button
            onClick={() => {
              setQuery("");
              searchRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <X size={18} />
          </button>
        ) : (
          <kbd>Ctrl / ⌘ K</kbd>
        )}
      </div>
      <div className="faq-layout">
        <nav className="faq-categories" aria-label="FAQ categories">
          {categories.map(({ name, icon: Icon }) => (
            <button
              key={name}
              aria-pressed={category === name}
              onClick={() => setCategory(name)}
              aria-controls="faq-results"
            >
              <Icon size={20} aria-hidden="true" />
              <span>{name}</span>
              <small>
                {name === "All questions"
                  ? matching.length
                  : matching.filter(
                      (faq) => categoryByQuestion[faq.question] === name,
                    ).length}
              </small>
            </button>
          ))}
        </nav>
        <div id="faq-results">
          <div className="faq-results-bar">
            <p role="status" aria-live="polite">
              {results.length} {results.length === 1 ? "answer" : "answers"}
              {query.trim() ? " found" : ""}
            </p>
            <label>
              Sort by{" "}
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="recommended">Recommended</option>
                <option value="az">Question A–Z</option>
              </select>
            </label>
          </div>
          <div className="faq-accordions" key={`${query}|${category}|${sort}`}>
            {results.map((faq) => (
              <details key={faq.question} className="faq-item">
                <summary>
                  {faq.question}
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
            {!results.length && (
              <div className="faq-empty">
                <Search size={28} aria-hidden="true" />
                <h2>No answers found</h2>
                <p>
                  Try a different word, or reset your search to see all
                  questions.
                </p>
                <button className="comparison-cta" onClick={reset}>
                  Show all questions
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
