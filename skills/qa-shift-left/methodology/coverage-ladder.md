# Coverage Ladder

Run this after AC scoring and before scenario design. For each acceptance criterion, walk the levels
bottom-up, record what is already proven, and design only what is still missing — at the level that
answers a question the lower levels cannot.

## Each level answers a different question

Take one behavior: "an invalid password is rejected".

| Level | Question it answers | What it asserts | How many cases |
| --- | --- | --- | --- |
| `unit` | Does the logic pick the right outcome? | The validator returns `PASSWORD_TOO_SHORT` for 5 chars, accepts 6, accepts 20, rejects 21 | Every partition and boundary |
| `component` | Does the UI render that outcome? | The field shows the message text and `aria-invalid`, the submit stays disabled | One representative per visual state |
| `api` | Does the contract expose it correctly? | HTTP 400, `ProblemDetails` envelope, `title` carries the machine code, `traceId` present | One representative per class, plus negative auth cases |
| `openspec-mock` | Does the flow behave in the assembled app? | With mock profile `guest`, submitting an invalid password keeps the player on the form and surfaces the error | One per profile that differs |
| `e2e-live` | Does a human see it on the deployed build? | The Spanish copy is visible next to the field, styled as an error, and the account was not created | One, and only on the critical path |

The rule that follows: **an upper level takes one representative from each class already proven
below.** If the unit test already walked eight invalid inputs, the API test takes one and the live
test takes zero or one.

## The inversion (the important half)

If the lower level has **no** coverage, do not compensate above.

- Covered below → the upper level asserts only its own aspect (contract shape, human visibility).
- Not covered below → emit a recommendation for the owner of that level, not an extra live test.

Compensating upward is exactly how a suite turns into an ice-cream cone: browser tests slowly take
over validation logic because nobody wrote it as a unit test.

## Collecting existing coverage

Scope the search to the files from [../references/impact-analysis.md](../references/impact-analysis.md) — never the whole repo.

1. `query_graph_tool` with `tests_for` on the symbols the change touches.
2. `rg` for the symbol inside `*.test.ts*` / `*.spec.ts` to catch what the graph missed.
3. Check `qa/tests/**` for an existing live spec on the same behavior (`bun run --cwd qa e2e:list` lists titles without running anything).
4. Check earlier OpenSpec changes for an existing `TC-` id covering it; reuse the id instead of inventing a parallel case.
5. **Open the file and read the assertion.** RTK compresses shell output and may shorten identifiers, so a search hit is a location, never proof of what the test checks.

## Statuses

| Status | Meaning | Action |
| --- | --- | --- |
| `covered` | A test exists and its assertion was read and matches the behavior | Upper levels take one representative only |
| `claimed` | A test exists by name but the assertion was not read | Treat as covered but flag it; verify before relying on it |
| `partial` | Some classes covered, others not | Recommend the missing classes to that level's owner |
| `missing` | No test at this level | Recommend it to the owner; do not compensate above |
| `not-applicable` | The level cannot express this behavior, or the change does not reach it | Say why in one line |

A `claimed` or `covered` test can still encode the wrong expectation — a test that passed while a
defect existed is evidence of a wrong assertion, not of coverage. When the change is a bug fix, name
the existing test that must be **changed**, not only the new ones to add.

## Output

```json
"coverage_ladder": [
  {
    "ac_id": "AC-3",
    "ladder": [
      { "level": "unit", "status": "covered", "owner": "dev",
        "evidence": "packages/ui/src/validation/password.test.ts:42",
        "note": "6 partitions plus boundaries 5/6/20/21" },
      { "level": "component", "status": "missing", "owner": "dev",
        "action": "Render test: error text plus aria-invalid on the password field" },
      { "level": "api", "status": "missing", "owner": "qa",
        "action": "Contract test: 400 with ProblemDetails.title=PASSWORD_INVALID" },
      { "level": "e2e-live", "status": "not-applicable", "owner": "qa",
        "note": "Not on the critical path; visibility is proven by the component test" }
    ]
  }
]
```

Every `missing` or `partial` entry owned by `dev` becomes a line in `quality-assurance/plan.md`.
Every one owned by `qa` becomes a scenario in the matrix — subject to the limits in
[test-budget.md](test-budget.md).
