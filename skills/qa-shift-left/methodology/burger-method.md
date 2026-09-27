# Burger Test Design Method

A layered approach to analysis and test design. Walk the layers in order — never jump ahead to a
scenario list. The layers are the method; the scenario matrix is only its output.

## Layer order (mandatory)

0. Memory check
1. Feature container (framing)
2. Testing types
3. Design techniques
4. Principles and risk prioritization
5. Scenario set

## 0. Memory check

Before designing anything, look for prior knowledge:

- Similar changes already analyzed (`openspec/changes/**`, archived changes, past test plans)
- Known weak spots in this area (`.agents/retros/**`, open issues)
- Known flaky or unstable behavior in `qa/tests/**`
- Reusable builders, Zod schemas, fixtures, helpers, access profiles
- Prior bugs that should shape the plan

Output:

```
Memory relevant to this change:
- Similar work: ...
- Known risks/patterns: ...
- Existing coverage: ...
- Reusable assets: ...
- Nothing relevant found (when this area is new)
```

## 1. Feature container

Define the testable behavior in operational terms:

- What changes (the functional delta)
- Who is affected (access profiles, brands)
- What the expected behavior is
- Dependencies (BFF, gateway, CMS, upstream services, feature flags, seed data)
- What is still unclear (assumptions or unknowns)

Output:

```
Feature summary: ...
Brand scope: brand-a | brand-b | cross-brand
Known requirements: ...
Constraints and dependencies: ...
Unknowns / assumptions needed: ...
Affected access profiles: ...
```

## 2. Testing types

Pick the types deliberately — see [testing-types.md](testing-types.md) for the theory
(black box / white box / grey box, functional vs non-functional, positive vs negative).

Default scope for ordinary work: functional, black box, positive and negative.
Do not auto-expand into security, performance, or accessibility unless the change or the requester
asks for it — but do say out loud that you excluded them.

Output:

```
Selected testing types:
- Functional, black box: ...
- White box (unit level): ...
- Explicitly excluded: performance, security — reason: ...
```

## 3. Design techniques

Pick techniques that fit the shape of the feature and state what slice each one cuts.
Catalogue with worked examples: [design-techniques.md](design-techniques.md).

Rule: never list a technique for decoration. "Boundary value analysis" with no named boundary is noise.

## 4. Principles and risk prioritization

Output:

- Principles applied: risk-based testing, no exhaustive testing, defect clustering, early testing,
  pesticide paradox, absence-of-errors fallacy
- Top risks: money loss, bonus or balance correctness, auth and session, licensing and compliance,
  player-visible breakage on the critical path, data leakage, cross-brand regressions
- Prioritization: what is tested first, what can be deferred

## 5. Scenario set

Generate scenarios only after layers 0–4 exist.

Each scenario carries:

- Linked AC (or behavior) reference
- Testing type (positive / negative / boundary / edge / exploratory)
- Technique origin (which technique produced it)
- Risk it covers
- Recommended level (unit / component / api / e2e-live / openspec-mock)
- Priority (must / should / could)
- Affected access profiles and brand
- Expected evidence (assertion, response field, selector, log line)

Keep the matrix focused: typically 5–15 scenarios. The range is a guide, not a cap. In-spec scenarios of an
OpenSpec change are never merged or dropped to fit it; only scenarios you invent beyond the spec count as a smell.

## Ambiguity rule

If requirements are unclear:

1. State the ambiguity explicitly.
2. Ask one focused question, or record an explicit assumption.
3. Continue only on declared assumptions, or return `needs_refinement` / `blocked`.

No hidden assumptions. Ever.
