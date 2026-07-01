# UtilitySheet UX/UI and Product Design Audit

Author: Senior product design / UX review pass
Date: 2026-07-01
Scope: Full product (marketing site, auth, onboarding, dashboard, requests, seller wizard, packet/PDF, branding, settings/billing, admin) plus the reusable component system.
Status: Audit and recommendations only. No code has been changed.

---

## How this was reviewed

This is not a code read alone. The app was run locally (`npm run dev`, Next.js 16 + Turbopack) and inspected in a real browser via Playwright across desktop (1440px) and mobile (390px) viewports.

- Public pages captured and viewed: landing, features, pricing, how-it-works, about, faq, login, signup, the interactive demo/seller wizard, and the four SEO pages.
- A QA account was provisioned (pre-verified, through the Stack auth server API) and used to log in and capture the authenticated product: onboarding, dashboard (first-use), requests list, request detail, the new-request wizard, branding, settings, and updates, on both desktop and mobile.
- A real request was created through the authenticated API to inspect the request-detail page, the live seller wizard at `/s/[token]`, and the packet view at `/packet/[token]`.
- A multi-agent code sweep then read the implementation area by area for file-and-line evidence.

Two honesty notes:

1. Four of the deeper code-sweep passes (marketing/landing, the design system, copy/microcopy, and mobile/responsive) hit a session limit mid-run. Those four areas were reviewed first-hand from the running UI and from direct reading of the source (globals.css, the `Button`/`Card` primitives, the dashboard shell, the landing composition, and grep-based color quantification), so they are covered here, just with slightly less exhaustive file-and-line citation than the seven areas the agents completed.
2. In the headless screenshots, the landing page shows a large empty dark-navy band mid-page. The poster image and demo video assets both exist on disk, and the band matches a full-width `aspect-video` `<video className="... bg-slate-950">`. This is most likely a headless-capture artifact (the video background painting before the poster frame rasterizes), not necessarily a real-browser bug. It is flagged as "verify in a real browser," not asserted as broken. The floating dark "N" circle visible in the bottom-left of several screenshots is the Next.js dev-mode indicator, not a product element, and is ignored.

---

## Executive summary

