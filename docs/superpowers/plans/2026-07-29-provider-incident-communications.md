# Provider Incident Communications Implementation Plan

**Status (2026-07-29):** Templates, recipient segmentation, dry-run-first sender, and dashboard update
are complete and validated. The recipient preview found 8 deduplicated recipients. The dashboard update
is deployed in production as part of release `3adfc8c`. No customer email has been sent.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare truthful segmented customer messages and a resolved product update without sending or publishing them prematurely.

**Architecture:** Keep copy generation deterministic and independent from delivery. A typed template module renders the four approved segments; a dry-run-first delivery command derives recipients from billing and incident data rather than hardcoded personal information. The dashboard update is added only after the hotfix copy can truthfully say the issue is resolved.

**Tech Stack:** TypeScript, Node.js 20 ESM/`tsx`, Neon serverless SQL, Resend, existing product-update model, Vitest.

---

No email send, product deployment, or public publication is included without separate authorization.
Tracked source and documentation must contain no customer email, account ID, seller data, or property
address.

### Task 1: Draft the approved message set

**Files:**
- Create: `docs/incidents/2026-07-provider-resolution-customer-communications.md`

- [ ] **Step 1: Write the reporting-customer reply**

Use this factual structure:

```text
Subject: I found and fixed the UtilitySheet provider issue

Hi [First name],

Thank you for telling me about the incorrect provider suggestions and missing contact information. I
found the cause: a provider-resolution change released on July 24 sometimes returned no usable result,
and UtilitySheet's fallback and caching behavior could then show a plausible but incorrect company or
leave contact information unresolved.

I rolled back the change and added safeguards around provider responses and caching. I'm also reviewing
the submitted sheets from the affected period. Where the provider can be verified confidently, missing
contact details will be repaired without changing the provider name. If a provider itself is unclear,
I'll contact you before changing it.

I've applied a one-month credit to your UtilitySheet account. It will be used automatically on your next
invoice; you don't need to do anything.

I'm sorry this made extra work for you, especially on active transactions. Thank you again for flagging
it.

Haydn
UtilitySheet
```

The final tense must be adjusted to actual state: do not say safeguards are added, sheets are reviewed,
or credit is applied until each action is verified.

- [ ] **Step 2: Write the other three segments**

Include:

- affected paid: direct apology, identified incident window, one-month credit, repair/confirmation path;
- paid not proven affected: concise reliability update and goodwill one-month credit;
- affected non-billed: apology and repair offer, with no claim of a billing credit.

Use “we identified submitted sheets with…” rather than “only these customers were affected.” Explain
that the credit applies to the next invoice automatically and requires no action.

- [ ] **Step 3: Write the resolved product update**

Draft:

```text
Resolved: Provider suggestions and contact lookup

Between July 24 and July 29, some provider lookups could return generic suggestions or omit contact
information. We restored the previous provider model, added structured-response validation, shortened
fallback caching, and are reviewing submitted sheets from the affected period.

No action is needed for most sheets. If a provider itself cannot be verified confidently, we will
contact the account owner before changing it.
```

Keep the draft marked unpublished until the engineering release and rollback verification are current.

### Task 2: Create tested segment-aware templates

**Files:**
- Create: `lib/email/provider-incident-update.ts`
- Create: `tests/unit/provider-incident-update-email.test.ts`

- [ ] **Step 1: Write failing template tests**

Test every segment for required and forbidden claims:

```ts
const affectedPaid = buildProviderIncidentEmail({
    segment: 'affected_paid',
    firstName: 'Taylor',
    state: {
        hotfixDeployed: true,
        creditApplied: true,
        reviewComplete: false,
    },
});

expect(affectedPaid.subject).toMatch(/UtilitySheet provider/i);
expect(affectedPaid.text).toContain('one-month credit');
expect(affectedPaid.text).not.toContain('all affected sheets have been fixed');
expect(affectedPaid.text).not.toContain('Gemini');
```

Add tests proving:

- credit language is absent unless `creditApplied` is true;
- resolved language is absent unless `hotfixDeployed` is true;
- non-billed copy never mentions a credit;
- messages contain no raw account IDs, request IDs, or property addresses;
- HTML output escapes the first name.

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npm test -- tests/unit/provider-incident-update-email.test.ts --run
```

Expected: FAIL because the template module does not exist.

- [ ] **Step 3: Implement explicit communication state**

Define:

```ts
export type ProviderIncidentSegment =
    | 'reporting_customer'
    | 'affected_paid'
    | 'paid_goodwill'
    | 'affected_non_billed';

