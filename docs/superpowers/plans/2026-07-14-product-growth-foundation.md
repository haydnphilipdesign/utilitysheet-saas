# UtilitySheet Product Growth Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure qualified acquisition through first live seller submission and create a trackable, white-label-safe referral path from free UtilitySheet packet pages.

**Architecture:** Capture first-touch UTM and referral data in the browser, persist it once against the authenticated account, and aggregate acquisition and activation in the existing admin dashboard. Reuse the public intake-link slug as the non-sensitive advocate code for packet referrals. Keep the referral CTA inside the existing powered-by area so paid accounts that disable UtilitySheet branding remain white-labeled.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Neon Postgres, Zod, Vercel Analytics, Vitest, Testing Library

---

## File Structure

### Create

- `migrations-growth-attribution.sql` — first-touch attribution table and indexes.
- `lib/growth/attribution.ts` — pure parsing, normalization, storage, and persistence helpers.
- `components/growth/growth-attribution-capture.tsx` — captures first-touch parameters on browser entry.
- `lib/neon/queries/growth-attribution.ts` — insert-once attribution persistence.
- `app/api/growth/attribution/route.ts` — authenticated attribution endpoint.
- `components/packet/transaction-referral-cta.tsx` — client-side referral CTA and click analytics.
- `app/(marketing)/tc-utility-handoff-kit/page.tsx` — public, indexable version of the flagship resource.
- `tests/unit/growth-attribution.test.ts` — attribution parser and storage behavior.
- `tests/unit/growth-attribution-route.test.ts` — authenticated endpoint validation.
- `tests/unit/transaction-referral-cta.test.tsx` — referral URL and click-event behavior.
- `tests/unit/tc-utility-handoff-kit.test.tsx` — resource content and campaign-link behavior.

### Modify

- `schema.sql` — canonical `growth_attributions` schema.
- `lib/neon/queries/index.ts` — export attribution queries and intake-link account lookup.
- `lib/neon/queries/intake-links.ts` — look up an account's existing public slug without creating state.
- `app/layout.tsx` — mount the capture component once for every entry route.
- `app/auth/signup/page.tsx` — persist pending attribution after successful account activation.
- `lib/analytics/events.ts` — add packet referral impression and click events.
- `lib/packet/packet-data.ts` — expose the public referral slug in packet metadata.
- `app/packet/[token]/page.tsx` — render the contextual CTA only when powered-by branding is visible.
- `lib/admin/activation-funnel.ts` — calculate first-submission, habitual-use, and source metrics.
- `app/(admin)/admin/page.tsx` — render the new growth scoreboard.
- `app/sitemap.ts` — expose the public resource to crawlers.
- `tests/unit/packet-data.test.ts` — enforce referral-code and white-label behavior.
- `tests/unit/activation-funnel.test.ts` — verify new counts and rates.

## Privacy and Product Rules

- Store no seller identity, property address, request token, IP address, or user-agent in growth attribution.
- Accept only allow-listed UTM fields, the public intake slug, and the landing path.
- Use first-touch attribution: an existing row is never overwritten by later visits.
- Treat missing attribution as `unknown`; never infer a campaign.
- Display the transaction referral CTA only when `meta.show_powered_by` is true.
- Do not add referral branding to PDFs or paid packet pages that have powered-by disabled.

### Task 1: Parse and retain first-touch attribution

**Files:**
- Create: `lib/growth/attribution.ts`
- Create: `tests/unit/growth-attribution.test.ts`

- [ ] **Step 1: Write the failing parser and first-touch tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GROWTH_ATTRIBUTION_STORAGE_KEY,
  captureFirstTouchAttribution,
  parseGrowthAttribution,
  readPendingGrowthAttribution,
} from '@/lib/growth/attribution';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('growth attribution', () => {
  it('normalizes allow-listed campaign fields', () => {
    const result = parseGrowthAttribution(new URL(
      'https://utilitysheet.com/auth/signup?utm_source=TC%20Collective&utm_medium=facebook&utm_campaign=handoff-kit&utm_content=case-study&ref=team-slug'
    ));

    expect(result).toEqual({
      source: 'tc collective',
      medium: 'facebook',
      campaign: 'handoff-kit',
      content: 'case-study',
      referralCode: 'team-slug',
      landingPath: '/auth/signup',
    });
  });

  it('returns null for a visit with no attribution fields', () => {
    expect(parseGrowthAttribution(new URL('https://utilitysheet.com/pricing'))).toBeNull();
  });

  it('keeps the first attributable visit', () => {
    captureFirstTouchAttribution(new URL('https://utilitysheet.com/?utm_source=facebook'));
    captureFirstTouchAttribution(new URL('https://utilitysheet.com/?utm_source=partner'));

    expect(readPendingGrowthAttribution()?.source).toBe('facebook');
    expect(localStorage.getItem(GROWTH_ATTRIBUTION_STORAGE_KEY)).toContain('facebook');
  });
});
```

- [ ] **Step 2: Run the focused test and verify the missing module failure**

Run: `npm test -- tests/unit/growth-attribution.test.ts`

Expected: FAIL because `@/lib/growth/attribution` does not exist.

- [ ] **Step 3: Implement the attribution helper**

```ts
export const GROWTH_ATTRIBUTION_STORAGE_KEY = 'utilitysheet:growth-attribution:first-touch';

