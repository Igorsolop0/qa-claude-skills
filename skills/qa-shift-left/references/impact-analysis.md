# Impact Analysis

Runs for changes to existing behavior, before AC extraction. Skip for a fully additive change (new
package, new route with no existing callers) and for bugs, which get their own codebase pass in
[bug-mode.md](bug-mode.md). When skipped, set `impact_analysis: null`.

Purpose: find which source and test files the change touches, surface regression risk, and flag code
paths with no coverage before designing new scenarios.

## 1. Extract search terms

From the issue or the OpenSpec specs: component and island names, store or hook names, route paths,
API endpoints, CMS block or collection names, package names, env or feature-flag keys.

## 2. Find the code — graph first

This repository ships a knowledge graph. Use it before `rg`:

- `semantic_search_nodes_tool` — locate a symbol or capability by name or description
- `query_graph_tool` with `callers_of` / `imports_of` — who depends on the change
- `get_impact_radius_tool` — blast radius of the symbol being changed
- `query_graph_tool` with `tests_for` — existing coverage for that symbol

Fall back to search only for what the graph does not cover:

```bash
rg -l "<term>" apps packages gateway qa --glob '!**/node_modules/**'
rg -l "<ComponentName>" --glob '*.test.ts*' --glob '*.spec.ts'
```

Keep at most 15 entries in `affected_files`, preferring the central ones: services and stores over
config, mappers over fixtures.

## 3. Map existing coverage

For each affected file, answer:

- Is there a unit or component test for it? → `existing_coverage: true | false`
- Is it imported from many places (graph `callers_of` count > 3)? → regression risk
- Does an existing `qa/tests/**` spec already cover the behavior live? → do not duplicate it
- Is the behavior covered by an OpenSpec case from an earlier change? → reuse the id, do not invent a parallel case

## 4. Collect existing coverage (feeds the coverage ladder)

For each affected symbol, gather what already proves it and at which level:

```
query_graph_tool  pattern=tests_for symbol=<Symbol>     # graph-known tests
rg -n "<Symbol>" --glob '*.test.ts*' --glob '*.spec.ts' # what the graph missed
bun run --cwd qa e2e:list                               # existing live specs, no network
```

Open every file you are about to cite and read the assertion — a search hit is a location, not proof
of what the test checks, and RTK may abbreviate identifiers in search output. Record the result per
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
      "apps/client-site/src/components/bonus/BonusCard.tsx",
      "packages/bff/src/handlers/bonuses.ts"
    ],
    "related_test_files": [
      "apps/client-site/src/components/bonus/BonusCard.test.tsx",
      "qa/tests/Client/API/auth/register.spec.ts"
    ],
    "regression_risks": [
      {
        "file": "packages/bff/src/handlers/bonuses.ts",
        "risk": "Called by the bonus page and the game header popover — a contract change hits both",
        "existing_coverage": true
      }
    ],
    "uncovered_paths": ["apps/client-site/src/stores/bonus-intent.ts"]
  }
}
```

## Hard rules

- Never invent a path. Only files the graph or a search actually returned.
- RTK compresses shell output and may abbreviate identifiers, so use search results to locate code and
  open the file to confirm exact names before asserting anything about them.
- Every `existing_coverage: false` on a central file gets a matching entry in the top-level `risks[]`.
- Nothing found → `impact_analysis: null`, not an empty object.
