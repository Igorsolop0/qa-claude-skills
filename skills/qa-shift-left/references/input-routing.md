# Input Routing

Step 0. Decide what kind of work you are planning for, then follow the matching mode.

## Routing table

| Input | Mode | Budget | Action |
| --- | --- | --- | --- |
| GitHub issue, type `Feature` or `Task`, with acceptance criteria | AC-first | live-spec limit applies | Full Burger pass over the ACs |
| GitHub issue, type `Bug` | codebase-first | relaxed | [bug-mode.md](bug-mode.md): expected vs actual, RED / GREEN / REGRESSION |
| GitHub issue, type `Task`, backend or tooling only | AC-first, relaxed | no live specs | Analyze description; skip UI levels |
| OpenSpec change folder | spec-first | live-spec limit applies | Requirements and `#### Scenario:` blocks are the ACs |
| GitHub issue, type `Epic` | exit | — | "Epic is not supported — split into Features or Tasks first." |
| GitHub issue, type `Research` | exit (soft) | — | Emit the outcome-validation checklist below |
| Pasted requirements | AC-first | live-spec limit applies | `source_mode: "pasted_text"`; state what context is missing |
| Sub-issue with a parent | parent-scoped | inherit | Read the parent for the full picture, scope scenarios to this delta only |

Issue types on this board are `Task`, `Bug`, `Feature`, `Epic`, `Research`
(`docs/organizational/github-labels-and-project-workflow.md`).

## Reading the input

GitHub issue:

```bash
gh issue view <N> --repo <org>/<repo> --json number,title,body,labels,comments,issueType,parent
```

OpenSpec change:

```
openspec/changes/<change>/proposal.md          # why, scope, brands
openspec/changes/<change>/specs/**/*.md        # requirements and #### Scenario: blocks
openspec/changes/<change>/quality-assurance/   # existing plan and cases, if any
```

When both exist (an issue that points at an OpenSpec change), the OpenSpec specs win as the source of
requirements, and the issue supplies scope, priority, and decisions from its comments.

## Epic exit message

```
#<N> is an Epic — qa-shift-left does not run on Epics.
Epics are planning units. Run this skill on the individual Features or Tasks under it.
```

## Research exit message

```
#<N> is Research — research produces a decision, not testable behavior.
QA scope: verify the deliverable answers the question.

Objective: {objective}
Expected deliverable: {recommendation / prototype / decision record}

Validation checklist:
- [ ] Deliverable exists and matches the stated objective
- [ ] The decision is documented with its rationale
- [ ] Open risks and unknowns are listed
- [ ] Follow-up Features or Tasks are identified
```

## Parent-scoped mode

When the issue is a sub-issue of another:

1. Read the parent for the full feature picture (`--json parent`, then view the parent).
2. Extract the **delta**: what does this issue add that the parent does not already cover?
3. Scope every scenario to that delta. Do not copy the parent's full AC list.
4. Record in `assumptions[]`: "Scoped to the sub-issue delta; full coverage lives in the parent plan."
5. Budget: inherit the parent's plan, and expect no live specs for a backend-only slice.

## Brand scope

Every plan names its brand scope: `brand-a`, `brand-b`, or `cross-brand`. Routes, capabilities, and
copy differ per brand — never assume a scenario transfers. A case that intentionally covers several
brands uses the `cross-brand` segment, matching the OpenSpec convention.
