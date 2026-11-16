# Impact Analysis

Runs for changes to existing behavior, before AC extraction. Skip for a fully additive change (new
package, new route with no existing callers) and for bugs, which get their own codebase pass in
[bug-mode.md](bug-mode.md). When skipped, set `impact_analysis: null`.

Purpose: find which source and test files the change touches, surface regression risk, and flag code
paths with no coverage before designing new scenarios.

## 1. Extract search terms

From the issue or the spec: component names, store or hook names, route paths,
API endpoints, CMS block or collection names (if any), package names, env or feature-flag keys.

## 2. Find the code — graph first

If the environment offers a code knowledge graph (or similar symbol index), use it before `rg`. The examples below use graph-style queries:

- `semantic_search_nodes_tool` — locate a symbol or capability by name or description
- `query_graph_tool` with `callers_of` / `imports_of` — who depends on the change
- `get_impact_radius_tool` — blast radius of the symbol being changed
- `query_graph_tool` with `tests_for` — existing coverage for that symbol

Fall back to search only for what the graph does not cover:

```bash
rg -l "<term>" <source dirs> <tests dir> --glob '!**/node_modules/**'
rg -l "<ComponentName>" --glob '*.test.ts*' --glob '*.spec.ts'
```

Keep at most 15 entries in `affected_files`, preferring the central ones: services and stores over
config, mappers over fixtures.

## 3. Map existing coverage

For each affected file, answer:

- Is there a unit or component test for it? → `existing_coverage: true | false`
- Is it imported from many places (graph `callers_of` count > 3)? → regression risk
- Does an existing live spec in `<tests dir>` already cover the behavior? → do not duplicate it
- Is the behavior covered by a test case from an earlier change? → reuse the id, do not invent a parallel case

## 4. Collect existing coverage (feeds the coverage ladder)

For each affected symbol, gather what already proves it and at which level:

```
query_graph_tool  pattern=tests_for symbol=<Symbol>     # graph-known tests
rg -n "<Symbol>" --glob '*.test.ts*' --glob '*.spec.ts' # what the graph missed
<list live specs command>                               # existing live specs, no network (e.g. a test runner's --list)
```

Open every file you are about to cite and read the assertion — a search hit is a location, not proof
of what the test checks, and compressed search output may abbreviate identifiers. Record the result per
acceptance criterion in `coverage_ladder` ([../methodology/coverage-ladder.md](../methodology/coverage-ladder.md)),
using `claimed` when the assertion was not read.

## 5. Flag uncovered paths

Central files with no test become entries in `uncovered_paths[]` and, when they sit on the change's
path, in `risks[]`.

## Output

```json
{
  "impact_analysis": {
    "affected_files": [
      "src/components/coupon/CouponCard.tsx",
      "src/api/handlers/coupons.ts"
    ],
    "related_test_files": [
      "src/components/coupon/CouponCard.test.tsx",
      "tests/api/auth/register.spec.ts"
    ],
    "regression_risks": [
      {
        "file": "src/api/handlers/coupons.ts",
        "risk": "Called by the coupon page and the header popover — a contract change hits both",
        "existing_coverage": true
      }
    ],
    "uncovered_paths": ["src/stores/coupon-intent.ts"]
  }
}
```

## Hard rules

- Never invent a path. Only files the graph or a search actually returned.
- Tools that compress shell output may abbreviate identifiers, so use search results to locate code and
  open the file to confirm exact names before asserting anything about them.
- Every `existing_coverage: false` on a central file gets a matching entry in the top-level `risks[]`.
- Nothing found → `impact_analysis: null`, not an empty object.
