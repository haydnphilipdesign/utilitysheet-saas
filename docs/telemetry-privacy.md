# Telemetry privacy boundaries

Slices 1–5 of the [telemetry plan](../.ai/plans/2026-10-13-telemetry-audit-and-improvements.md)
are implemented and tested locally. This does not establish production collection
or remove historical data. AI-row rules remain in [ai-telemetry.md](ai-telemetry.md).

## Capability-bearing limiter identifiers

`lib/rate-limit-identifier.ts` produces a deterministic SHA-256 identifier with
version and policy scope. Hash inputs include high-entropy seller/packet tokens;
they never go to the limiter, Redis counters or Upstash analytics as raw strings.
These stable digests remain linkable pseudonyms, not anonymous identifiers.
Hashing an IP/email by itself would not provide the same protection.

| Caller | Grouping | Policy / threshold |
| --- | --- | --- |
| Seller submission | token | 5 / 60 seconds |
| Seller suggestions and search (shared scope) | token + IP | 20 / 60 seconds |
| Seller return-link email | token, retaining existing logical prefix | 3 / 15 minutes |
| Seller diagnostic observations (new in Slice 5) | token + IP | 60 / 60 seconds |
| Public packet PDF | token + IP | 5 / 60 seconds |

The observation scope is new, so it has no legacy raw-key bucket and is not part
of the counter-key migration below. Other identifiers/policies retain existing keys. Redis-required paths remain
unavailable when configuration is missing. SDK timeout responses are also
unavailable: installed Upstash otherwise returns `success: true` on timeout.
Rejected limiter calls still propagate to existing route error handling.

### Required release/counter-key migration procedure

**Do not perform a rolling cutover with traffic:** raw and digest buckets are
different, so each version would grant a fresh allowance. The installed SDK
reads a weighted previous sliding bucket and retains keys for `2 * window +
1000 ms`. The longest affected window is 15 minutes; waiting just 15 minutes
is insufficient. No raw-key compatibility mode is included in the patch.

With separate explicit owner authorization for the release:

1. Block new traffic to all five affected endpoints on every hostname/version
   sharing the production Redis store, returning temporary unavailability.
   Drain existing old-version requests and record when the last finishes.
   Keep unrelated policies enforced. Never disable rate limiting or delete keys.
2. Keep affected traffic blocked for **at least 31 minutes after the last
   old-version request finishes** (30-minute overlap plus a safety buffer).
   Verify no alternate/preview/old deployment can receive affected traffic.
3. Route exclusively to the new version, verify safe synthetic identifiers and
   unavailable/429 outcomes under a separately approved validation procedure,
   then reopen affected traffic. Do not send customer capabilities as probes.
4. A rollback that changes identifier versions needs the same drain/wait/exclusive
   routing procedure. Do not assume a rollback can immediately reuse old buckets.

This preserves enforcement through a deliberate short availability pause, then
starts new buckets only after legacy counts no longer apply. The release timing,
traffic gate and provider checks need owner review/authorization; none were
performed by the local implementation. Historical analytics retention and any
cleanup are separate work; expiry of counters does not erase analytics history.

## Browser collectors

`TelemetryCollectors` supplies installed SDK `beforeSend` hooks for Analytics
and Speed Insights. Both reconstruct only documented hook fields. URLs lose
query/fragment data; Speed Insights route is derived from the safe URL rather
than trusting a supplied route. Unknown extra hook fields (including referrers)
are removed. Invalid URLs, embedded credentials and unsupported origins are
dropped. Allowed origins are utilitysheet.com, www.utilitysheet.com and local
loopback hosts; deployment/preview origins are intentionally not collected.

The shared finite route policy retains known public paths. Seller, packet,
intake/form and invitation URLs become static labels; auth handlers, admin and
dashboard routes collapse to static families. Unknown or malformed paths become
`/other`, never the original path. Encoded path fixtures are covered. Adding a
public route requires an explicit allowlist update for a separate route label.

Custom seller events retain coarse name/properties via the SDK's separate track
contract; the URL hook retains `type: event`. No capability or request-id property
is defined for the advanced packet events. Current callers do not supply either.
Browser counts remain aggregate observations, not request-correlated evidence.

Tests use the installed React collectors and synthetic collector scripts in an
isolated browser bundle. Scripts and beacons are intercepted in Desktop Chrome,
Mobile Safari and Mobile Chrome. This proves hook wiring and the local boundary;
the hosted Vercel script/dashboard contract remains an external verification
step requiring separate authorization. No real collector script/beacon is sent.