export type GrowthAttribution = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  referralCode: string | null;
  landingPath: string;
};

function normalize(value: string | null, maxLength = 100) {
  const cleaned = value?.trim().toLowerCase().replace(/[^a-z0-9._ -]/g, '').slice(0, maxLength);
  return cleaned || null;
}

function normalizeReferralCode(value: string | null) {
  const cleaned = value?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60);
  return cleaned || null;
}

export function parseGrowthAttribution(url: URL): GrowthAttribution | null {
  const source = normalize(url.searchParams.get('utm_source'));
  const medium = normalize(url.searchParams.get('utm_medium'));
  const campaign = normalize(url.searchParams.get('utm_campaign'));
  const content = normalize(url.searchParams.get('utm_content'));
  const referralCode = normalizeReferralCode(url.searchParams.get('ref'));

  if (!source && !medium && !campaign && !content && !referralCode) return null;

  return {
    source,
    medium,
    campaign,
    content,
    referralCode,
    landingPath: url.pathname.slice(0, 200) || '/',
  };
}

export function readPendingGrowthAttribution(): GrowthAttribution | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(GROWTH_ATTRIBUTION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GrowthAttribution;
  } catch {
    window.localStorage.removeItem(GROWTH_ATTRIBUTION_STORAGE_KEY);
    return null;
  }
}

export function captureFirstTouchAttribution(url: URL) {
  if (typeof window === 'undefined' || readPendingGrowthAttribution()) return;
  const parsed = parseGrowthAttribution(url);
  if (parsed) {
    window.localStorage.setItem(GROWTH_ATTRIBUTION_STORAGE_KEY, JSON.stringify(parsed));
  }
}

export async function persistPendingGrowthAttribution() {
  const pending = readPendingGrowthAttribution();
  if (!pending) return;
  const response = await fetch('/api/growth/attribution', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pending),
  });
  if (response.ok) {
    window.localStorage.removeItem(GROWTH_ATTRIBUTION_STORAGE_KEY);
  }
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test -- tests/unit/growth-attribution.test.ts`

Expected: PASS with 3 tests.

- [ ] **Step 5: Commit the parser**

```bash
git add lib/growth/attribution.ts tests/unit/growth-attribution.test.ts
git commit -m "feat: capture first-touch growth attribution"
```

### Task 2: Persist attribution once per account

**Files:**
- Create: `migrations-growth-attribution.sql`
- Modify: `schema.sql`
- Create: `lib/neon/queries/growth-attribution.ts`
- Modify: `lib/neon/queries/index.ts`
- Create: `app/api/growth/attribution/route.ts`
- Create: `tests/unit/growth-attribution-route.test.ts`

- [ ] **Step 1: Add the migration and canonical schema**

Add the following exact SQL to both `migrations-growth-attribution.sql` and the table section of `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS growth_attributions (
    account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    source TEXT,
    medium TEXT,
    campaign TEXT,
    content TEXT,
    referral_code TEXT,
    landing_path TEXT NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (char_length(source) <= 100),
    CHECK (char_length(medium) <= 100),
    CHECK (char_length(campaign) <= 100),
    CHECK (char_length(content) <= 100),
    CHECK (char_length(referral_code) <= 60),
    CHECK (char_length(landing_path) <= 200)
);

