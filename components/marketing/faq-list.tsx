import { faqItems } from '@/lib/marketing-content';

export function MarketingFaqList() {
  return (
    <div className="grid gap-4">
      {faqItems.map((faq) => (
        <article key={faq.question} className="rounded-2xl border border-border bg-card/50 p-6">
          <h3 className="text-lg font-semibold text-foreground">{faq.question}</h3>
          <p className="mt-3 leading-7 text-muted-foreground">{faq.answer}</p>
        </article>
      ))}
    </div>
  );
}
