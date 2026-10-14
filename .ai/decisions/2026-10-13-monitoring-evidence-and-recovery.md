# Monitoring evidence and recovery semantics

- Date: 2026-10-13. Status: adopted locally for telemetry Slice 7; hosted configuration unverified. Scope: Admin Operations and ops-monitor, no schema or schedule change.
- Context: source already schedules three daily jobs plus a 15-minute monitor. The heartbeat reader omitted the monitor; missing AI reads could be treated as healthy empty coverage. Retained observations cannot establish collection completeness.
- Decision: monitor overdue is 15-minute interval plus 15-minute grace (30 minutes); the daily override remains separate. Never observed stays unknown. Running for more than 15 minutes is a missing-finish/stuck label, which takes precedence over overdue; last recorded outcome remains visible. This is advisory evidence, not proof the process is still executing. Admin reads the current monitor start; monitor alert evaluation excludes its own start so it observes the previous outcome.
- Coverage: show last retained timestamps for relevant collectors, with no collection-rate denominator. AI read unavailable or health-observation writes unsuccessful makes the monitor partial. Empty/unavailable evidence and currently running jobs do not establish recovery. Failed/partial job conditions require successful completion to recover; a stuck condition can clear after a recorded finish. AI thresholds and outcomes remain unchanged; no live model probe.
- Notification uncertainty: provider acceptance increments accepted/sent even if alert-state persistence fails. That failure is separately counted and marks the run partial; another evaluation may repeat the notification. Existing episode state stays unchanged until a successful state write. No generalized retry or stronger delivery guarantee is introduced.
- Alternatives: treating missing reads as zero and a newly started monitor as healthy would hide monitoring failures; applying the daily threshold to the monitor would delay detection by roughly a day. An external service is not selected or configured here.
- Consequences: database-stored heartbeat and DB/email alerting cannot detect/notify through total DB/site failure. Independent readiness/heartbeat monitoring, destination/responder confirmation, test alert and pruning remain unverified owner-approved external work. Retention can remove the prior baseline, returning it to unknown.

## Amendment 2026-10-14: monitor grace raised to 20 minutes

The monitor's overdue window is now 15-minute interval plus 20-minute grace (35
minutes). With 30 minutes, one missed run left a gap of almost exactly 30
minutes, so cron timing jitter decided whether it alerted; on 2026-10-14 a gap
of 30 minutes 1 second sent "Needs attention" and the next run sent
"Recovered". Because the monitor reports on itself, a single-miss alert can
only arrive after it is already running again, so it is never actionable. Now
one missed run stays quiet and two in a row (about 45 minutes) alert. Cost:
detection of a stalled monitor is about 5 minutes later. A fully stopped
monitor still cannot alert; that remains external heartbeat work.
