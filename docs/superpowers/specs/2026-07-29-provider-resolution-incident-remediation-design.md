# Provider Resolution Incident Remediation Design

## Goal

Recover safely from the July 24-29, 2026 provider-resolution incident, prevent the same Gemini
response-shape failure from silently producing long-lived fallbacks, compensate every actively billed
customer with one current subscription month, and give the operator a bounded way to review affected
submitted sheets before any customer data is changed.

## Verified Incident

Production changed from `gemini-3.1-flash-lite` to `gemini-3.5-flash-lite` on July 24. UtilitySheet's
combination of Google Search grounding and JSON response mode did not include an explicit response JSON
schema. With the installed Gemini client, that request shape could consume input tokens while returning
no candidate, text, or output tokens on 3.5.

The application degraded without an HTTP failure: provider suggestions used a generic fallback list and
contact resolution returned no contact. Normal cache durations then preserved generic suggestions and
contact misses well beyond the initiating request.

The measured non-demo impact after cutover was 14 of 18 submitted sheets with at least one affected
entry and 34 unresolved provider entries out of 80. The reporting account had five affected submitted
sheets and eight unresolved entries out of 23.

The emergency rollback to `gemini-3.1-flash-lite` is complete. A production demo smoke test returned
non-empty results for all configured utility categories and fresh telemetry identified the restored
model.

## Engineering Remediation

Keep production on `gemini-3.1-flash-lite` while the compatibility change is implemented and validated.
The hotfix will:

- provide caller-specific response JSON schemas for provider arrays and contact objects;
- classify a transport-success response with no candidate or text as `provider_error`;
- preserve the original upstream failure reason through quality gates and telemetry;
- include the Gemini model and an AI request-format version in provider/search/contact cache namespaces;
- retain long cache durations for usable positive results;
- cache contact misses and generic provider/search fallbacks for no more than five minutes;
- bump the affected cache namespaces as part of the release; and
- add focused tests for the 3.5 Search-plus-schema request, empty responses, failure-reason preservation,
  and cache key/TTL behavior.

The incident hotfix will not upgrade the Gemini SDK or API version. That evaluation is a separate
follow-up after production is stable.

## Affected-Sheet Review Packet

The operator will not review raw database rows and will not be expected to discover affected requests
manually. A read-only incident-report command will identify submitted, non-demo requests in the verified
incident window and produce a local, untracked review packet.

The packet will group entries by submitted sheet and show only the information needed for the decision:

- request identifier and a link to its existing Admin request page;
- property address, because utility service area cannot be verified without location;
- utility category;
- seller-selected or manually entered provider name;
- entry mode (`suggested_confirmed`, `free_text`, or other recorded mode);
- current phone and website, including which values are missing;
- a freshly resolved contact candidate after the hotfix;
- fresh location-aware provider candidates when the recorded provider may have come from fallback; and
- a proposed disposition with the reason it was flagged.

The report classifies each flagged entry before operator review:

1. **Automatic contact repair candidate** — the recorded provider name matches the fresh result, the
   provider is confirmed for the property's service area, the contact comes from an official or strongly
   verified source, and only null phone/website fields would change.
2. **Needs customer confirmation** — the provider itself is questionable, including entries that may
   have been selected from the incident's generic fallback. No provider or contact field is changed
   automatically.
3. **Leave unchanged** — available evidence is insufficient or the current data should be preserved.

The operator reviews the automatic candidate set as a batch and can remove any row from it. Ambiguous
rows remain a smaller decision queue rather than requiring manual review of every unresolved entry.

The review packet must not include seller email, phone, account email, or other fields unnecessary for
provider verification. It remains local and untracked.

The existing `/admin/requests/[id]` page is useful for opening the request and reviewing its lifecycle,
but it currently omits provider phone and website. The paid customer's submitted-sheet editor displays
and can edit provider name, phone, and website, but support impersonation is not the primary incident
triage workflow. The incident packet therefore supplies the missing cross-request view without turning
a one-time response into a permanent Admin feature.

## Repair Boundary

Generating the review packet is read-only. After operator review, a separate repair command will first
produce a dry-run change set containing only high-confidence automatic candidates that the operator did
not exclude, with old/new field summaries.

If explicitly authorized, application of the repair may:

- fill a currently null contact phone or website for a provider that passed the automatic-repair checks;
- preserve provider name, raw seller text, entry mode, and every existing contact value; and
- skip any row that changed after the review packet was generated.

It may not automatically replace provider names. Entries marked `Needs customer confirmation` remain
unchanged until the customer or operator supplies a verified correction. Applying any repair is a
separate production-data mutation requiring explicit authorization after the dry run is reviewed.

Successful repair updates the live web packet and future PDF downloads. Previously emailed PDF
attachments are immutable snapshots and cannot be changed retroactively.

## Universal Paid-Customer Credit

Every actively billed customer receives one month of its current subscription amount. The verified
scope is six active Pro subscriptions and one active four-seat Team subscription, totaling $82.

A one-off operational command will:

- run in dry-run mode unless an explicit `--apply` option is present;
- resolve live active Stripe billing entities and their current monthly recurring amounts;
- refuse duplicate application by checking stable incident metadata and using a stable Stripe
  idempotency key;
- create a negative Stripe customer-balance transaction with an incident description and metadata;
- avoid the referral-credit ledger and avoid a database migration; and
- report only aggregate results and opaque billing identifiers, not customer PII.

Applying the seven credits is a live financial mutation requiring separate explicit authorization after
the dry run is reviewed.

## Communications

Communication is segmented:

- the reporting customer receives a personal apology, incident resolution, automatic one-month credit,
  and an offer to review questionable sheets;
- other affected paid customers receive an apology, the same credit, and a repair offer;
- paid customers without confirmed affected sheets receive a short reliability update and goodwill
  credit; and
- an affected but non-billed Pro-entitled account receives an apology and repair offer but no billing
  credit.

There is no Free-plan broadcast or credit because no Free submission was found in the measured impact.
Copy will say that submitted sheets with incorrect suggestions or missing contact information were
identified during July 24-29. It will not claim that every affected customer or sheet has been
identified, and it will explain that fallback and caching behavior turned empty AI responses into
misleading results.

The reporting customer may receive an acknowledgement before all remediation is complete. The resolved
incident update and general customer email follow the validated code release and applied credits. No
email is sent without explicit authorization.

## Validation

Engineering validation will include focused unit tests, the repository TypeScript check, affected-file
lint, and a controlled provider/contact smoke test. The rollback remains the production model until the
schema-backed request shape is proven.

Operational validation will include:

- read-only incident-report counts reconciling to the verified impact;
- manual spot checks of automatic-repair classification and every ambiguous disposition;
- a repair dry run proving existing values are never overwritten;
- a credit dry run reconciling seven billing entities and $82 total;
- duplicate-run tests for repair and Stripe credit idempotency; and
- post-application aggregate verification only after separate authorization.

## Safety and Authorization

Customer/property details are sensitive and must not enter tracked artifacts, logs, or handoffs. No
cache mutation, production record repair, Stripe credit, customer email, deployment, commit, or push is
authorized by this design approval alone. Each live operational action retains its normal explicit
authorization boundary.
