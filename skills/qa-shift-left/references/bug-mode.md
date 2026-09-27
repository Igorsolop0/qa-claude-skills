# Bug Mode

Applies when the input is a bug: a GitHub issue of type `Bug`, or a defect reported in the session.
The feature already exists, so switch from AC-first to codebase-first analysis.

## 1. Codebase analysis (before AC extraction)

Extract code signals from the report: component or service names, function names, file paths, error
messages, endpoint paths, status codes, CMS collection or block names, brand and access profile.

Locate the implementation — graph first, then search:

```bash
rg -n "<functionName>|<endpoint-path>" apps packages gateway --glob '!**/node_modules/**'
rg -l "<ComponentName>" --glob '*.test.ts*' --glob '*.spec.ts'
```

Read the specific function or component being fixed, not the whole file. Then read the existing tests
around it:

- What is already covered → do not duplicate it in the plan
- What is missing near the defect → those are the gaps
- Does a failing test already exist → reference it instead of designing a new RED case

Record in `feature_framing`:

- `what_changes` — the exact function, component, or handler being modified
- `dependencies` — what else that code touches
- Whether the fix is isolated or cross-cutting (several packages, several brands)

## 2. AC extraction for bugs

Bugs rarely carry formal ACs. Priority order:

1. An explicit acceptance-criteria section, if present.
2. Expected vs actual behavior — expected becomes `AC-BUG-1`, actual is what the RED case reproduces.
3. Steps to reproduce — that is the test path; normalize it directly into a scenario.
4. Nothing structured — derive from the title plus comments and mark it as derived.

```
id: "AC-BUG-1"
text: "Given <repro context>, <expected behavior>"
source: "implicit — derived from the Expected behavior section"
```

Apply the same quality rubric. Bugs often fail `measurable` ("it should work properly") — propose a
concrete rewrite.

## 3. Scenario pattern: RED / GREEN / REGRESSION

**RED** — proves the defect exists; fails before the fix.
Reproduces the exact condition; priority `must`; level wherever the defect manifests.

**GREEN** — verifies the fix; passes after it.
Same path, correct expected outcome; priority `must`; usually 1:1 with each AC.

**REGRESSION** — guards adjacent behavior that must not change.
Same function with other inputs, other callers of the changed code, other access profiles or brands;
priority `should`; sourced from the codebase pass, not from imagination.

```json
{ "id": "RED-1", "scenario": "...", "type": "negative", "level": "unit" },
{ "id": "GREEN-1", "scenario": "...", "type": "positive", "level": "unit" },
{ "id": "REG-1", "scenario": "...", "type": "positive", "level": "api" }
```

## 4. Level and budget rules

- No ratio enforcement; the levels follow the defect's nature.
- Rule of thumb: `unit` if the defect is in pure logic, `component` if in rendering, `api` if in a
  contract or persisted state, live only when the defect is user-visible and not catchable lower.
- Set `test_budget.within_limits: true` with the note "Bug mode — levels follow the fix scope".
- Say explicitly when an existing test must be **changed**, not only when a new one must be added:
  a test that passed while the defect existed encoded the wrong expectation.

## 5. Profiles and brands

Identify which access profile and brand reproduce the defect. Add a profile-specific regression
scenario only when the fix can plausibly affect that profile differently. Do not enumerate every
profile for a defect that is specific to one.

## 6. Completeness flag

Do not flag `complete: false` for missing negative cases inherited from code that the fix does not
touch. Flag it only when the AC itself is vague about what counts as fixed.