## First-touch attribution

Client capture, old pending localStorage records and the authenticated API apply
the same route policy and campaign-value allowlists. Unknown UTM values become
null instead of sanitized arbitrary text. Only approved values in
`CAMPAIGN_VALUES` are retained; new campaign names must be added deliberately.
Existing in-product packet/email and handoff-kit campaign values are included.
Arbitrary suite/partner campaign strings are no longer automatically captured.

The dedicated public referral slug remains intentional business attribution,
bounded to 60 lowercase alphanumeric/hyphen characters; malformed values are
discarded, not repaired. It is a public referral identity, never an authorization
credential. Unknown properties are discarded. Storage failures cannot break
capture; invalid/old unsafe pending records are removed or replaced before
posting. No-attribution payloads create no empty first-touch row. Previously
persisted database rows are untouched.

## Operational diagnostic boundary (Slice 2)

`lib/telemetry/diagnostics.ts` reconstructs a flat payload for fixed event codes.
Accepted properties are finite operation/category/source/reason/strategy enums,
nonnegative finite numbers up to one billion, booleans and internal UUID request
IDs. Unknown keys, strings, objects, provider IDs and invalid values are dropped.
Error names use a finite class allowlist (unknown names become `UnknownError`);
integer HTTP status 100–599 maps to rate-limit, upstream-request/server or
unclassified family. Neither class nor family establishes root cause. No error
message, stack, cause, raw body, JSON fragment, filename, recipient, provider
name, locality or request URL is serialized. Sink/getter failures are caught.

Covered paths: Gemini API/retry/parse/config warnings; suggestion outcome and
contact/persistence logs; all sends in `lib/email/email-service.ts` including
PDF attachment outcomes and demo redirects; PDF launch/readability/failure;
intake metadata/start/validation; seller read/submission/suggestions/search/
self-link catch blocks and public packet read/download catches. Static Gemini
circuit/config messages and seller no-recipient warning remain safe fixed text
or internal numeric state. Email acceptance logs carry operation rather than
arbitrary provider message IDs; reminder return values still retain their
message ID for signed delivery correlation.

Delivered email subjects/HTML, attachment filenames/bytes and PDF rendering are
unchanged. Internal service error return contracts are unchanged; callers must
not serialize these raw errors to diagnostics. Slice 4 replaces the old
`advanced_renderer` label with independent finite `mode` and `renderStrategy`
fields; both current modes use `print_pdf`. No PDF architecture, provider,
dependency or schema change.

New intake `request_created.event_data` includes fixed actor/source, normalized
utility categories/packet mode/modules/exclusions and canonicalization/street-
number flags only. Addresses and flat/nested link slugs are omitted. Address
records and resume cookies retain their business behavior; request source-form
ID/revision still captures provenance. Existing event envelope IP/user agent
remains separately scoped. No readers of the removed event fields were found.

### Remaining raw-log inventory (verified source, not deployed exposure)

This local slice does not claim global redaction. Follow-up review should start
with these current producers and their consumers, using the same bounded
contracts where appropriate:

| Area / source | Remaining evidence / scope |
| --- | --- |
| `lib/cache.ts` | Redis get/set/delete raw exceptions; may contain provider request/key context |
| `lib/address/structured-address.ts`, `lib/neon/queries/requests.ts` | Lazy address-backfill and utility-entry read exceptions; SQL failures may carry values |
| `app/api/requests/route.ts`, `app/api/test-drive/route.ts`, request edit/configuration catches | Raw primary creation/read/write/email exceptions remain; Slice 3 auxiliary event failures use a fixed marker |
| `app/api/branding/test-{pdf,email}/route.ts`, branding CRUD/upload | Raw render/send/asset exceptions from callers outside public packet flow |
| Billing webhook/checkout/portal, organization billing, referral helpers | Raw Stripe/signature/credit exceptions; preserve money/idempotency boundaries |
| Organization/invite, auth/account/onboarding, cron and growth-referral catches | Raw exceptions or provider-controlled strings; do not infer source safety from fixed prefixes |
| Ops/admin/reminder helpers | Ops write failures now use the fixed Slice 3 marker; stored metadata and distinct ledger/audit contracts retain their existing rules and need separate review |
| Browser console sites and standalone scripts | Not migrated or claimed safe by this server-path slice |

