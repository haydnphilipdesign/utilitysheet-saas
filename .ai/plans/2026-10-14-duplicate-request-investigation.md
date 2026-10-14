# Duplicate requests at one address

- Date: 2026-10-14. Agent: Codex. Status: Completed (investigation only). No required work remains.
- Scope: explain available admin evidence and investigate the property/account pair supplied in the screenshot. No application change, production writes, migrations, external sends, commit, push or deployment.
- Verified: dashboard creation records `request_created` with `actor=agent`; reusable intake creation uses `actor=seller, source=intake_link`. Intake resume requires a matching form/address browser cookie; opening a seller link changes draft/sent to In Progress.
- Approach: trace creation/resume and admin event history; perform scoped Neon queries in an explicitly read-only transaction, returning timestamps, allowlisted event fields and anonymous comparison results only; explain facts versus unknowns.
- Acceptance: establish creation channel/timing for both rows when retained evidence permits; document which admin pages expose evidence and limits on identifying the person/restart cause.
- Validation: source inspection and read-only database evidence. No runtime changes requiring tests.
- Ownership: only this plan and an additive `.ai/CURRENT.md` investigation section. Preserve existing unfinished monitoring edits and unrelated starter document.

## Outcome

- The screenshot's pair was verified using two explicitly read-only Neon transactions; the first also verified `transaction_read_only=on`. Output omitted record/account/form ids, tokens, contact details, answers, raw IPs and raw browser headers. No customer data copied into a diagnostic file.
- Both creation events have `actor=seller, source=intake_link`; same owner, workspace and source form. The first started 2026-10-13 at 23:29:50 America/New_York, iPhone/iPod Safari, last browser-reported step Home Basics, still In Progress, no retained submission event. The second started at 23:45:35, Mac Chrome, and submitted at 23:50:25. Both edit versions are zero. Creation IP and browser header differ (only comparison booleans/coarse families returned).
- Consistent with switching devices and starting afresh; cannot establish same person or their reason. Same-form browser cookie resumes an unfinished request; cross-browser/device intake starts create independently. Partial answers are browser-local until submission, so missing stored entries do not prove no answers.
- Existing Admin request detail > Technical event history exposes creation source/actor, opens, browser steps and submission events; Admin > Seller Progress summarizes unfinished requests. Browser reports are best effort; their absence does not establish no activity/error. No automatic duplicate linkage or resume-failure explanation was found in the examined flow.
- Validation: traced actual creation/resume/status/browser-draft/admin readers; scoped live evidence above. No application changes, so no application tests needed. Only coordination documentation changed; existing monitoring edits preserved.
- Optional future work: clearer creation-source/device summaries and related same-address requests in Admin. Requires a separate implementation request. Do not globally resume by address without preserving capability boundaries.
