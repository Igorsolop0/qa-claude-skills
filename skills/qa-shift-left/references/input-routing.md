# Input Routing

Step 0. Decide what kind of work you are planning for, then follow the matching mode.

## Routing table

| Input | Mode | Budget | Action |
| --- | --- | --- | --- |
| Issue of type feature or task, with acceptance criteria | AC-first | live-spec limit applies | Full Burger pass over the ACs |
| Issue of type bug | codebase-first | relaxed | [bug-mode.md](bug-mode.md): expected vs actual, RED / GREEN / REGRESSION |
| Issue of type task, backend or tooling only | AC-first, relaxed | no live specs | Analyze description; skip UI levels |
| Spec or change document (design doc, PRD, ADR-style change folder) | spec-first | live-spec limit applies | Its requirements and scenarios are the ACs |
| Issue of type epic | exit | — | "Epic is not supported — split into features or tasks first." |
| Issue of type research or spike | exit (soft) | — | Emit the outcome-validation checklist below |
| Pasted requirements | AC-first | live-spec limit applies | `source_mode: "pasted_text"`; state what context is missing |
| Sub-issue with a parent | parent-scoped | inherit | Read the parent for the full picture, scope scenarios to this delta only |

Issue types depend on the tracker. Map your tracker's types onto the rows above; if it has none, infer
the type from labels and the description.

## Reading the input

GitHub issue:

```bash
gh issue view <N> --repo <org>/<repo> --json number,title,body,labels,comments
```

Spec or change document: read the whole document or folder — the rationale and scope, the
requirements and their scenarios, and any existing test plan or cases next to it.

When both exist (an issue that points at a spec), the spec wins as the source of requirements, and the
issue supplies scope, priority, and decisions from its comments.

## Epic exit message

```
#<N> is an epic — qa-shift-left does not run on epics.
Epics are planning units. Run this skill on the individual features or tasks under it.
```

## Research exit message

```
#<N> is research — research produces a decision, not testable behavior.
QA scope: verify the deliverable answers the question.

Objective: {objective}
Expected deliverable: {recommendation / prototype / decision record}

Validation checklist:
- [ ] Deliverable exists and matches the stated objective
- [ ] The decision is documented with its rationale
- [ ] Open risks and unknowns are listed
- [ ] Follow-up features or tasks are identified
```

## Parent-scoped mode

When the issue is a sub-issue of another:

1. Read the parent for the full feature picture.
2. Extract the **delta**: what does this issue add that the parent does not already cover?
3. Scope every scenario to that delta. Do not copy the parent's full AC list.
4. Record in `assumptions[]`: "Scoped to the sub-issue delta; full coverage lives in the parent plan."
5. Budget: inherit the parent's plan, and expect no live specs for a backend-only slice.

## Variant scope

Every plan names its scope: a specific variant (tenant, locale, platform, customer) or `all variants`.
Routes, capabilities, and copy can differ per variant — never assume a scenario transfers. A case that
intentionally covers several variants says so explicitly.
