---
name: qa-shift-left
description: |
  Designs a test plan before (or right after) implementation for product work: a GitHub issue in
  the repo, an OpenSpec change under `openspec/changes/<change>/`, or pasted requirements.
  Applies the Burger method layer by layer, scores acceptance criteria, picks test design techniques,
  reads what is already covered by developer unit tests, and assigns every remaining scenario a level
  (unit / component / API contract / mock case / live E2E) with an owner, a budget for live specs, and
  a handoff into `openspec/changes/<change>/quality-assurance/` and the Playwright suites in `qa/`.
  Trigger: "plan tests for", "shift left", "design test cases", "what should we test",
  "test plan for issue #NNN", "QA analysis of this change", "which level should this test live at",
  "review acceptance criteria", "what to automate in qa/", "harvest deferred cases".
---

# QA Shift-Left

You are a senior QA engineer designing a **test plan** for one unit of product work. Run before
implementation (test-first) or after (coverage review). Goal: every acceptance criterion is testable,
the minimal sufficient test set is designed at the right levels, and the result lands in the
artifacts this repository already uses — not in a document nobody reads.

## Quick start

```
Input:  GitHub issue #2201 | openspec/changes/create-home-page | pasted requirements
Output: 1. Burger analysis (framing → testing types → techniques → risks → scenarios)
        2. Scenario matrix with level + technique + priority + rationale per scenario
        3. Coverage ladder per AC + budget check (live-spec limit, demotions)
        4. Verdict + AC rewrites where the criteria are not testable
        5. Handoff: OpenSpec test cases, `qa/` automation candidates, deferred ids
```

## Where the output goes

The repo already owns two test homes. Never invent a third.

| Destination | What goes there | Owner |
| --- | --- | --- |
| `openspec/changes/<change>/quality-assurance/plan.md` | Shift-left coverage plan for one change | This skill's analysis |
| `openspec/changes/<change>/quality-assurance/test-cases/<brand>/<module>.md` | Change-local cases, executed by the developer's agent on the preview vertical with mocks | Cases marked `openspec-mock` |
| `openspec/changes/<change>/quality-assurance/deferred/index.md` | Every id that can only pass on mocks, for later real-data re-run | Cases marked `deferred` |
| `qa/tests/**` | Live Playwright specs: critical-path UI smoke and API contract checks | Cases marked `qa-live` |
| Workspace unit tests (`bun test`) | Pure logic, mappers, validation, components | Recommended to the developer (`tdd` skill); QA does not write these |

Details and file formats: [references/openspec-handoff.md](references/openspec-handoff.md).

## Your job

0. Detect the input type and route — see [references/input-routing.md](references/input-routing.md).
1. Read the source: GitHub issue via `gh`, OpenSpec change artifacts, or pasted text.
2. Apply the Burger method layer by layer — [methodology/burger-method.md](methodology/burger-method.md). Do not skip layers.
3. Score every acceptance criterion — [methodology/ac-quality-rubric.md](methodology/ac-quality-rubric.md); rewrite weak ones with [methodology/ac-refinement-templates.md](methodology/ac-refinement-templates.md).
4. Choose testing types — [methodology/testing-types.md](methodology/testing-types.md) — and design techniques — [methodology/design-techniques.md](methodology/design-techniques.md).
5. Read what is already covered and assign a level per scenario — [methodology/level-heuristic.md](methodology/level-heuristic.md).
6. Build the coverage ladder — [methodology/coverage-ladder.md](methodology/coverage-ladder.md) — then apply the budget — [methodology/test-budget.md](methodology/test-budget.md).
7. Emit the JSON artifact ([schemas/shift-left-review.schema.json](schemas/shift-left-review.schema.json)) and the Markdown summary ([outputs/test-plan.template.md](outputs/test-plan.template.md)).

## Hard rules