CREATE INDEX IF NOT EXISTS idx_growth_attributions_source
    ON growth_attributions(source, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_attributions_referral_code
    ON growth_attributions(referral_code)
    WHERE referral_code IS NOT NULL;
```

- [ ] **Step 2: Write the failing authenticated-route tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { getUser, ensureAccountActivation, saveAttribution } = vi.hoisted(() => ({
  getUser: vi.fn(),
  ensureAccountActivation: vi.fn(),
  saveAttribution: vi.fn(),
}));

vi.mock('@/lib/stack/server', () => ({ stackServerApp: { getUser } }));
vi.mock('@/lib/activation/ensure-account-activation', () => ({ ensureAccountActivation }));
vi.mock('@/lib/neon/queries', () => ({ saveFirstTouchGrowthAttribution: saveAttribution }));

import { POST } from '@/app/api/growth/attribution/route';

beforeEach(() => vi.clearAllMocks());

describe('POST /api/growth/attribution', () => {
  it('rejects anonymous requests', async () => {
    getUser.mockResolvedValue(null);
    const response = await POST(new Request('http://localhost/api/growth/attribution', {
      method: 'POST', body: JSON.stringify({ source: 'facebook', landingPath: '/' }),
    }));
    expect(response.status).toBe(401);
  });

  it('persists validated first-touch data for the activated account', async () => {
    getUser.mockResolvedValue({ id: 'auth_1', primaryEmail: 'tc@example.com' });
    ensureAccountActivation.mockResolvedValue({ account: { id: 'acct_1' } });
    const body = { source: 'facebook', medium: 'social', campaign: 'handoff-kit', content: null, referralCode: 'tc-team', landingPath: '/auth/signup' };
    const response = await POST(new Request('http://localhost/api/growth/attribution', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }));
    expect(response.status).toBe(204);
    expect(saveAttribution).toHaveBeenCalledWith('acct_1', body);
  });
});
```

- [ ] **Step 3: Run the route test and verify the missing route failure**

Run: `npm test -- tests/unit/growth-attribution-route.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 4: Implement insert-once persistence**

Create `lib/neon/queries/growth-attribution.ts`:

```ts
import { sql } from '@/lib/neon/db';
import type { GrowthAttribution } from '@/lib/growth/attribution';

export async function saveFirstTouchGrowthAttribution(accountId: string, data: GrowthAttribution) {
  if (!sql) return;
  await sql`
    INSERT INTO growth_attributions (
      account_id, source, medium, campaign, content, referral_code, landing_path
    ) VALUES (
      ${accountId}, ${data.source}, ${data.medium}, ${data.campaign},
      ${data.content}, ${data.referralCode}, ${data.landingPath}
    )
    ON CONFLICT (account_id) DO NOTHING
  `;
}
```

Export it from `lib/neon/queries/index.ts`:

```ts
export { saveFirstTouchGrowthAttribution } from './growth-attribution';
```

Create `app/api/growth/attribution/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureAccountActivation } from '@/lib/activation/ensure-account-activation';
import { saveFirstTouchGrowthAttribution } from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';

const nullableField = z.string().trim().max(100).nullable();
const schema = z.object({
  source: nullableField,
  medium: nullableField,
  campaign: nullableField,
  content: nullableField,
  referralCode: z.string().trim().max(60).regex(/^[a-z0-9-]+$/).nullable(),
  landingPath: z.string().trim().max(200).startsWith('/'),
});