export interface ProviderIncidentCommunicationState {
    hotfixDeployed: boolean;
    creditApplied: boolean;
    reviewComplete: boolean;
}
```

Render text and HTML from the same paragraph model. Build state-dependent sentences explicitly instead
of interpolating unverifiable claims.

- [ ] **Step 4: Run template tests**

Run:

```powershell
npm test -- tests/unit/provider-incident-update-email.test.ts --run
```

Expected: PASS.

### Task 3: Build a data-derived, dry-run-first sender

**Files:**
- Create: `scripts/incident/send-provider-incident-update.ts`
- Modify: `package.json`
- Create: `tests/unit/provider-incident-recipient-segmentation.test.ts`

- [ ] **Step 1: Add the package command**

Add:

```json
{
  "scripts": {
    "incident:email": "tsx scripts/incident/send-provider-incident-update.ts"
  }
}
```

- [ ] **Step 2: Write failing recipient segmentation tests**

Given affected account IDs, active Pro billing entities, one Team billing entity, and organization
admins, assert:

- the explicitly supplied reporting account is `reporting_customer`;
- another affected active Pro account is `affected_paid`;
- an active paid account without an affected sheet is `paid_goodwill`;
- an affected non-billed account is `affected_non_billed`;
- organization admins receive one Team billing-entity message each, deduplicated by normalized email;
- Free accounts without affected submissions are absent;
- founder/test domains and configured exclusion addresses are absent.

- [ ] **Step 3: Implement read-only recipient queries**

Use the same telemetry-derived incident bounds and `seller_submitted` correlation as the review report.
Select account IDs affected during the window. Separately select active Pro account recipients and Team
organization admins. The reporting account ID is supplied at runtime:

```text
--reporting-account-id <uuid>
```

Do not hardcode the customer ID or email in tracked source.

- [ ] **Step 4: Implement safe dry-run output**

Default output shows segment counts only:

```text
mode=dry-run
reporting_customer=1
affected_paid=<n>
paid_goodwill=<n>
affected_non_billed=<n>
excluded=<n>
No emails sent.
```

`--test <email>` sends all four rendered variants only to the supplied address with `[TEST]` subjects.
Live delivery requires:

```text
--send
--confirm provider-resolution-2026-07
--hotfix-deployed
--credits-applied
```

Reject `--credits-applied` unless the Stripe dry-run detects incident transactions for all seven active
billing entities.

- [ ] **Step 5: Implement sequential Resend delivery**

Send at no more than one request every 600ms. Stop on any thrown error, report aggregate counts, and do
not print recipient email addresses in ordinary output. Include `replyTo` and both text/HTML content.

- [ ] **Step 6: Run segmentation and template tests**

Run:

```powershell
npm test -- tests/unit/provider-incident-update-email.test.ts tests/unit/provider-incident-recipient-segmentation.test.ts --run
```

Expected: PASS.

### Task 4: Add the resolved dashboard update only when truthful

**Files:**
- Modify: `lib/product-updates.ts`
- Create: `tests/unit/provider-incident-product-update.test.ts`

- [ ] **Step 1: Write a failing product-update test**

Assert the newest featured update:

```ts
expect(FEATURED_PRODUCT_UPDATES[0]).toMatchObject({
    id: 'provider-resolution-incident-resolved',
    category: 'bugfix',
    is_published: true,
});
expect(FEATURED_PRODUCT_UPDATES[0].body).toContain('July 24');
expect(FEATURED_PRODUCT_UPDATES[0].body).toContain('July 29');
expect(FEATURED_PRODUCT_UPDATES[0].body).not.toMatch(/Gemini|all affected|no customers/i);
```

- [ ] **Step 2: Add the resolved update after hotfix validation**

Add the approved copy to the top of `FEATURED_PRODUCT_UPDATES` with a verified publication timestamp.
Do not add it before local hotfix tests pass. Adding source does not authorize deployment.

- [ ] **Step 3: Run product-update tests**

Run:

```powershell
npm test -- tests/unit/provider-incident-product-update.test.ts --run
```

Expected: PASS.

### Task 5: Validate copy and preserve the send gate

**Files:**
- Modify: `.ai/CURRENT.md`
- Modify: `.ai/plans/2026-07-29-provider-contact-resolution-incident.md`

- [ ] **Step 1: Run focused tests and static checks**

Run:

```powershell
npm test -- tests/unit/provider-incident-update-email.test.ts tests/unit/provider-incident-recipient-segmentation.test.ts tests/unit/provider-incident-product-update.test.ts --run
npm exec tsc -- --noEmit
npm exec eslint -- lib/email/provider-incident-update.ts scripts/incident/send-provider-incident-update.ts tests/unit/provider-incident-update-email.test.ts tests/unit/provider-incident-recipient-segmentation.test.ts tests/unit/provider-incident-product-update.test.ts
git diff --check
npm run security:scan
```

Expected: PASS.

- [ ] **Step 2: Review rendered drafts**

Run the sender in dry-run mode and, only if explicitly authorized, send four variants to the owner's
test address. Review subject, greeting, incident wording, credit tense, and reply path. Do not send to
customers.

- [ ] **Step 3: Update durable handoff**

Record which copy is ready, which facts are verified, and that customer send and product deployment
remain separately authorization-gated.
