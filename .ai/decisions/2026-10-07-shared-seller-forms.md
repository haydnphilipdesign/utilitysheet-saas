# Seller forms can be shared with a Teams workspace

Date: 2026-10-07. Status: Accepted as product rules (owner decision in chat on 2026-10-07, on the recommendations in `.ai/plans/2026-10-07-teams-plan-review.md`, slice 11). Not implemented yet: no schema, API or screen exists for this. The implementation plan is still to be written and must be grounded in the current seller-form code before any change. Builds on `.ai/decisions/2026-10-06-shared-seller-form-url-identity.md` and `.ai/decisions/2026-08-27-team-billing-ownership-and-workspace-isolation.md`.

## Context

In a Teams workspace, requests and Branding Profiles are shared, but a seller form belongs to the person who created it. Nobody else can use or edit it, and its link stops accepting sellers when that person is no longer a member of the workspace (`validate_request_source_form` in `schema.sql`). A team cannot have one form that everyone uses, and a departing coordinator takes a link that may be embedded in the team's email templates. The pricing pages used to promise workspace-wide defaults that did not exist; that claim was removed in slice 6.

## Decision

1. **A form can be shared with its workspace.** A shared form can be used by every member: they can copy its link and create requests from it. A form that is not shared stays personal, as today.
2. **Only the form's creator and workspace admins can change a shared form.** That covers editing its questions and settings, pausing, resuming, renaming its link, and deleting it. Other members use it as it is.
3. **A shared form outlives its creator's membership.** When the creator leaves or is removed, the shared form stays with the workspace, is handed to an admin the same way requests and Branding Profiles are (`removeOrganizationMemberWithHandover`, slice 10), and its link keeps working. A personal form is unchanged: it stays its creator's and stops working, as today.
4. **Shared forms count against the workspace, not a person.** The allowance for shared forms is the workspace's total (members times the per-member allowance), so sharing a form never uses up the creator's own allowance. Personal forms keep counting per member as today.
5. **Submissions from a shared form go to the request's owner**, who for a seller arriving through a shared link is the form's current owner, plus workspace admins when the existing "notify admins of all team submissions" setting is on. No new notification setting.

## Alternatives considered

- Every form in a Teams workspace is shared automatically: rejected, it would expose and hand over personal forms that members did not choose to share, and change existing forms' behavior without anyone asking.
- Any member can edit a shared form: rejected, one person's change would silently alter what every teammate's sellers are asked.
- A shared form stops working when its creator leaves, like a personal one: rejected, a team link embedded in templates must not depend on one person staying.

## Consequences

- Needs a schema change (how a form is marked shared, and the rules in the form writer, the allowance function and the request-source check) and changes what admins and members can do. Each is confirmed with the owner when its migration and behavior are concrete.
- The member-removal hand-over from slice 10 must be extended to move shared forms before the membership row is deleted, or their links would stop working.
- The marketing pages may say that seller forms can be shared only after this ships.
- Open, to settle in the implementation plan: whether sharing can be undone once other members' requests use the form; who a shared form is handed to when an admin is its creator and leaves; whether a Free or Pro workspace with several members gets sharing or only Teams (assumed Teams only). Settled in the amendment below.

## Amendment (2026-10-07): open points settled, storage boundary, form delete

Owner confirmed in chat on 2026-10-07, on `.ai/plans/2026-10-07-shared-seller-forms.md`. Not implemented yet.

- **Undoing sharing** is allowed while the form's creator is still a member; the form becomes the creator's personal form again. Existing requests are unaffected. Refused once the creator has left, or when the creator's personal allowance is full.
- **Hand-over recipient** is the same admin who receives the leaving person's requests and Branding Profiles (named admin, else the removing admin, else the longest-standing other admin), also when the creator is an admin.
- **Teams only.** Sharing needs the workspace to be on Teams at that moment. Forms already shared keep working if Teams stops.
- **A shared form keeps its creator and its address.** `intake_links.account_id` stays the creator and the owner of the link name; a new nullable `shared_owner_account_id` marks the form shared and names the member who receives requests from its public link. Hand-over and account closure change only that column. Only the creator renames their main link name or chooses their default; admins may rename a shared form's ending. Referral credit through the link name stays with the creator. Rejected: moving `account_id` to the receiving admin (breaks published links, collides with per-person default and referral-identity uniqueness, moves referral credit); a workspace-level link name (changes the address when a form is shared).
- **Seller forms can be deleted, on every plan** (owner request, replacing the earlier "no hard delete"). Deleting hides the form everywhere and stops its links, but keeps the row (`deleted_at`) so its link name, endings and any referral code stay reserved, consistent with `.ai/decisions/2026-10-06-shared-seller-form-url-identity.md`. The default form cannot be deleted. Requests made from the form are unchanged. A shared form may be deleted by its creator, its current owner or an admin. No undo in the product. Rejected: removing the row, which would free published names and delete sibling links.
- **Deleting a form releases its link endings** (owner decision in chat on 2026-10-07, after seeing the first design, which kept them reserved forever: "this could suck if the user wants to assign a link to a different form"). The deleted form's endings, current and earlier, are removed, so another form under the same link name can take one, and a link shared earlier with that ending then opens that form. This is the one exception to "published endings are permanent" in `.ai/decisions/2026-10-06-shared-seller-form-url-identity.md`; rename and pause still keep every ending bound. Only forms of the same creator and workspace can take a released ending, because endings live under that creator's link name. The form's flat link name and referral code stay bound to its hidden row, and the main link name is unaffected.
