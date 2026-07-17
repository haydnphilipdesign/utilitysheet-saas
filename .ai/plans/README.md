# Implementation Plans

Use this directory for implementation-ready plans for substantial, multi-step, cross-cutting, high-risk, hard-to-reverse, or cross-agent work. Tiny, obvious changes do not need a plan.

Recommended filename:

```text
YYYY-MM-DD-short-task-name.md
```

Plans must be grounded in the existing repository, distinguish verified facts from assumptions, define concrete acceptance criteria and validation, identify expected files or areas, and carry an honest current status.

When a task has a plan, the implementing agent must update it when:

- its status changes or implementation begins;
- the approved approach materially changes;
- scope is added or removed;
- an important risk, edge case, or blocker is discovered;
- acceptance criteria or required validation changes;
- the task is completed, superseded, blocked, abandoned, or otherwise stopped.

Do not rewrite the plan merely to make the original proposal appear correct. Document deviations and changed assumptions honestly. If a change affects the live handoff, update both the plan and `.ai/CURRENT.md`.

When a durable decision record is relevant, link it from the plan. At completion, mark the plan `Completed` and retain it as useful task history; completed plans do not replace maintained product or developer documentation and do not need to be deleted.

## Template

```md
# Plan: Task Name

## Status

Draft | Approved | In Progress | Blocked | Completed | Superseded | Abandoned

## Objective

## Background

## In Scope

## Out of Scope

## Relevant Existing Behavior

## Proposed Approach

## Files or Areas Expected to Change

## Data, API, or Schema Impact

## Risks and Edge Cases

## Validation Plan

## Acceptance Criteria

## Handoff Notes
```