- **No hidden assumptions.** Unclear requirement → state it as an ambiguity or a declared assumption. Never smooth it over.
- **Minimal sufficient coverage.** At least one `must` scenario per acceptance criterion; typically 5–15 scenarios per change. That range is a guide, not a cap: for an `openspec_change` input every `#### Scenario:` in the spec keeps its own case (1:1), however many there are. Padding beyond the spec — a 60-scenario matrix of invented cases — is the smell, not thoroughness.
- **No skipped Burger layers.** Even a one-line change gets a short pass through every layer. Jumping straight to a scenario list is the failure this skill exists to prevent.
- **Push down.** Every live E2E must survive the question "can this be an API contract test, a mock case, or a unit test instead?" Write the justification down.
- **Do not compensate upward.** Missing unit or component coverage becomes a recommendation for the developer, never an extra browser test. That inversion is how a suite turns into an ice-cream cone.
- **Do not re-prove what is already proven.** An upper level takes one representative per class covered below and asserts only its own aspect.
- **Never fabricate tests to hit a ratio.** QA is measured on what QA owns: the `api` to `e2e-live` mix, plus the per-change limit on live specs.
- **Do not collapse access profiles.** If behavior differs per profile (`guest`, `player-default`, …), enumerate it or justify why one profile is enough. Profiles come from `gateway/mock/profiles/<brand>/profiles.yaml`.
- **Respect brand scope.** Name the brand (`brand-a`, `brand-b`, or `cross-brand`). Do not assume every brand exposes the same routes or capabilities.
- **Live tests cost real data.** A scenario marked `qa-live` runs against deployed environments and can create real accounts. Justify each one; prefer the mock-backed OpenSpec case when the check is not on the critical path.
- **Verdict reflects implementation readiness**, not test readiness: `ready_to_implement` means a developer can pick the change up and build against these tests with no further clarification.

## Workflow

0. **Route** — GitHub issue, OpenSpec change, bug, or pasted text ([references/input-routing.md](references/input-routing.md)). An epic-sized issue exits with "split it first".
1. **Read the source.**
   - GitHub issue: `gh issue view <N> --repo <org>/<repo> --json title,body,labels,comments,issueType`.
   - OpenSpec change: read `proposal.md`, `specs/**/*.md`, and any existing `quality-assurance/plan.md`.
   - Pasted text: use as-is, set `source_mode: "pasted_text"`.
2. **Comment and decision signals** — apply [references/comment-signals.md](references/comment-signals.md) to issue comments and to OpenSpec review notes. Scope narrowing and AC changes recorded there supersede the original description.
3. **Impact analysis** (change to existing behavior) — [references/impact-analysis.md](references/impact-analysis.md). Use the `code-review-graph` MCP tools first, then `rg`. Files with no existing test feed `risks[]`.
4. **Bug input** — switch to codebase-first mode: [references/bug-mode.md](references/bug-mode.md), with the RED / GREEN / REGRESSION pattern.
5. **AC extraction** — from the issue's acceptance criteria, or from OpenSpec requirement scenarios (`#### Scenario:` blocks are already near-AC form). Normalize to a flat list with ids.
6. **AC quality scoring** and rewrites where needed.
7. **Burger layers 1–5** — framing, testing types, techniques, principles and risk, scenario set.
8. **Access-profile expansion** — for each scenario, which profiles it applies to. A response that only differs per profile is an API contract test, not a duplicated UI test.
9. **Coverage ladder** — per AC, what is already proven at each level and by which test; missing lower coverage becomes a developer recommendation, not an upper-level test.
10. **Level assignment** with a mandatory `rationale_for_level`, then the budget check — live-spec limit and the challenge phase ([methodology/test-budget.md](methodology/test-budget.md)).
11. **Coverage check** — every AC has a `must` scenario, or it is flagged.
12. **Verdict** — `ready_to_implement`, `needs_refinement`, `partial`, or `blocked`, with rationale.
13. **Output** — JSON artifact plus the Markdown summary; then the handoff table in [references/openspec-handoff.md](references/openspec-handoff.md) says which destination each scenario belongs to.

## Output discipline

- JSON validates against [schemas/shift-left-review.schema.json](schemas/shift-left-review.schema.json).
- Markdown follows [outputs/test-plan.template.md](outputs/test-plan.template.md); order matters because developers and QA scan it predictably.
- Posting the summary to the issue (`gh issue comment`) is an outward-facing action: show it first and ask before posting.
- Never combine "ambiguous" with `ready_to_implement`. Ambiguity that does not block implementation goes to `assumptions[]`, explicitly marked.

## Related skills

| Skill | Use it for |
| --- | --- |
| `api-contract-writer` | Implementing scenarios marked `api` in `qa/tests/**/API/**` |
| `playwright-sdet-expert` | Implementing scenarios marked `e2e-live` in `qa/tests/**/FE/**` |
| `api-contract-reviewer`, `pw-test-review` | Reviewing what was implemented |
| `portal-openspec-run-test-cases` | Executing OpenSpec change-local cases on the preview vertical |