UtilitySheet is a genuinely useful product with a clear job to do: give an agent or transaction coordinator one reusable seller link, collect utility details from the seller, and hand back a clean branded utility sheet. The core loop works, several individual screens are well thought through (the onboarding screen with a live PDF preview, the seller wizard's autosave and "I'm not sure" escape hatches, the pricing page, the admin audited-action pattern), and the backend is defensively built.

The problem is not any single screen. It is that the product does not read as one designed system. It reads as many capable screens built quickly, each making its own local decisions about color, layout, terminology, and hierarchy. When you move through the real journey the seams show constantly: the accent color changes from screen to screen, the same concept ("your seller link is ready") is stated three different ways in three places, the dashboard buries the one action that matters under cross-sell chrome and a changelog feed, settings is a 2,800px scroll with a marketing pricing page embedded in it, and the deliverable the whole product exists to produce (the branded sheet) does not actually pick up the agent's brand color in the seller wizard or the free PDF.

None of this is catastrophic individually. Collectively it is exactly the kind of thing that makes a professional evaluating the tool think "this is not finished," and this is a product asking real estate professionals to trust it with transaction-related information, so "looks unfinished" is a conversion and retention problem, not a cosmetic one.

There is also at least one hard functional trust failure hiding in the polish problems: the requests list loads only the first 10 records with no pagination and searches client-side over just those 10, so a busy TC's older requests silently disappear and become unfindable.

## Overall design verdict

**This does not need a full visual redesign. It needs a design-system cleanup plus targeted structural fixes to a handful of high-traffic flows.**

The bones are fine. The typography (Figtree), the base card/table/input primitives, the spacing scale, and the overall "clean light SaaS" direction are all reasonable and modern. What is missing is enforcement: one accent color, one set of shared components actually used everywhere, one canonical place for each concept, and a few flows (dashboard first-use, settings, the new-request wizard, the packet/deliverable) restructured so they stop fighting themselves.

If you did three things (unify the accent color, consolidate the duplicated surfaces, and fix the deliverable so it honors the brand), the product would jump a full tier in perceived quality without a single new screen being designed from scratch.

Rough grade today: **C+ / functional but visibly unfinished as a system.** Achievable with the cleanup below: **A- / credible, cohesive SaaS.**

---

## Top 10 highest-impact problems

Ranked by impact on trust and conversion for the target user (agents/TCs), not by effort.

| # | Problem | Severity |
|---|---------|----------|
| 1 | **No coherent accent color anywhere.** The declared design token (slate-blue `--primary`) is used in ~6 files; emerald/green (not even a token) is used in ~51 files and ~390 class instances; a `norma-purple` token is defined but effectively dead; 14 files hardcode `from-slate` gradient buttons instead of using the `Button` component. The brand is de facto emerald while the system says slate-blue. | Critical |
| 2 | **Requests list loads only 10 rows, no pagination, and search/filter run client-side over just those 10.** Older requests silently vanish and are unsearchable. This is a data-visibility failure for the exact power user the product targets. `app/dashboard/requests/page.tsx:63,76-82`, `lib/neon/queries/requests.ts:34-36`. | Critical |
| 3 | **The seller wizard ignores the agent's brand color in every step.** `primary_color` is used only in the header chip and progress bar; all CTAs, selection states, and checkmarks are hardcoded emerald. A navy-branded brokerage still hands its seller a green form, so the deliverable looks like generic SaaS or spam, not "from my agent." This breaks the product's central premise. `components/seller-form/steps/*`. | High |
| 4 | **The deliverable exists as three inconsistent renderings.** The web packet, the downloadable PDF, and the in-app live preview disagree on color, title, and content. The Pro "welcome message" shows in the PDF but silently vanishes on the web packet; the simple/free packet hardcodes emerald so the preview literally lies about the output. `app/packet/[token]/page.tsx`, `lib/pdf/packet-html.ts`. | High |
| 5 | **Settings is a 1,365-line single-column kitchen sink** with an entire Teams pricing page embedded in it and three conflicting save patterns, where the prominent bottom "Save Changes" silently ignores the reusable-link edits above it (a real data-loss trap). `app/dashboard/settings/page.tsx`. | High |
| 6 | **Onboarding is orphaned.** Signup routes new users straight to `/dashboard`, so the best-designed activation surface (with the live PDF preview) is only reachable via a muted ghost link, and its job is duplicated by a near-identical dashboard card. Brand setup then exists in three places (onboarding, Branding, Settings). | High |
| 7 | **The dashboard buries the primary action.** Every dashboard page opens with a "Part of Norma" cross-sell strip; the home then stacks a changelog feed (duplicated with the top-level Updates nav item) and four empty stat cards before the requests table. The most prominent global CTA ("New Request") contradicts the product's own stated primary workflow (the reusable link). | High |
| 8 | **No way to delete, cancel, or archive a request in the UI**, even though a DELETE endpoint exists. A typo'd address becomes a permanent row that also immediately burns a monthly quota slot. `app/api/requests/[id]/route.ts:130-168` (unused). | High |
| 9 | **Misleading empty/error states across the product.** The packet shows "Info Sheet Not Found. The link may be invalid or expired." when the real cause is that the seller has not submitted yet; the requests list says "No requests match your filters" when the user simply has zero requests; the seller wizard header renders a stray "0" ("0 4%") from a falsy-render bug. | High |
| 10 | **The agent's new-request flow is heavier and rougher than the seller's.** Four steps to send one link, a confusing step order (Branding before Seller before Utilities), and a plain unvalidated text box for the address even though a polished Google Places component with a manual fallback already exists and is used on the seller side. | Medium |

---

## Product clarity

**Is it obvious what UtilitySheet does?** On the marketing site, mostly yes. The hero ("Stop chasing sellers for utility info") and the "one link in, one clean utility handoff" framing are clear and well aimed at the pain. The pricing page is genuinely good: clear tiers, a "Most Popular" marker, a "which plan is right for you" table, and honest "common reasons teams upgrade" content.

**Inside the product, clarity degrades.** The dashboard leads with cross-sell for other Norma products and a changelog before it leads with the user's own work, so the first authenticated impression is "here is our company's news" rather than "here is your next action." The two competing mental models (one permanent reusable link vs one request per property) are never reconciled in plain language, and the nav destination labeled "New Request" actually lands on a screen titled "Send a Seller Link," which is disorienting.

**Screens that feel like developer features rather than product design:**

- The **Updates** page: a 20-plus post engineering changelog with entries like "Bugfix: address parsing is more accurate" and "Fixed an issue where the packet could generate an extra blank last page," given a top-level nav slot equal to Dashboard and Requests, and duplicated as a "What's new" feed on the dashboard home. This is a git log wearing a nav item.
- The **embedded Teams pricing page inside Settings**: marketing content (benefits list, "how seats work," FAQ accordions) rendered inside an authenticated account screen.
- The **"Part of Norma" strip** on every dashboard page: business/suite strategy leaking into the primary workspace.

---

## Navigation and information architecture

Current top-level nav: Dashboard, Requests, Branding, Updates, Settings.

**Findings**

- **Branding does not deserve a top-level slot (Medium).** For a Free user it is a dead end: one auto-created read-only profile plus a disabled "Upgrade to Create Profile" button, and `/dashboard/branding/new` flashes a form then redirects away. It also overlaps onboarding and Settings. Recommendation: fold Branding into Settings as a tab (or into a single "Seller Link and Branding" section). `app/dashboard/layout-content.tsx:29`, `app/dashboard/branding/page.tsx:40,55-58`, `app/dashboard/branding/new/page.tsx:25-28`.
- **Updates should not be top-level (High).** Demote to a bell icon or a footer/help link. Keep at most one changelog surface. `app/dashboard/layout-content.tsx:30`, `app/dashboard/updates/page.tsx`, dashboard "What's new" at `app/dashboard/page.tsx:798-854`.
- **The global "New Request" CTA fights the stated primary workflow (High).** It is the single most prominent colored button in the shell, yet the body labels the reusable link as the "Primary Workflow" and manual creation as secondary. Pick one hierarchy and make "Copy Seller Link" the prominent action if that is truly primary. `app/dashboard/layout-content.tsx:151-164` vs `app/dashboard/page.tsx:560-562`.
- **The "Part of Norma" strip sits above every dashboard page (High).** Move suite discovery to one unobtrusive place (user menu, or bottom of Settings). Persist dismissal server-side, not per-browser localStorage. `app/dashboard/layout-content.tsx:279-281`, `components/norma-suite-panel.tsx:86-122`.

**Recommended nav:** Dashboard, Requests, Settings (with Branding, Seller Link, Billing, Team as tabs/sections inside Settings). Updates goes to a bell or footer. That is three focused destinations instead of five, two of which are currently low-value or gated.

---

## Visual design and polish

**The single biggest issue is color.** There is no enforced accent. Quantified across `app/` and `components/`:

- `emerald-*` / `green-*`: ~51 files, ~390 class instances (167 of `emerald-500` alone).
- `from-slate-*` gradients: 22 files (used for the logo tile and most primary buttons).
- `sky-*`: 9 files. `blue-*`: 15 files. `amber-*`: 23 files.
- `bg-primary` (the actual declared token, a slate-blue oklch): only 6 files.
- `norma-purple` token (defined in `globals.css:43-49`): used in 1 file. Effectively dead.
- `bg-gradient-to-r from-slate` buttons hardcoded instead of using `Button` variants: 14 files.

So the design token system declares a slate-blue primary and a purple brand, while the product is actually painted emerald green, with slate/sky/blue/amber accents sprinkled throughout. You can see this collide inside single components: the demo header (`app/demo/layout.tsx`) has a slate logo tile, a slate "Demo Mode" badge, and an emerald "Get Started" button; the settings upgrade buttons are slate gradients with a pulsing emerald sparkle sitting inside otherwise-emerald cards; the pricing table's three tier CTAs are navy, green, navy; the "Submitted" status badge is sky on the requests list and emerald on the request detail (`app/dashboard/requests/page.tsx:50` vs `app/dashboard/requests/[id]/page.tsx:22`).

**Other polish issues**

- **Buttons bypass the design system.** Because 14 files hand-roll gradient buttons, the `Button` primitive's `default` variant (which uses `bg-primary`) is barely the real primary button anywhere. The system exists but is routed around.
- **Empty fields render as bare em-dashes** on the request detail (`—` for Email/Phone/Closing), which reads as broken data rather than "not provided."
- **Unbalanced two-column layouts.** The request detail's right "Actions" column holds two disabled gray buttons then roughly 400px of emptiness next to a much taller left column.
- **Generic AI-looking stock illustration** in the dashboard Recent Requests empty state (`/utility_sheet_empty_state_illustration_...png`), which reads as filler.
- **Dark mode exists** (full token set in `globals.css:97-130`) but the pervasive hardcoded light-mode colors (emerald-400, slate-600 gradients, red-400 error text) will not all adapt correctly, so dark mode is likely inconsistent in practice.

---

## Workflow UX (the real journey)

Walking the intended path end to end:

1. **Landing / login / signup.** Landing is clear. Signup is clean but requires email verification before login can succeed, and the "check your email" screen is a potential dead end: no "resend," no "use a different email," and the full name the user just typed is discarded on that path. `app/auth/signup/page.tsx:103-116,139-172`.
2. **Onboarding.** The onboarding screen itself is strong (single screen, optional, live PDF preview), but new users are routed to `/dashboard` and never see it unless they find a muted "Finish optional setup" link. Its two Save buttons (Save Branding, Save Contact Details) can silently overwrite each other, and navigating away via "Go to Dashboard" does not flush pending branding edits. `app/onboarding/page.tsx:179-231,322-341`.
3. **Set up branding / seller link.** Done in three overlapping places (onboarding, Branding, Settings) with no single home and no cross-reflection until reload.
4. **Create/manage a request.** The reusable-link-first screen is good, but the per-address wizard is four steps with a confusing order and an unvalidated address box. The list then hides everything past the 10 most recent, with no delete anywhere.
5. **Invite a seller.** Strong: Copy Link / Copy SMS / Open Email are all present and the intake link uses real address autocomplete with a confirm-address fallback.
6. **Seller completes the form.** The best part of the product mechanically (autosave, resume, "I'm not sure," honest error/retry states), undermined by the hardcoded-green branding and the "0 4%" glitch on the very first screen.
7. **Review submitted info.** The submitted-sheet editor has genuinely good optimistic-concurrency handling (409 on stale edits, reload rather than overwrite).
8. **Generate / export / share.** Where trust breaks: three divergent renderings, a misleading "not found / invalid or expired" state before submission, and a free PDF that is a rasterized (non-selectable) screenshot while the paid PDF is crisp vector.

**Where users get confused or stalled:** immediately after signup (orphaned onboarding), on the dashboard (buried primary action), when they have more than 10 requests (invisible history), when they mistype an address (no delete), and when they open a packet link before the seller submits (looks broken).

---

## Forms, tables, and data entry

- **Requests list (Critical):** 10-row cap, no pagination, client-side search over only those 10. Move search/filter and pagination server-side. `app/dashboard/requests/page.tsx:63`.
- **Agent address input (High):** plain `<Input>` gated only by length >= 5, so "aaaaa" passes, on the field the entire packet keys off. Reuse `GooglePlacesAddressInput` (already built and used on the seller side). `app/dashboard/requests/new/page.tsx:651-658,411`.
- **New-request wizard (High):** four steps to send one link; order is Address, Branding, Seller, Utilities; packet mode buried at the bottom of step 4; a leftover `isStep3Valid` variable gates step 4. Collapse to one or two steps, demote Branding to a "Using: Default (change)" line, surface packet mode early. `app/dashboard/requests/new/page.tsx:616-1038`.
- **Settings save model (High):** three conflicting patterns (global sticky Save, per-section Save, silent auto-save switches) where the global button ignores visible unsaved link edits. Make each card self-contained or scope the button's label. `app/dashboard/settings/page.tsx:323-348`.
- **Onboarding double-save (Medium):** two optional Save buttons that partially overwrite each other and can silently lose edits. Collapse to one. `app/onboarding/page.tsx:179-231`.
- **Native `confirm()` for destructive team actions (Medium):** removing a member and changing a role use OS `confirm()`, which breaks the theme and reads as prototype-grade. Use the app's dialog. `app/dashboard/settings/page.tsx:557,575`.
- **Raw invite URL dumped as plaintext (Medium):** the full invite token is rendered as flowing `break-all` body text. Put it in a read-only field with a copy button, or rely on the email. `app/dashboard/settings/page.tsx:1237-1241`.

Tables are otherwise reasonably scannable; the main issue is the admin console hand-rolls nine different tables (see component section).

---

## Empty states, loading, and first-use

- **Dashboard empty state:** has a real primary CTA (Copy Seller Link) which is good, but the heading "Ready to streamline your workflow?" truncates on mobile ("...streamline your workflo...") and the stock illustration reads as filler. `app/dashboard/page.tsx:942-955`.
- **Requests list empty state (Medium):** wrong copy ("No requests match your filters" at zero data), no CTA, no illustration, and no mobile empty state at all (the mobile card list simply renders nothing). Branch it: first-run state with a "Create your first request" CTA vs a genuine filtered-empty state. `app/dashboard/requests/page.tsx:250-255,181`.
- **Packet pre-submission (High):** "Info Sheet Not Found. The link may be invalid or expired." for a valid, not-yet-submitted link, with no branding or back link. The API already distinguishes not_found / not_submitted / locked; the client collapses all three. Branch into distinct branded states. `app/packet/[token]/page.tsx:121-136,183-192`.
- **Stat cards (Medium):** four cards render even when all four read 0, adding a full screen of empty scroll on mobile. Hide or collapse when `total_requests === 0`. `app/dashboard/page.tsx:747-763`.
- **Loading states:** generally good. The dashboard uses a real skeleton (`DashboardSkeleton`), and the seller wizard has a proper "Sending..." interstitial. One rough spot: the intake "Continue" button gives weak feedback during a multi-second server round trip (spinner only, label unchanged), inviting double-taps. `app/i/[slug]/page.tsx:577-590`.

**First-use as a whole:** the pieces of a good first-run experience exist (onboarding screen, empty-state CTAs, "what happens next" checklist) but they are not sequenced. A new user is dropped on a crowded dashboard instead of walked through the one setup screen that would make them successful.

---

## Mobile / responsive

Reviewed at 390px on the running app.

- **Dashboard is extremely long on mobile.** The Norma banner stacks to a full card, then four stat cards stack vertically (mostly empty), then the large changelog feed, all before the requests list. This is several screens of scroll before the user reaches anything actionable. Hide stat cards and the changelog on mobile for zero-data users.
- **Empty-state heading truncates** on the dashboard ("...streamline your workflo...").
- **Requests list on mobile** relies on a separate card layout that renders nothing when the filtered list is empty, so there is no mobile empty state.
- **Settings on mobile** is the 2,800px desktop scroll made even longer; the lack of tabs hurts most here.
- **The `Button` primitive aggressively shrinks at the `sm` breakpoint** (for example the default size goes from `h-11` to `sm:h-8`, and text from `text-sm` to `sm:text-xs`). Because Tailwind `sm:` is min-width, the smaller sizes apply on larger screens and the larger touch targets apply on phones, which is the right direction for tap targets, but it means desktop buttons are quite small (32px). Worth a deliberate review of whether 32px desktop controls are intended. `components/ui/button.tsx:18-27`.
- **Positives:** the mobile nav (hamburger + slide-over), the seller wizard, and the marketing pages all reflow cleanly. Safe-area utilities exist and are wired up (`globals.css:143-167`).

The seller wizard is the strongest mobile experience in the product, which is appropriate since sellers overwhelmingly fill it out on a phone.

---

## Component and design-system findings

**The system is defined but not enforced, and there is a second, parallel system in admin.**

- **Color tokens are ignored (Critical, cross-cutting).** See the quantified breakdown above. The fix is not "add more tokens," it is "pick one accent, delete the dead ones, and route every primary button through the `Button` component." Decide: is the product emerald or slate-blue? Whatever you choose, make `--primary` that color, retire `norma-purple`, and remove the 14 hardcoded slate-gradient buttons.
- **The `Button` component is bypassed (High).** Its variants (`default`, `outline`, `secondary`, `ghost`, `destructive`, `link`) are fine, but pages routinely apply custom gradient classNames instead of using them, so "primary button" has no single definition. Enforce variants; forbid ad-hoc gradients in review.
- **Status colors are not centralized (Medium).** The same "Submitted" status is a different color on the list vs the detail page. Define one status-to-color map imported by both.
- **Admin is a parallel mini design system (High, internal).** It has a nice shared primitive set (`AdminPageHeader`, `AdminStatStrip`, `AdminFilterBar`, `AdminDataTableShell`, `AdminPagination`) but then: hand-rolls nine different raw `<table>` blocks instead of using `components/ui/table.tsx`; ships two stat-card components (`StatsCard` vs `AdminStatStrip`); has two audit-log renderers of very different quality; and its detail pages abandon the admin primitives and revert to raw `font-bold` headings. There are also two layout bugs: the impersonation banner (`fixed z-[100]`) covers the sticky admin header with no offset, and sticky filter-bar/table-header offsets do not match the real header height. `components/admin/*`, `components/admin/ImpersonationBannerClient.tsx:26`.
- **Message templates live inside the branding form (Medium).** `BrandProfileForm.tsx` embeds SMS/email template editing (a messaging concern) inside the visual-branding form, bloating it to roughly 900 lines. Separate them.

**Recommended shared components to add or enforce:** one `PrimaryButton` usage convention (via the existing `Button` `default` variant), one `StatusBadge` with a central color map, one `PageHeader`, one `EmptyState` (with heading + body + primary CTA + optional illustration slot), one `ReusableLinkCard` (to kill the onboarding/dashboard duplication), and one shared `Table` used by both product and admin.

---

## Copy and microcopy

The copy is generally clear and human, especially in the seller wizard. The problems are specific strings and inconsistent terminology.

**Terminology drift to resolve (pick one term each):** Request vs Seller link vs Utility Info Sheet vs packet; "Utility Info Sheet" (web/simple PDF) vs "Utility Information Sheet" (advanced PDF); Starter (marketing) vs Free Plan (in-app); "New Request" (nav/shell) vs "Create Manual Request" (empty state) for the same action.

**Highest-impact rewrites:**

| Where | Current | Problem | Suggested |
|-------|---------|---------|-----------|
| Requests list empty (`page.tsx:250-255`) | "No requests match your filters" | Shown at zero data with no filter set | "You have not created any requests yet. Share your seller link to get started." |
| Packet pre-submission (`packet/[token]/page.tsx:183-192`) | "Info Sheet Not Found. The link may be invalid or expired." | Misleading; link is valid | "This info sheet is not ready yet. The homeowner has not submitted their utility details. Check back soon." |
| Seller wizard header (`SellerLayout.tsx:246`) | "0 4%" | Falsy-render bug leaks a literal 0 | "4%" (fix the guard so 0 does not render) |
| Dashboard empty heading (`page.tsx:948`) | "Ready to streamline your workflow?" | Truncates on mobile, generic | "Share your seller link to get started" |
| Settings plan (`settings/page.tsx:904`) | "Free Plan" + "Upgrade to Pro" (no price) | Price hidden at the decision moment | "Free plan. Upgrade to Pro for $9/mo." |
| Pro upgrade button | "Upgrade to Pro" | No price near it | "Upgrade to Pro, $9/mo" |
| Request detail empty fields | "—" | Reads as broken | "Not provided" (muted) |
| Success step (`SuccessStep.tsx:194`) | "The link is now read-only." | Not actually enforced server-side | "You are all set, no further action needed." (or enforce read-only) |
| Intake continue (`i/[slug]/page.tsx:577`) | "Continue" (spinner only) | No active feedback during multi-second work | "Setting up your form..." while submitting |
| Demo address placeholder | "123 Sample Street, City, state, zip" | Lowercase state/zip looks unpolished | "123 Sample Street, City, State, ZIP" |
| Onboarding save | "Save Branding" + "Save Contact Details" | Two buttons, silent overwrite | one "Save setup" |

**Changelog tone:** "Bugfix," "Fixed an issue where the packet could generate an extra blank last page," and similar belong in an internal release log, not a customer-facing top-level nav destination. If a customer changelog is kept, write it in benefit language and demote it.

---

## SaaS credibility

**What makes it feel credible:** the onboarding live PDF preview; the pricing page; the seller wizard's care (autosave, reassurance, honest error handling); the defensive backend (input validation, ownership checks, SVG sanitization on logo upload, rate limiting); the admin audited-action pattern.

**What makes it feel immature:** the color incoherence; the duplicated surfaces (three places for "your link is ready," three places to manage branding); the settings kitchen sink with an embedded pricing page; native `confirm()` dialogs; raw invite tokens as body text; the deliverable not honoring the brand; the misleading error/empty states; and the changelog-as-nav.

**What to fix before showing this broadly to agents/TCs:** items 1 through 9 in the Top 10. In particular, fix the requests-list 10-row cap (functional trust), make the seller deliverable honor the brand (the product's entire premise), and remove the cross-sell/changelog clutter from the dashboard (first impression).

---

## Prioritized action plan

### Quick wins (hours to a day each, high signal-to-effort)

1. Fix the seller wizard "0 4%" falsy-render bug (`SellerLayout.tsx:246`, make the guard boolean).
2. Fix the packet pre-submission state copy and branch on HTTP status (not-submitted / locked / not-found). `app/packet/[token]/page.tsx`.
3. Fix the requests-list empty-state copy and branch zero-data vs filtered-empty; add a mobile empty state. `app/dashboard/requests/page.tsx`.
4. Remove the "Part of Norma" strip from the global dashboard layout (or move it to the user menu). `app/dashboard/layout-content.tsx:279-281`.
5. Demote Updates out of the primary nav; drop the dashboard "What's new" feed for zero-data users.
6. Show the Pro price on the in-app upgrade button; unify Starter/Free naming.
7. Render empty request-detail fields as "Not provided" instead of bare em-dashes.
8. Replace native `confirm()` in Settings with the app dialog; put the invite URL in a proper copy field.
9. Hide the four stat cards when `total_requests === 0` (especially on mobile).
10. Fix the demo address placeholder casing and reuse the real address input in the demo.

### Medium improvements (a few days each)

1. **Unify the accent color.** Choose one, set `--primary`, retire `norma-purple`, and replace the 14 hardcoded slate-gradient buttons with `Button` variants. Centralize the status-to-color map. This is the highest-leverage visual change in the product.
2. **Make the seller wizard honor the brand color.** Expose `primary_color` as a CSS variable on `SellerLayout` and drive all step CTAs/selection/checkmarks from it. `components/seller-form/*`.
3. **Requests list pagination + server-side search/filter.** Wire the returned `totalPages`, move search to the API. `app/dashboard/requests/page.tsx`, `lib/neon/queries/requests.ts`.
4. **Add delete/cancel/archive** to the row menu and detail Actions card, with a confirm dialog and a quota-refund rule for never-opened requests.
5. **Route new users to `/onboarding`** and collapse the duplicated dashboard first-run card into a dismissible "resume setup" banner.
6. **Split Settings into tabs** (Account, Notifications, Seller Link, Billing, Team) or separate routes, and replace the embedded Teams pricing page with a compact upgrade card that links to `/pricing`.
7. **Collapse the new-request wizard** to one or two steps, reuse the Places input, and demote Branding to an inline "Using: Default (change)" line.

### Larger redesign / refactor opportunities

1. **One canonical "deliverable" renderer.** Extract a single packet-content description consumed by the web view, both PDFs, and the preview so they cannot diverge (welcome message, home basics, title, accent, typography all identical). Move the free PDF to the same vector strategy as the advanced one so its text is selectable. `lib/pdf/*`, `app/packet/[token]/page.tsx`.
2. **One "Seller Link and Branding" home.** Consolidate the three brand-management surfaces (onboarding, Branding, Settings) into one place that the others deep-link to; move message templates out of the branding form.
3. **Admin design-system consolidation.** One shared table, one stat card, one audit-log feed, detail pages using the admin primitives, and the impersonation-banner layering fix. Do this before adding more admin pages.
4. **Resolve the two mental models** (reusable link vs per-address request) with clear naming, an origin indicator in the list, and one line of guidance on when to use which.

---

## Where the product drops the ball

The product drops the ball at the exact moment it needs to earn trust: **the handoff of the finished artifact, and the first authenticated impression.**

The whole pitch is "send one branded link, get back a clean branded sheet." Yet the sheet the seller fills out is green regardless of the agent's brand, the free PDF is a non-selectable screenshot, the web version and the PDF version are different documents, and the preview the agent approved does not match what actually ships. The one thing that has to feel like "this came from me, and it looks professional" is the one thing the system does not deliver consistently.

And the first thing a newly signed-up agent sees is not their setup screen and not their work. It is a cross-sell strip for other products, a changelog, and four zeros, with the primary action buried and described three different ways. The product is quietly telling the user "we are still building this" at precisely the moment it should be saying "you are in good hands."

It also drops the ball on a basic functional promise: a TC who manages more than 10 files cannot see or search their own older requests. That is not a polish issue, that is the tool failing its power user silently.

## What I would redesign first, and why

**First: unify the accent color and route every primary button through the `Button` component.** It is the cheapest change with the widest visible effect. Right now the emerald-vs-slate-vs-blue incoherence is the number one reason the product reads as "assembled quickly." Fixing it touches many files but is mechanical, and it instantly makes every screen look like it belongs to the same product. Everything else looks more finished once the color stops changing under the user's feet.

**Second (and nearly as important): make the seller deliverable honor the brand and be one consistent document.** This is the product's core promise and the artifact the customer's own clients see. If a navy-branded brokerage's seller form and PDF actually come out navy and look identical to the preview, the product starts to feel premium and trustworthy. This is the difference between "a form tool" and "my branded closing workflow."

I would sequence the dashboard first-run cleanup and the requests-list pagination fix right behind those two, because they are the first-impression and the power-user-trust fixes respectively.

## What not to overthink yet

- **Do not do a full visual redesign or rebrand.** The typography, spacing, and base components are fine. The problem is enforcement, not aesthetics.
- **Do not redesign the seller wizard's flow.** Mechanically it is the best part of the app. It needs the brand-color fix and the "0 4%" fix, not a rethink.
- **Do not over-invest in the admin console's visual polish.** It is internal. Consolidate its components so it stops rotting, but it does not need marketing-grade design.
- **Do not build elaborate dashboard analytics/stat widgets.** The four stat cards are already low-value for this user; adding charts would be motion without progress. Lead the dashboard with the one action that matters.
- **Do not chase dark-mode perfection yet.** Fix the light-mode color system first; a coherent single-accent light theme will make dark mode far easier to get right afterward.
- **Do not add more marketing surfaces inside the app** (the embedded Teams pricing page is already one too many). Keep selling on the marketing site; keep the product focused on the work.
