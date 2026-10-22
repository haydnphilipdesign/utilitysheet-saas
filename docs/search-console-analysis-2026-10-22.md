# UtilitySheet Search Console analysis — October 22, 2026

## What the data says

Google is already sending relevant visitors to UtilitySheet, but search is still a small acquisition channel. The strongest demonstrated topic is a utility sheet for real estate. The priority is to expand qualified visibility around that topic and connect it to activated accounts, rather than chase the overall average position.

Source: all seven CSV files in `utilitysheet.com-Performance-on-Search-2026-10-22/`. The filter says “Last 16 months,” but the daily export actually covers January 22–October 20, 2026: 272 days. It is Web text-based search, not all acquisition channels. Clicks are not unique visitors or signups.

| Metric | Observed result |
|---|---:|
| Google clicks | 120 |
| Search impressions | 1,599 |
| Overall CTR | 7.50% |
| Approximate average position | 8.59 |
| US clicks | 114 / 120 (95%) |
| Desktop clicks | 109 / 120 (90.8%) |

Average position was reconstructed by weighting daily position by daily impressions. Daily positions are rounded in the source, so this is approximate. CTR is calculated from total clicks divided by total impressions, not averaged across rows.

## Valuable search terms

| Query | Clicks | Impressions | CTR | Average position | Implication |
|---|---:|---:|---:|---:|---|
| utility sheet for real estate | 33 | 103 | 32.04% | 7.01 | Strongest observed relevant demand; protect and develop this topic. |
| utility sheet | 17 | 316 | 5.38% | 2.99 | Largest visible exposure, but ambiguous intent and possible brand searches. |
| real estate utility information sheet | 0 | 14 | 0% | 20.71 | Relevant adjacent phrase worth covering naturally on the existing template page. |
| real estate utility information sheet pdf | 1 | 2 | 50% | 14.00 | Direct fit for the free PDF; too little data to estimate demand or conversion. |
| seller utilities | 0 | 1 | 0% | 9.00 | Relevant but currently negligible evidence. |

The first query accounts for 27.5% of all recorded clicks. Its high CTR is promising but does not establish purchase intent or a repeatable future rate. These impressions measure UtilitySheet's exposure, not total market search volume.

Do not spend content effort on incidental terms such as “demo sheet,” “form utility,” or economics-related “utility” phrases. Their appearance does not make them good customer targets.

