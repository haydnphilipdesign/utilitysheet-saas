# Request-specific seller question choices

- Accepted 2026-10-02. Owner authorized adding missing creation controls.
- Context: HOA and electric meter questions currently follow live account
  preferences, while other creation choices are saved per request.
- Decision: individual creation exposes both switches with account defaults,
  saved as explicit request booleans. Nullable stored values mean inherit the
  current request owner's account preferences, defaulting on when absent.
- Rationale: users can tailor a listing without changing other sellers' forms;
  choices remain stable after later changes to account settings.
- Consequences: existing requests, reusable intake, test-drive and older clients
  continue inheriting unless they explicitly supply overrides. Both seller GET
  and POST must resolve the same values. Existing collected answers still print
  and remain editable. Controls are free and independent of packet mode.
- Alternative rejected: updating account preferences from creation would also
  change unrelated sent requests. No per-detail HOA switches in this scope.
