# UtilitySheet SEO playbook

Practical steps for getting utilitysheet.com found on Google and Bing. Written
for a solo maintainer. Last reviewed 2026-10-20.

Canonical host: **https://www.utilitysheet.com** (apex `utilitysheet.com`
redirects to it). DNS is hosted on **Vercel DNS** (`ns1/ns2.vercel-dns.com`).

---

## 0. One-time fix in Vercel (do this first)

The apex domain currently redirects to www with a **307 (temporary)**. Make it
permanent so Google consolidates everything on www:

1. vercel.com → your UtilitySheet project → **Settings** → **Domains**.
2. Find the `utilitysheet.com` row (not `www.`) → **Edit**.
3. It should already say "Redirect to `www.utilitysheet.com`". Change the
   status code dropdown from **307 Temporary Redirect** to
   **308 Permanent Redirect** → **Save**.
4. Check: `curl -I https://utilitysheet.com/` in PowerShell (or open the
   URL in a browser's dev tools Network tab) should show `308` and
   `location: https://www.utilitysheet.com/`.

---

## 1. Add the property in Google Search Console

**Use a Domain property, not URL-prefix.** A Domain property covers http and
https, www and non-www, and any subdomain in one view, so redirects and
duplicates show up in one place. It is verified with a DNS record, which you
already control in Vercel.

> A `google-site-verification=…` TXT record **already exists** on
> utilitysheet.com. Someone (probably you, on another Google account) has
> started or finished verification before. Sign in to Search Console with
> each Google account you use; if the property already appears in the
> property picker, skip to step 2. If you can't find it, add a new
> verification record as below. Keep the old record until you know which
> account owns it; several verification records can coexist.

1. Go to https://search.google.com/search-console and sign in with the
   Google account you want to own the property.
2. Top-left property picker → **+ Add property**.
3. In the left box, **Domain**, type `utilitysheet.com` (no `https://`, no
   `www`) → **Continue**.
4. Google shows a TXT record like `google-site-verification=abc123…`.
   Click **Copy**. Leave this tab open.
5. In a new tab: vercel.com → top-level **Domains** tab (team level, not the
   project) → `utilitysheet.com` → **DNS Records** → **Add Record**:
   - Name: leave **blank** (that means the root, `@`)
   - Type: **TXT**
   - Value: paste the `google-site-verification=…` string
   - TTL: leave default → **Add**
6. Back in Search Console → **Verify**. Vercel DNS usually updates within
   minutes. If it says "not found", wait 15–60 minutes and click Verify again
   (the dialog can be reopened from Settings → Ownership verification).
7. **Never remove** the TXT record afterwards; Google re-checks it.

Expect the reports to be empty for the first 1–3 days. That is normal.

## 2. Submit the sitemap

1. Left menu → **Indexing → Sitemaps**.
2. Under "Add a new sitemap", enter the full URL:
   `https://www.utilitysheet.com/sitemap.xml` → **Submit**.
3. Expected result within a day: Status **Success**, **Discovered pages: 16**.
   "Couldn't fetch" right after submitting is common; check again tomorrow.

You don't need to resubmit when pages change. Google re-reads the sitemap on
its own. Resubmit only after adding new pages (new guides) to speed things up.

## 3. Request indexing (in this order)

Use the search bar at the top ("Inspect any URL in utilitysheet.com"). For
each URL: paste it → wait for the result → if it says **URL is not on
Google**, click **Request indexing** (about a minute while it runs a live
test). There is a small daily quota (roughly 10 per day), so spread these over
two days. Requesting doesn't guarantee indexing; it moves the URL up the queue.

| # | URL | Why this order |
|---|-----|----------------|
| 1 | `https://www.utilitysheet.com/` | Brand searches land here; it links to everything else. |
| 2 | `https://www.utilitysheet.com/pricing` | High intent: people comparing tools. |
| 3 | `https://www.utilitysheet.com/utility-sheet-for-transaction-coordinators` | Your core buyer. |
| 4 | `https://www.utilitysheet.com/seller-utility-information-form` | Matches a likely search ("seller utility information form"). |
| 5 | `https://www.utilitysheet.com/real-estate-closing-utility-checklist` | Matches checklist-style searches. |
| 6 | `https://www.utilitysheet.com/tc-utility-handoff-kit` | Free resource; most likely to earn links and shares. |
| 7 | `https://www.utilitysheet.com/features` | Product depth for evaluators. |
| 8 | `https://www.utilitysheet.com/utility-sheet-for-real-estate-agents` | Second audience. |
| 9 | `https://www.utilitysheet.com/how-it-works` | Supporting page. |
| 10 | `https://www.utilitysheet.com/faq` | Supporting page. |

Leave `/about`, `/demo`, `/from-a-closing`, and the legal pages to the
sitemap. They will be crawled without help.

**Never inspect or request** anything under `/auth`, `/dashboard`, `/admin`,
`/onboarding`, `/s/`, `/i/`, `/form/`, `/packet/`, `/invite/`, or `/api/`.
Those are private or contain seller data and are set to noindex on purpose.

Always use the **www** URL. If you inspect `https://utilitysheet.com/…`
Search Console will (correctly) report "Page with redirect".

## 4. Reading the Pages report

Left menu → **Indexing → Pages**. Click a reason under "Why pages aren't
indexed" to see the URLs.

| Status | What it means | What to do |
|--------|---------------|------------|
| **Discovered – currently not indexed** | Google knows the URL but hasn't crawled it yet, usually because the site is new and gets little crawl attention. | Normal for weeks on a new site. Make sure the page is linked from other pages and is in the sitemap. Earn a few real links (see Off-site). Don't re-request every day. |
| **Crawled – currently not indexed** | Google read the page and chose not to index it *for now*. Usually thin or very similar content, or a new site with little trust. | Make the page more useful and distinct (examples, specifics, a downloadable). Link to it from relevant pages. Request indexing once after a real improvement. |
| **Excluded by 'noindex' tag** | The page asked not to be indexed. | Expected for private routes (seller links, login, etc.). Only act if a *public marketing* page shows up here. |
| **Blocked by robots.txt** | robots.txt stops crawling. | Expected for `/auth`, `/dashboard`, `/admin`, `/api`, `/onboarding`. Only act if a public page is listed. |
| **Page with redirect** | The URL redirects elsewhere. | Expected for `http://` and non-www versions. Nothing to do. |
| **Alternate page with proper canonical tag** | A duplicate correctly points to the main version. | Nothing to do. |
| **Duplicate, Google chose different canonical than user** | Google disagrees with the page's canonical tag. | Check the URL. Usually a near-duplicate page; make content distinct or merge pages. |
| **Not found (404)** | URL returns 404. | Fix if one of your own pages links to it; ignore old or random URLs. |
| **Soft 404** | Page returns 200 but looks empty or "not found". | Usually a thin page. Add content or return a real 404. |
| **Server error (5xx)** | Your server failed when Google visited. | Check Vercel logs for that time; fix if it repeats. |
| **Indexed, though blocked by robots.txt** | A blocked URL was indexed from links elsewhere. | Shouldn't happen now: seller links are crawlable *and* noindex. If you see one, tell me. |

Also expect a **Structured data / Software apps** notice saying
`aggregateRating` or `review` is missing. That is expected: we don't publish
ratings we don't have. Leave it.

## 5. Weekly check (10 minutes, first 2–3 months)

Every Monday:

1. **Performance → Search results** (last 7 days vs previous 7).
   Look at **Queries**: what people typed when they saw you. New queries =
   content ideas. Look at **Pages**: which pages get impressions.
2. **Indexing → Pages**: is the indexed count rising toward ~16? Any *public*
   page in an error state?
3. **Indexing → Sitemaps**: still "Success".
4. **Experience → Core Web Vitals**: will say "Not enough data" for a while
   on a low-traffic site; that's fine. Once it has data, act on "Poor" URLs.
5. **Links** (monthly is enough): new sites linking to you.
6. Note the numbers (indexed pages, clicks, impressions, top 5 queries) in a
   spreadsheet so you can see trends.

**Realistic expectations**

- Indexing of most pages: a few days to a few weeks.
- Brand searches ("UtilitySheet"): usually within weeks once indexed.
- First impressions for long-tail searches ("seller utility information
  form", "utility sheet for buyers"): 1–3 months.
- Meaningful clicks on competitive terms: 6–12 months, and mostly driven by
  useful content plus a handful of real links.
- Position numbers jump around a lot early. Look at 4-week trends, not
  single days.

---

## 6. Content plan (proposed, not written yet)

These are **hypotheses**. There is no keyword data yet. After 4–8 weeks,
Search Console's Queries report will show which ones are real. Pick 3 to start.

### A. Free printable utility sheet template (recommended first)
- **Intent:** "utility information sheet template", "utility list for home
  buyers", "seller utility form pdf". TCs and agents who want a form *now*.
- **URL:** `/utility-sheet-template`
- **Outline:** what a utility sheet is (1 short paragraph) → what to include
  (electric, gas, propane, heating oil, water, sewer, trash/recycling,
  internet, cable/TV, HOA, electric meter number: the same categories the
  product collects) → **download blank PDF** (and a fillable version) →
  a clearly labeled *sample* filled sheet → how to send it to sellers →
  "Skip the printing" section.
- **Path to signup:** the template is the manual version; the CTA is "send
  this as a link instead and get the PDF back automatically". Free plan, no
  card.
- **Watch:** distinct from `/seller-utility-information-form` (product page)
  and `/real-estate-closing-utility-checklist` (process steps). Cross-link all
  three.

### B. Seller guide: transferring utilities when you sell your house
- **Intent:** "how to transfer utilities when selling a house", "when to shut
  off utilities when selling". Home sellers; agents share it with clients.
- **URL:** `/guides/transfer-utilities-when-selling-a-house`
- **Outline:** a timeline (2–3 weeks before closing → closing week → after
  closing) → each utility type and what to ask the provider → keep service on
  through the final walkthrough (verify phrasing per provider norms) →
  equipment returns (internet/cable) → fuel tanks and HOA notes (keep general;
  rules vary by region) → "leave the buyer a utility sheet" → checklist box.
- **Path to signup:** a callout for agents and TCs ("Send your sellers this
  guide plus a UtilitySheet link"), and for sellers, "Ask your agent if they
  use UtilitySheet". Lower direct conversion, but earns shares and links.

### C. Page for TCs: the utility step in your transaction workflow
- **Intent:** "transaction coordinator checklist utilities", "TC workflow
  utilities". Deepen the existing
  `/utility-sheet-for-transaction-coordinators` rather than adding a
  competing page.
- **Outline:** where the utility step lives (listing intake vs closing prep
  vs buyer side) → the actual emails (link to the kit) → putting the link in
  your existing checklist tools as a task (no integration claims) → what you
  get back → short TC FAQ → the real testimonials.
- **Path to signup:** "Create your seller link", plus the kit for those not
  ready.

### D. What is a utility sheet in real estate? (short explainer)
- **Intent:** definitional searches for "utility sheet real estate". Can also
  be a section of A if you want fewer pages.
- **Outline:** definition → who prepares it and when → what's on it →
  example image → links to A and the product.

### E. Buyer guide: setting up utilities after closing (later)
- **Intent:** "set up utilities new house checklist". Buyers aren't your
  customers, but agents send it after closing. Pairs with `/from-a-closing`.

Also worth doing: the FAQ has only **one** billing question. Add the billing
questions people actually ask (cancelling, downgrading, what happens to sheets)
once the answers are confirmed in code.

---

## 7. Off-site checklist

### Search engines
- [ ] **Bing Webmaster Tools:** https://www.bing.com/webmasters → sign in →
      **Import from Google Search Console** → pick the property. Imports the
      sitemap and verification in one step. Bing's index also feeds other
      search tools (DuckDuckGo, for one), so it is worth the 5 minutes.

### Your own properties (links you control)
- [ ] **multimedium.dev:** add UtilitySheet to a "Products" or "Work" section
      with a sentence about what it does, linking to
      `https://www.utilitysheet.com/` (use www directly, not the apex).
- [ ] **normatc.com:** confirm the products page links to the www URL.
- [ ] Your LinkedIn profile (Featured section) and email signature.
- [ ] The Facebook page, if UtilitySheet has one, should link to the site.

### Communities (share honestly, no spam)
- Lead with something useful: the **free TC Utility Handoff Kit** or (later)
  the printable template, not a sales pitch. Say you built it.
- **Facebook groups for transaction coordinators and real estate
  assistants.** Where TCs actually talk. Read each group's promo rules; many
  allow tools on specific days or in comment threads.
- **LinkedIn:** short posts showing the before/after (blank form vs finished
  sheet). Tag nobody without permission.
- **Reddit r/realtors:** strict self-promotion rules. Answer utility and
  closing questions helpfully; mention the kit only when it fits.
- **BiggerPockets forums and ActiveRain:** helpful answers or a write-up on
  the utility handoff, with a link where the rules allow.
- Ask the TCs who gave testimonials if they would mention it in their own
  groups or newsletters. Real word of mouth is the strongest signal you have.

### Directories (legitimate, free)
- [ ] **Product Hunt:** one launch day; prepare screenshots and the demo link.
- [ ] **Capterra / GetApp / Software Advice:** all run by Gartner Digital
      Markets; one free vendor sign-up typically covers all three. Category: real estate or
      transaction management software.
- [ ] **G2:** free seller profile.
- [ ] **SaaSHub** and **AlternativeTo:** quick free listings.
- For review sites: invite *real* customers to leave honest reviews. Never
  write, buy, or swap reviews. That also keeps structured data honest if
  ratings are ever added to the site.

### Later
- Guest posts or podcast spots with TC trainers and coaches. One relevant link
  from a real TC site is worth more than dozens of directory listings.