The query table is incomplete: it reports only 51 of the 120 clicks. The remaining 69 clicks cannot be assigned to keywords from these files. Google omits anonymized queries and may omit other rows. Consequently, this export cannot establish the true branded/nonbranded split. “Utility sheet” itself is ambiguous. [Google's query limitations](https://support.google.com/webmasters/answer/17011259)

## Pages and existing work

The homepage URL has 106 clicks and 1,437 impressions. The seller utility information form has 10 clicks, 132 impressions, and position 11.55. The demo has four clicks. The TC page has 11 impressions and no clicks, which is too little evidence to judge the audience or page.

The homepage dominates the page report. However, these separate exports do not join query to page: we cannot prove which page received the 33 clicks for “utility sheet for real estate.” Export page-filtered queries before changing the winning page's positioning.

The template page is absent from the page export, as are several other current marketing pages. Absence is not proof of an indexing problem. Repository records show substantial SEO/content work on October 20–21; this export ends October 20 and cannot evaluate the October 21 template improvements.

The current live template already has a free fillable/printable PDF, an example, a definition, and a path to creating a seller link. Build on this asset rather than create another near-identical PDF landing page. The live seller-form page presents the online workflow. [Current template](https://www.utilitysheet.com/utility-sheet-template), [current seller form](https://www.utilitysheet.com/seller-utility-information-form)

Supporting pages such as how-it-works (137 impressions), features (126), FAQ (121), and pricing (114) have zero clicks. They may appear as supporting links in the same results, so these are not automatically hundreds of independent lost prospects. Page impressions aggregate differently from property totals. Fragment URLs such as `/#features` do not by themselves establish duplicate-content problems. [Google's aggregation explanation](https://support.google.com/webmasters/answer/7576553)

## Trend: better position has not produced more clicks

| Period | Clicks | Impressions | CTR | Approx. position |
|---|---:|---:|---:|---:|
| Aug 26–Sep 22 (28 days) | 10 | 186 | 5.38% | 10.95 |
| Sep 23–Oct 20 (28 days) | 10 | 145 | 6.90% | 6.08 |

Clicks were flat; impressions fell 22.0%. The better average position can reflect a different mix of searches, devices, or countries, not necessarily improved rankings for the same keywords. There is no basis here to attribute the change to recent site edits.

Full-month clicks were 23 in February, 21 in March, 8 in April, 16 in May, 9 in June, 9 in July, 12 in August, and 13 in September. October has only 20 days and should not be compared directly with a full month. This is small, uneven traffic rather than demonstrated sustained growth.

## Audience clues

The US supplies 95% of clicks and 72.7% of impressions, supporting US real-estate language and resources as the immediate focus. India has 124 impressions and no clicks; this alone does not justify localization or country pages.

Desktop CTR is 9.33% versus mobile 2.59%, despite mobile's better average position (5.32 versus 9.78). This warrants comparing the same queries and landing pages by device. It does not prove a mobile usability issue: search-result CTR happens before someone uses the site, and query mixes differ. Desktop acquisition also does not mean the seller flow can neglect mobile.

The Search appearance CSV has a header but no rows. It provides no evidence of specific rich-result traffic and cannot diagnose schema correctness.

## Recommended order of work

1. **Verify visibility of the existing assets.** Inspect the template, seller-form, agent, TC, checklist, and guide URLs in Search Console. Check index status, Google's selected canonical, and sitemap processing. Prioritize the template and seller form given the observed query intent. Request indexing if appropriate; do not infer a crawl failure from this export alone.
2. **Use a clear page-to-intent map.** Keep the homepage focused on the product/category; the template page on free utility-information sheets and PDFs; the seller-form page on online collection; the agent/TC pages on their workflows. Add natural contextual links where missing. Avoid creating separate pages for every slight wording variation.
3. **Refine the template's search presentation after checking its current queries.** A candidate title is “Free Real Estate Utility Information Sheet (PDF)”; a candidate description is “Download a free fillable utility sheet for real estate closings. Collect seller provider details, view a completed example, or send a reusable online form.” This is a hypothesis to test, not a proven improvement. Do not rewrite the strong homepage solely to chase a higher aggregate CTR.
4. **Make the free resource a useful acquisition path.** Keep the download ungated, demonstrate the completed output, then offer the existing seller-link workflow. Share the resource with relevant TC educators, brokerage resource libraries, and real-estate workflow communities where permitted. Personalized outreach and useful references are acquisition experiments, not guaranteed ranking gains. No outreach was sent in this analysis.
5. **Measure activation, not just clicks.** Track public landing page → template/download or demo action → signup completed → seller link copied or first request created → first completed seller submission. Existing event definitions include signup, link-copy, and request creation; their existence does not prove production attribution works. The template's download links are plain anchors in the inspected source. Verify actual reporting before adding duplicate instrumentation. Retain only safe public-page/source labels, never seller addresses or capability URLs.
6. **Evaluate on comparable windows.** Save this baseline, then compare equal 28-day periods for US traffic and each target query/page. Use a longer 90-day view for sparse terms. Assess the October 21 work with a later export; do not treat this baseline as its outcome.

At the current 10 clicks per 28 days, even a hypothetical 10% click-to-signup rate would yield roughly one signup per period. This is arithmetic, not a conversion forecast. It explains why expanding relevant exposure and distributing the useful template matter alongside conversion improvements. Traffic is too sparse for meaningful small A/B tests today.

## Most useful next exports

- Last 28 days versus previous 28 days, with US selected: Queries and Pages.
- Queries filtered separately to the homepage, template, and seller-form page.
- Pages filtered to “utility sheet for real estate” to establish its actual landing-page mapping.
- The same leading query/page combinations split by desktop and mobile.
- Page indexing report and URL Inspection results for priority pages absent from this export.
- Privacy-safe organic landing-page and activation counts from product analytics; Search Console cannot show users, signups, or paid conversions.

## Scope and validation

All seven supplied CSVs were read. Totals and monthly/equal-window calculations used PowerShell Import-Csv and Measure-Object. Country and device totals reconcile with Chart.csv. Page totals must remain separate because aggregation differs. Relevant repository source and recent SEO task records were read, and the public template/seller-form pages and official Google documentation were checked. This is an export analysis with targeted page checks, not a full crawl, speed audit, competitive keyword study, or live Search Console inspection. No application code, deployment, production data, or external messages were changed.