Inventory search: `rg -n -g '*.ts' 'console\.(error|warn|log)' lib app/api`.
Table rows summarize remaining classes, not a claim every console line leaks.
No provider contents or historical rows were inspected. Historical logs/intake
events remain until separately approved retention/cleanup; local removal of new
copies is not historical remediation. Durable rationale:
[bounded operational diagnostics](../.ai/decisions/2026-10-13-bounded-operational-diagnostics.md).

## Auxiliary observation failure isolation

Slice 3 explicitly classifies these writes as auxiliary: request creation
observations (agent, intake and test-drive), seller opens and self-link email
observations, suggestion fetch/search events, test-drive invitation/delivery
observations, AI run/items and selection observations, operational events/sampled
successes and job start/finish observations. `createEventLog` remains a strict
writer; callers opt in through `auxiliaryEventWriter`.

Each operation gets one awaited attempt with a 500 ms deadline. The installed
Neon HTTP driver receives an AbortController signal through query fetch options.
A deadline guard also bounds local waiting if a sink ignores abort; it is
coupled to real fetch cancellation, not just a race. Detached suggestion writes
are now awaited within this budget. No background invocation lifecycle or
automatic retries are used. [Neon's driver documentation](https://neon.com/docs/serverless/serverless-driver)
and installed 1.0.2 source/types were verified; cancellation tests intercept the
installed driver's synthetic HTTP without sending telemetry.

Rejection/timeout emits one `auxiliary_write_failed` marker with finite
observation and reason (`write_failed` or `deadline`), allowlisted exception
class/HTTP family, and no payload, raw message/stack/SQL/provider code, token or
recipient. Console failures do not affect the primary action. Creation remains
successful, intake sets its resume cookie, opens still return the form and
transition status, and an accepted self-link email is not reported as failed
or resent because its observation failed.

The budget is per operation; multiple operations add bounded waits. This does
not bound primary database reads/writes, provider/email/cache calls or full
endpoint duration. HTTP abort cannot prove remote rollback; a row might commit
after the caller returns a fallback. Missing rows mean unknown coverage. AI
run/items share a deadline but can remain partial; atomicity/lineage is Slice 8.
Job start/finish timeout may leave a missing or stale/running row, so a running
observation alone is not proof of a stuck job. Monitoring coverage improvements
remain Slice 7; historical observations are not reclassified or cleaned.

Required atomic `seller_submitted`/metering, sheet-edit evidence, Admin audit,
reminder intent/finalization, signed delivery application and webhook retry
behavior, billing writes and retention deletes remain unchanged and strict.
No schema/dependency, deployment setting, live telemetry or production action.
Durable rationale: [auxiliary observation budgets](../.ai/decisions/2026-10-13-auxiliary-observation-budgets.md).

## Seller diagnostic observations (Slice 5)

The seller wizard reports a small, request-correlated funnel through
`POST /api/seller/[token]/observations`. It is separate from, and must not be
added to, the aggregate Vercel browser events. Contract:
`lib/telemetry/seller-observations.ts` and `sellerObservationBodySchema`.

| Event | Fields besides the envelope |
| --- | --- |
| `seller_step_viewed` | step, utility category or handoff section, navigation mode, first/revisit |
| `seller_step_completed` | step, category or section, navigation mode, duration bucket |
| `seller_submission_attempted` | attempt number (1–50) |
| `seller_submission_failed` | attempt number, error code, HTTP status (400–599) when there was a response, duration bucket |
| `seller_suggestions_rendered` | category, `initial` or `search`, result count (0–50), empty reason, duration bucket |
| `seller_suggestions_failed` | category, `initial` or `search`, error code, HTTP status, duration bucket |

Stored envelope: schema version, `actor: seller_browser`, `mode` (`live` or
`test`, from the request's test-drive flag on the server), a random tab-session
id, a random event id, a sequence number, the editing session (`edit_version`)
and two coarse labels derived from the User-Agent header (device: mobile,
tablet, desktop, unknown; browser: chrome, safari, firefox, edge, samsung,
other, unknown).

**Never collected:** address, seller or provider names, typed text, search
queries, answers, contact or meter values, which providers were listed or
chosen, raw exceptions or response bodies, URLs or query strings, the seller
link, IP address or the User-Agent header. The schema is strict: a body with
any other key is rejected, so these cannot be added by a caller. The IP and
user-agent columns of `event_logs` are left empty for these rows.

**Authorization and bounds.** The seller link authorizes the write exactly as
it does for submission and suggestions; a packet link or unknown link gets 404.
The link is used only for the lookup and, hashed with the IP, as the limiter
identifier. The limiter (60 batches per 60 seconds) runs before the body is
read and is required in production, so a missing or unavailable limiter
returns 503 and stores nothing. Body limit 8 KB, 10 events per batch, 150
events per browser tab session, 600 stored diagnostic rows per request. A body
that claims an editing session the request has not reached is ignored.

**Failure isolation.** The wizard never awaits an observation and the helper
never throws. The server write is auxiliary: one attempt within the 500 ms
budget described above, and the response is `202 { ok: true }` whether or not
the row was stored. Blocked storage, a blocked or failing endpoint, a rate
limit and being offline are all covered by tests in which the seller still
submits successfully. The public demo and form previews do not report.

**Deduplication and meaning.** A resent batch reuses its event ids and is
stored once. Two simultaneous identical sends can still both insert, so no
reader counts rows. Seller Progress counts each in-progress request once, at
the last step viewed in the tab session heard from most recently, ordered by
that session's sequence. Going back, reloading or a late batch therefore does
not add to, or rewind, the figure. Only reports for the request's current
editing session count; a stale tab from before a reopen is ignored.

**Limits of the evidence.** Reports are advisory. They can be lost (blocked,
offline, tab closed before the 1.5 second send delay, write deadline) and can
be forged by anyone holding the seller link, who could also fill that one
request's row ceiling. A request without a report is unknown, not stuck. The
tab-session id is a pseudonym in `sessionStorage`; it is not identity and does
not follow a seller across devices or browsers. An accepted submission remains
the atomic `seller_submitted` evidence; a reported attempt never counts as one.
The `empty_reason` separates a failed suggestion load (`load_failed`) from a
loaded empty list (`no_suggestions`) and a search without matches
(`no_results`), which the screen itself shows the same way.

No schema, dependency, retention, deployment or production change. Rows are
removed with their request. The account export lists event types and times
only, so these types appear there without payloads. Durable rationale:
[seller diagnostic observations](../.ai/decisions/2026-10-13-seller-diagnostic-observations.md).

## Email handoff and PDF execution evidence (Slice 6)

Completion emails, seller invitations and sheet PDFs leave a small server-side
record. Contract: `lib/telemetry/handoff-evidence.ts`. Storage:
`notification_observations` and `pdf_render_observations`
(`migrations-handoff-evidence.sql`). Decision:
`.ai/decisions/2026-10-13-handoff-notification-evidence.md`.

| Record | Fields |
| --- | --- |
| Notification, one per recipient slot | random operation id, request id, purpose (`completion_notification`, `request_invitation`), live/test, slot number, intended recipient count, send outcome (`accepted`, `failed`, `unknown`, `no_recipients`), provider message id, coarse failure code, attachment status, provider delivery status and its time |
| PDF render | request id, operation id and slot for attachments, surface (`download`, `completion_attachment`), live/test, packet mode, render and launch strategy, outcome, expected skip reason, failed stage, error class name, coarse HTTP status for downloads, total/data/launch/render milliseconds, byte size |

Never stored: email addresses, recipient or seller names, property address,
seller or packet links, filenames, subject, HTML, answers, raw provider errors
or exception messages. Recipients are positions within one send. The provider
message id is used only to match signed delivery callbacks and is not shown
in Admin. Failure codes and error names must look like identifiers
(`^[A-Za-z0-9_]+$`) or they are replaced or dropped.

Rules:

- Evidence is recorded only after a request is resolved. An unknown link, a
  rate-limited download and a lookup that failed before resolving store no
  row.
- Writes go through `writeAuxiliary` (one attempt, 500 ms, no retry). A
  failure logs one redacted `auxiliary_write_failed` marker with
  `observation: handoff_evidence` and changes no send, download or submission.
- 200 notification rows and 300 PDF rows per request; past that nothing more
  is stored for the request. Rows are deleted with the request. There is no
  time-based pruning yet (Slice 9).
- Accepted means the provider took the message. Delivered is the provider's
  report. Neither proves a person read it. A missing record is unknown.
- Seller reminders are unchanged and stay in `reminder_operations`.
