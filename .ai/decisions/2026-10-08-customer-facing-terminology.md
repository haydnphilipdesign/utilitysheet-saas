# Customer-facing terminology and voice

Date: 2026-10-08. Made during the product copy audit
(`.ai/plans/2026-10-08-product-copy-audit.md`), which the owner asked for in
chat. The owner delegated routine editorial decisions; the points marked "open"
below are for the owner.

## Context

The same thing had several names across the product: the finished document was
an "info sheet", a "packet", a "utility sheet" and a "UtilitySheet"; the plan
was "Team" and "Teams"; a form's link had a "Link ending"; errors read "Failed
to …". Non-technical customers (transaction coordinators, agents, sellers and
whoever receives a sheet) could not tell whether two words meant two things.

## Decision

One concept, one name, in everything a customer reads.

| Concept | Say | Do not say |
| --- | --- | --- |
| Plans | Free, Pro, Teams | Team plan, "Pro and Team" |
| Shared account space | workspace (people: your team, teammates) | organization |
| What you send for one property | request | intake |
| A request the seller completed | submitted sheet (what Free counts) | live file, "requests" as the Free limit |
| The finished document | utility sheet, then "sheet"; "PDF" for the file | info sheet, packet (generic) |
| The public page for a sheet | sheet link | packet link |
| The two kinds of sheet | sheet type: Simple Utility Sheet, Property Handoff Packet | packet mode, mode |
| Optional groups of handoff questions | handoff sections | modules |
| Named set of questions with a link | seller form | saved form, configuration |
| Link to a seller form | reusable seller link, then "seller link" | intake link |
| Link that opens the default form | main link; its editable part is the link name | base link |
| Last part of one form's link | "the end of the link"; field label "Form link" | link ending, suffix, slug |
| Pause and bring back a form | pause, resume | reactivate |
| How many forms a plan allows | limit | allowance |
| Branding | Branding Profile, then "profile" | brand profile |
| {{link}} and similar | placeholder | variable, token |
| Built-in message wording | standard wording | default template |
| Who the seller deals with | the Branding Profile name, or "your real estate team" | your agent |
| Who filled in the form | the seller | homeowner |

Voice:

- Errors say what happened and what to do: "We couldn't … Try again." Never
  "Failed to …", "Error …", "Invalid …" or "Rate limit exceeded" to a person.
- Success messages are short ("Profile saved").
- No em dashes in prose. A lone dash standing for an empty value is fine.
- Sentence case for new and changed labels.
- No developer words (configuration, payload, fallback, engine, changelog).

## Boundaries

- Internal identifiers, API field names, routes and stored values keep their
  names (`packet_mode`, `intake_links`, `/packet/`, `FORM_ALLOWANCE_REACHED`).
- API `error` strings that a client matches on, or that tests assert as a
  contract, are codes and are not reworded. Prose belongs in `message` and in
  client fallbacks.
- The printed document title stays "Utility Info Sheet".
- Admin keeps operator terms (entitlement, cohort, "Team" as the stored
  entitlement value). Admin uses the customer's word when it names something a
  customer sees (sheet, sheet type, handoff sections).
- Storage and release documents keep "ending" and "base".

## Deliberately kept

- Buttons named in a published product update keep their casing: "Reopen for
  Seller", "Close Without Changes".
- Section names printed on the sheet keep title case ("Home Basics").
- "Unable to …" messages on Seller forms were reviewed on 2026-10-07 and are
  clear; they were not reworded only to match "We couldn't …".
- Marketing still says "Property Handoff Packet mode" and "completion email".
- The subject of the submission email ("Utility Info Submitted for …") is
  unchanged, because customers may filter their inbox on it.

## Open for the owner

- Settled 2026-10-08 (owner, in chat): the pricing card's "Starter" is renamed
  "Free". Its price line shows "$0" so the card does not read "Free, Free". The
  button's test ID and analytics ID follow the name (`pricing-free-cta`,
  `secondary_pricing_free_cta`), so earlier `..._starter_cta` click counts stop
  there.
- PRD.md still says "info sheet" throughout. It is a product-intent document and
  was not reworded.

## Consequences

Seller request and reminder emails now fall back to "Your real estate team"
instead of "Your agent" and their footer no longer uses an em dash. A reminder
whose outcome is still `pending` or `unknown` when this ships cannot be retried
as the same operation (its fingerprint no longer matches); it fails closed and
is settled in Admin, as the reminder decision already provides.