export async function POST(request: Request) {
  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid attribution' }, { status: 400 });
  const activation = await ensureAccountActivation(user);
  if (!activation?.account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  await saveFirstTouchGrowthAttribution(activation.account.id, parsed.data);
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 5: Run the route tests**

Run: `npm test -- tests/unit/growth-attribution-route.test.ts`

Expected: PASS with 2 tests.

- [ ] **Step 6: Commit persistence**

```bash
git add migrations-growth-attribution.sql schema.sql lib/neon/queries/growth-attribution.ts lib/neon/queries/index.ts app/api/growth/attribution/route.ts tests/unit/growth-attribution-route.test.ts
git commit -m "feat: persist account acquisition attribution"
```

### Task 3: Capture campaign visits and persist after authentication

**Files:**
- Create: `components/growth/growth-attribution-capture.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/auth/signup/page.tsx`
- Modify: `tests/unit/growth-attribution.test.ts`

- [ ] **Step 1: Add a failing persistence test**

Append to `tests/unit/growth-attribution.test.ts`:

```ts
it('removes pending attribution only after successful persistence', async () => {
  captureFirstTouchAttribution(new URL('https://utilitysheet.com/?utm_source=facebook'));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  const { persistPendingGrowthAttribution } = await import('@/lib/growth/attribution');

  await persistPendingGrowthAttribution();

  expect(fetch).toHaveBeenCalledWith('/api/growth/attribution', expect.objectContaining({ method: 'POST' }));
  expect(readPendingGrowthAttribution()).toBeNull();
});
```

- [ ] **Step 2: Run the focused test**

Run: `npm test -- tests/unit/growth-attribution.test.ts`

Expected: PASS if Task 1's persistence helper matches the contract; otherwise fix the helper before continuing.

- [ ] **Step 3: Mount the browser capture component**

Create `components/growth/growth-attribution-capture.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { captureFirstTouchAttribution } from '@/lib/growth/attribution';

export function GrowthAttributionCapture() {
  useEffect(() => {
    captureFirstTouchAttribution(new URL(window.location.href));
  }, []);
  return null;
}
```

Import and render `<GrowthAttributionCapture />` inside `app/layout.tsx`, immediately inside `<StackAuthProvider>` and before `{children}`.

- [ ] **Step 4: Persist after account activation**

In `app/auth/signup/page.tsx`, import:

```ts
import { persistPendingGrowthAttribution } from '@/lib/growth/attribution';
```

Inside `getPostAuthRoute`, after `/api/account` returns a successful response and before returning the destination, add:

```ts
await persistPendingGrowthAttribution().catch((error) => {
  console.warn('Growth attribution persistence failed', error);
});
```

Move the `safeNext` return until after the account request and persistence so OAuth and `next` redirects both persist attribution. Return `safeNext || '/dashboard'` at the end.

- [ ] **Step 5: Run attribution and activation tests**

Run: `npm test -- tests/unit/growth-attribution.test.ts tests/unit/account-activation-sync.test.tsx tests/unit/ensure-account-activation.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit capture wiring**

```bash
git add components/growth/growth-attribution-capture.tsx app/layout.tsx app/auth/signup/page.tsx tests/unit/growth-attribution.test.ts
git commit -m "feat: connect campaign visits to activated accounts"
```

### Task 4: Add the white-label-safe packet referral CTA

**Files:**
- Modify: `lib/neon/queries/intake-links.ts`
- Modify: `lib/neon/queries/index.ts`
- Modify: `lib/packet/packet-data.ts`
- Modify: `lib/analytics/events.ts`
- Create: `components/packet/transaction-referral-cta.tsx`
- Modify: `app/packet/[token]/page.tsx`
- Modify: `tests/unit/packet-data.test.ts`
- Create: `tests/unit/transaction-referral-cta.test.tsx`

- [ ] **Step 1: Add failing packet-data assertions**

Add `getIntakeLinkByAccountId: vi.fn()` to the existing `@/lib/neon/queries` mock, import the mocked function with the other query imports, return `{ slug: 'tc-team' }` for the free-account test, and assert:

```ts
expect(result.data.meta).toEqual({
  show_powered_by: true,
  referral_code: 'tc-team',
});
```

In the paid test where powered-by is disabled, assert:

```ts
expect(result.data.meta.referral_code).toBeNull();
```

- [ ] **Step 2: Run the packet-data test and verify failure**

Run: `npm test -- tests/unit/packet-data.test.ts`

Expected: FAIL because packet metadata has no referral code.

- [ ] **Step 3: Add account intake-link lookup and packet metadata**

Add to `lib/neon/queries/intake-links.ts`:

```ts
export async function getIntakeLinkByAccountId(accountId: string): Promise<IntakeLink | null> {
  if (!sql) return null;
  const result = await sql`
    SELECT * FROM intake_links WHERE account_id = ${accountId} LIMIT 1
  `;
  return (result[0] as IntakeLink) || null;
}
```

Export it from `lib/neon/queries/index.ts`. In `lib/packet/packet-data.ts`, add `referral_code: string | null` to `meta`, fetch the intake link only when `forceShowPoweredBy` is true, and set:

```ts
meta: {
  show_powered_by: forceShowPoweredBy,
  referral_code: forceShowPoweredBy ? intakeLink?.slug || null : null,
}
```

This intentionally limits the new referral treatment to free accounts. Paid packet pages retain their current branding behavior without a new acquisition CTA.

- [ ] **Step 4: Add the referral component test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const trackEvent = vi.fn();
vi.mock('@/lib/analytics/events', () => ({ trackEvent }));

import { TransactionReferralCta } from '@/components/packet/transaction-referral-cta';

describe('TransactionReferralCta', () => {
  it('builds a trackable signup link and reports clicks', () => {
    render(<TransactionReferralCta referralCode="tc-team" />);
    const link = screen.getByRole('link', { name: /coordinating the other side/i });
    expect(link).toHaveAttribute('href', '/auth/signup?utm_source=utilitysheet_packet&utm_medium=product_referral&utm_campaign=transaction_exposure&ref=tc-team');
    fireEvent.click(link);
    expect(trackEvent).toHaveBeenCalledWith('packet_referral_cta_clicked', {
      source: 'packet_share_page',
      has_referral_code: true,
    });
  });
});
```

- [ ] **Step 5: Implement the client CTA and analytics type**

Add to `lib/analytics/events.ts`:

```ts
packet_referral_cta_clicked: BasePayload & {
  source: 'packet_share_page';
  has_referral_code: boolean;
};
```

Create `components/packet/transaction-referral-cta.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { trackEvent } from '@/lib/analytics/events';

export function TransactionReferralCta({ referralCode }: { referralCode: string | null }) {
  const params = new URLSearchParams({
    utm_source: 'utilitysheet_packet',
    utm_medium: 'product_referral',
    utm_campaign: 'transaction_exposure',
  });
  if (referralCode) params.set('ref', referralCode);

  return (
    <Link
      href={`/auth/signup?${params.toString()}`}
      className="mt-2 inline-flex text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
      onClick={() => trackEvent('packet_referral_cta_clicked', {
        source: 'packet_share_page',
        has_referral_code: Boolean(referralCode),
      })}
    >
      Coordinating the other side? Create your own seller utility link.
    </Link>
  );
}
```

Render it in `app/packet/[token]/page.tsx` directly below the existing Powered by link, only when `showPoweredBy` is true:

```tsx
{showPoweredBy ? (
  <TransactionReferralCta referralCode={data.meta.referral_code} />
) : null}
```

- [ ] **Step 6: Run packet tests**

Run: `npm test -- tests/unit/packet-data.test.ts tests/unit/packet-route-branding.test.ts tests/unit/transaction-referral-cta.test.tsx`

Expected: PASS, including the paid white-label assertion.

- [ ] **Step 7: Commit the referral loop**

```bash
git add lib/neon/queries/intake-links.ts lib/neon/queries/index.ts lib/packet/packet-data.ts lib/analytics/events.ts components/packet/transaction-referral-cta.tsx app/packet/[token]/page.tsx tests/unit/packet-data.test.ts tests/unit/transaction-referral-cta.test.tsx
git commit -m "feat: add packet referral acquisition path"
```

### Task 5: Publish the TC Utility Handoff Kit as the search foundation

**Files:**
- Create: `app/(marketing)/tc-utility-handoff-kit/page.tsx`
- Create: `tests/unit/tc-utility-handoff-kit.test.tsx`
- Modify: `app/sitemap.ts`
- Input: `docs/growth/tc-utility-handoff-kit.md`

- [ ] **Step 1: Write the failing resource-page test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import TcUtilityHandoffKitPage from '@/app/(marketing)/tc-utility-handoff-kit/page';

describe('TC Utility Handoff Kit page', () => {
  it('publishes the ungated templates and tagged product path', () => {
    render(<TcUtilityHandoffKitPage />);
    expect(screen.getByRole('heading', { name: /tc utility handoff kit/i })).toBeInTheDocument();
    expect(screen.getByText(/quick utility information for your closing/i)).toBeInTheDocument();
    expect(screen.getByText(/hi \[seller first name\]/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create your seller link/i })).toHaveAttribute(
      'href',
      '/auth/signup?utm_source=handoff-kit&utm_medium=resource&utm_campaign=90-day-tc-growth&utm_content=kit-cta'
    );
  });
});
```

- [ ] **Step 2: Run the page test and verify the missing module failure**

Run: `npm test -- tests/unit/tc-utility-handoff-kit.test.tsx`

Expected: FAIL because the page does not exist.

- [ ] **Step 3: Create the public resource page**

Create `app/(marketing)/tc-utility-handoff-kit/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingBreadcrumbs, MarketingPageHero, MarketingSection } from '@/components/marketing/page-shell';
import { createPageMetadata } from '@/lib/seo/site';

export const metadata: Metadata = createPageMetadata({
  title: 'Free TC Utility Handoff Kit',
  description: 'Copy a seller utility email, text message, and closing utility checklist built for transaction coordinators.',
  path: '/tc-utility-handoff-kit',
  keywords: ['transaction coordinator templates', 'seller utility email template', 'utility handoff checklist'],
});

const checklist = [
  'Add the utility-form link to the listing-side seller email template.',
  'Send the link at the point your process normally requests utility information.',
  'Confirm that the seller opened or submitted the form.',
  'Review provider names and public contact details for obvious errors.',
  'Save the finished sheet or PDF in the transaction file.',
  'Never request account numbers, passwords, or copies of utility bills.',
];

const signupHref = '/auth/signup?utm_source=handoff-kit&utm_medium=resource&utm_campaign=90-day-tc-growth&utm_content=kit-cta';

export default function TcUtilityHandoffKitPage() {
  return (
    <div className="bg-background">
      <MarketingPageHero
        eyebrow="Free TC resource"
        title="The TC Utility Handoff Kit"
        description="Copy the email, text message, and checklist for a cleaner seller utility handoff. Use the templates with any workflow or replace the form step with one reusable UtilitySheet link."
      >
        <MarketingBreadcrumbs items={[
          { label: 'Home', href: '/' },
          { label: 'TC Utility Handoff Kit', href: '/tc-utility-handoff-kit' },
        ]} />
      </MarketingPageHero>

      <MarketingSection title="Seller email template" description="Save this message in the email workflow you already use.">
        <div className="rounded-3xl border border-border bg-card/30 p-6 leading-7 text-muted-foreground">
          <p><strong className="text-foreground">Subject:</strong> Quick utility information for your closing</p>
          <p className="mt-4">Hi [Seller First Name],</p>
          <p className="mt-4">Please complete our short utility information form for [Property Address]:</p>
          <p className="mt-4">[UTILITY FORM LINK]</p>
          <p className="mt-4">It works from your phone and should only take a few minutes. If you are unsure about a provider, choose “Not sure” and continue—you do not need to research anything before submitting.</p>
          <p className="mt-4">Thank you!<br />[TC Name]<br />[TC Company]</p>
        </div>
      </MarketingSection>

      <MarketingSection title="Seller text template">
        <div className="rounded-3xl border border-border bg-card/30 p-6 leading-7 text-muted-foreground">
          Hi [Seller First Name]—when you have a moment, please complete this short utility form for [Property Address]: [UTILITY FORM LINK]. It works from your phone, and “Not sure” is completely fine if you do not know an answer. Thank you! —[TC Name]
        </div>
      </MarketingSection>

      <MarketingSection title="TC utility handoff checklist">
        <ol className="grid gap-3">
          {checklist.map((item, index) => (
            <li key={item} className="flex gap-4 rounded-2xl border border-border bg-card/20 p-5">
              <span className="font-semibold text-emerald-600">{index + 1}</span>
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
        </ol>
      </MarketingSection>

      <MarketingSection title="Want the automated version?" description="UtilitySheet replaces the blank form and cleanup with a reusable seller link, guided questions, tracking, and a clean web sheet plus PDF.">
        <Link href={signupHref} className="inline-flex rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-500">
          Create your seller link
        </Link>
      </MarketingSection>
    </div>
  );
}
```

- [ ] **Step 4: Add the route to the sitemap**

Add `'/tc-utility-handoff-kit'` directly after `'/real-estate-closing-utility-checklist'` in `app/sitemap.ts`.

- [ ] **Step 5: Run the page test and lint**

Run: `npm test -- tests/unit/tc-utility-handoff-kit.test.tsx`

Expected: PASS.

Run: `npx eslint 'app/(marketing)/tc-utility-handoff-kit/page.tsx' app/sitemap.ts`

Expected: exit code 0.

- [ ] **Step 6: Commit the public resource**

```bash
git add app/'(marketing)'/tc-utility-handoff-kit/page.tsx app/sitemap.ts tests/unit/tc-utility-handoff-kit.test.tsx
git commit -m "feat: publish TC utility handoff kit"
```

### Task 6: Upgrade the admin dashboard to the approved growth funnel

**Files:**
- Modify: `lib/admin/activation-funnel.ts`
- Modify: `tests/unit/activation-funnel.test.ts`
- Modify: `app/(admin)/admin/page.tsx`

- [ ] **Step 1: Extend the failing aggregate test**

Add these aggregate inputs and expectations to the existing test:

```ts
const stats = toActivationFunnelStats({
  total_accounts: 116,
  onboarding_completed: 63,
  dashboard_ready: 96,
  has_request: 34,
  seller_link_ready: 69,
  no_onboarding_no_request: 48,
  missing_defaults: 20,
  first_live_submission: 22,
  habitual_accounts: 9,
  paid_accounts: 7,
  first_live_submission_last_7d: 4,
});

expect(stats.firstLiveSubmission).toBe(22);
expect(stats.habitualAccounts).toBe(9);
expect(stats.paidAccounts).toBe(7);
expect(stats.firstLiveSubmissionLast7d).toBe(4);
expect(stats.signupToActivationRate).toBe(19);
expect(stats.activationToHabitRate).toBe(41);
```

Add a source-mapping test:

```ts
import { toActivationFunnelStats, toGrowthSourceStats } from '@/lib/admin/activation-funnel';

expect(toGrowthSourceStats([
  { source: 'facebook', signups: 20, activated: 8 },
  { source: null, signups: 5, activated: 1 },
])).toEqual([
  { source: 'facebook', signups: 20, activated: 8, activationRate: 40 },
  { source: 'unknown', signups: 5, activated: 1, activationRate: 20 },
]);
```

- [ ] **Step 2: Run the funnel test and verify failure**

Run: `npm test -- tests/unit/activation-funnel.test.ts`

Expected: FAIL because the new fields are not mapped.

- [ ] **Step 3: Extend types and calculations**

Add the snake-case fields to `ActivationFunnelAggregateRow`, add the camel-case counts and rates to `ActivationFunnelStats`, and map them in `toActivationFunnelStats` using the existing `asCount` and `percent` helpers.

Use these formulas:

```ts
signupToActivationRate: percent(firstLiveSubmission, totalAccounts),
activationToHabitRate: percent(habitualAccounts, firstLiveSubmission),
```

- [ ] **Step 4: Extend the SQL aggregation**

Add this CTE before the current `SELECT`:

```sql
, live_submission_counts AS (
    SELECT
        account_id,
        COUNT(*) FILTER (
            WHERE status = 'submitted'
              AND deleted_at IS NULL
              AND COALESCE(is_demo, FALSE) = FALSE
              AND COALESCE(metered_at, last_activity_at) >= NOW() - INTERVAL '30 days'
        )::int AS submitted_count_30d,
        MIN(COALESCE(metered_at, last_activity_at)) FILTER (
            WHERE status = 'submitted'
              AND deleted_at IS NULL
              AND COALESCE(is_demo, FALSE) = FALSE
        ) AS first_submitted_at
    FROM requests
    GROUP BY account_id
)
```

Join it as `LEFT JOIN live_submission_counts lsc ON lsc.account_id = a.id` and add:

```sql
COUNT(*) FILTER (WHERE lsc.first_submitted_at IS NOT NULL)::int AS first_live_submission,
COUNT(*) FILTER (WHERE lsc.submitted_count_30d >= 3)::int AS habitual_accounts,
COUNT(*) FILTER (
  WHERE a.subscription_status = 'pro' OR EXISTS (
    SELECT 1 FROM organizations paid_org
    WHERE paid_org.id = a.active_organization_id
      AND paid_org.subscription_status = 'team'
  )
)::int AS paid_accounts,
COUNT(*) FILTER (WHERE lsc.first_submitted_at >= NOW() - INTERVAL '7 days')::int AS first_live_submission_last_7d
```

The CTE deliberately calculates `first_submitted_at` across all time while limiting `submitted_count_30d` inside its own `FILTER` condition.

- [ ] **Step 5: Add the 90-day source breakdown query**

Add to `lib/admin/activation-funnel.ts`:

```ts
type GrowthSourceAggregateRow = {
  source?: string | null;
  signups?: number | string | null;
  activated?: number | string | null;
};

export type GrowthSourceStats = {
  source: string;
  signups: number;
  activated: number;
  activationRate: number;
};

export function toGrowthSourceStats(rows: GrowthSourceAggregateRow[]): GrowthSourceStats[] {
  return rows.map((row) => {
    const signups = asCount(row.signups);
    const activated = asCount(row.activated);
    return {
      source: row.source || 'unknown',
      signups,
      activated,
      activationRate: percent(activated, signups),
    };
  });
}

export async function getGrowthSourceStats(): Promise<GrowthSourceStats[]> {
  if (!sql) return [];
  const result = await sql`
    WITH activated_accounts AS (
      SELECT DISTINCT account_id
      FROM requests
      WHERE status = 'submitted'
        AND deleted_at IS NULL
        AND COALESCE(is_demo, FALSE) = FALSE
    )
    SELECT
      COALESCE(ga.source, 'unknown') AS source,
      COUNT(*)::int AS signups,
      COUNT(*) FILTER (WHERE aa.account_id IS NOT NULL)::int AS activated
    FROM accounts a
    LEFT JOIN growth_attributions ga ON ga.account_id = a.id
    LEFT JOIN activated_accounts aa ON aa.account_id = a.id
    WHERE a.role = 'user'
      AND a.created_at >= NOW() - INTERVAL '90 days'
    GROUP BY COALESCE(ga.source, 'unknown')
    ORDER BY activated DESC, signups DESC, source ASC
  `;
  return toGrowthSourceStats(result);
}
```

- [ ] **Step 6: Render growth cards and source results**

Add a `Growth Funnel` section in `app/(admin)/admin/page.tsx` with:

```tsx
<StatsCard
  title="Activated Accounts"
  value={stats.activationFunnel.firstLiveSubmission.toString()}
  description={`${stats.activationFunnel.signupToActivationRate}% received a live seller submission`}
  icon={ClipboardCheck}
/>
<StatsCard
  title="Activated This Week"
  value={stats.activationFunnel.firstLiveSubmissionLast7d.toString()}
  description="first live submissions in the last 7 days"
  icon={Activity}
/>
<StatsCard
  title="Habitual Accounts"
  value={stats.activationFunnel.habitualAccounts.toString()}
  description={`${stats.activationFunnel.activationToHabitRate}% of activated accounts reached 3 submissions in 30 days`}
  icon={FileText}
/>
<StatsCard
  title="Paying Accounts"
  value={stats.activationFunnel.paidAccounts.toString()}
  description="Pro accounts and active Team members"
  icon={Building2}
/>
```

Fetch `getGrowthSourceStats()` beside the existing funnel query and render this directly below the cards:

```tsx
<div className="overflow-hidden rounded-xl border border-border/70">
  <table className="w-full text-sm">
    <thead className="bg-muted/40 text-left">
      <tr>
        <th className="px-4 py-3 font-medium">Acquisition source</th>
        <th className="px-4 py-3 text-right font-medium">Signups</th>
        <th className="px-4 py-3 text-right font-medium">Activated</th>
        <th className="px-4 py-3 text-right font-medium">Rate</th>
      </tr>
    </thead>
    <tbody>
      {stats.growthSources.map((row) => (
        <tr key={row.source} className="border-t border-border/70">
          <td className="px-4 py-3">{row.source}</td>
          <td className="px-4 py-3 text-right">{row.signups}</td>
          <td className="px-4 py-3 text-right">{row.activated}</td>
          <td className="px-4 py-3 text-right">{row.activationRate}%</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

- [ ] **Step 7: Run the funnel test and lint the touched files**

Run: `npm test -- tests/unit/activation-funnel.test.ts`

Expected: PASS.

Run: `npx eslint lib/admin/activation-funnel.ts 'app/(admin)/admin/page.tsx'`

Expected: exit code 0.

- [ ] **Step 8: Commit the scoreboard**

```bash
git add lib/admin/activation-funnel.ts tests/unit/activation-funnel.test.ts app/'(admin)'/admin/page.tsx
git commit -m "feat: report live activation in admin dashboard"
```

### Task 7: Verify the complete product-growth foundation

**Files:**
- Verify only; fix failures in files already listed in Tasks 1-6.

- [ ] **Step 1: Run the targeted unit suite**

Run:

```bash
npm test -- tests/unit/growth-attribution.test.ts tests/unit/growth-attribution-route.test.ts tests/unit/packet-data.test.ts tests/unit/packet-route-branding.test.ts tests/unit/transaction-referral-cta.test.tsx tests/unit/tc-utility-handoff-kit.test.tsx tests/unit/activation-funnel.test.ts
```

Expected: all tests PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: exit code 0 with no new errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Next.js production build completes successfully.

- [ ] **Step 4: Apply the migration in the target database**

Run the contents of `migrations-growth-attribution.sql` through the same Neon migration workflow used for the other root migration files.

Expected verification query:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'growth_attributions'
ORDER BY ordinal_position;
```

Expected columns: `account_id`, `source`, `medium`, `campaign`, `content`, `referral_code`, `landing_path`, `captured_at`.

- [ ] **Step 5: Perform the manual white-label check**

1. Open a submitted free-account packet and verify the contextual signup CTA appears.
2. Click it and verify the signup URL includes the three UTM values and the intake-link slug.
3. Create a test signup and verify one `growth_attributions` row is stored.
4. Open a paid packet with powered-by disabled and verify neither UtilitySheet branding nor the contextual CTA appears.

Expected: all four checks pass.

- [ ] **Step 6: Commit any verification-only fixes**

```bash
git add app/layout.tsx app/auth/signup/page.tsx app/api/growth/attribution/route.ts app/packet/[token]/page.tsx app/'(admin)'/admin/page.tsx app/'(marketing)'/tc-utility-handoff-kit/page.tsx app/sitemap.ts components/growth/growth-attribution-capture.tsx components/packet/transaction-referral-cta.tsx lib/growth/attribution.ts lib/neon/queries/growth-attribution.ts lib/neon/queries/index.ts lib/neon/queries/intake-links.ts lib/analytics/events.ts lib/packet/packet-data.ts lib/admin/activation-funnel.ts schema.sql migrations-growth-attribution.sql tests/unit/growth-attribution.test.ts tests/unit/growth-attribution-route.test.ts tests/unit/packet-data.test.ts tests/unit/transaction-referral-cta.test.tsx tests/unit/tc-utility-handoff-kit.test.tsx tests/unit/activation-funnel.test.ts
git commit -m "fix: complete product growth foundation verification"
```

Skip this commit when verification requires no fixes.
