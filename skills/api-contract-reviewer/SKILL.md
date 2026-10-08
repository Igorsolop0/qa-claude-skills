---
name: api-contract-reviewer
description: |
  Behavioral review of Playwright API contract tests (specs, clients, fixtures, test data) for
  patterns that cause false positives, silent contract drift, test coupling, secret leaks, or
  access through a route the project forbids. Reads the project's `CLAUDE.md` for what is
  particular about the product. API-only: does not check UI locators, waits, or Page Objects.
  Trigger: "review this API test", "check this API spec", "is this API test correct", "review API
  spec", "why is this contract test flaky", "code review API test", "check contract test quality",
  "anti-patterns in this API spec", any API `.spec.ts` shared without explicit instructions.
---

# API Contract Reviewer

Behavioral review of Playwright API contract tests. Find patterns that cause false positives,
silent contract drift, coupling between tests, auth or secret problems, and violations of the
project's access rules. Not a style linter: the formatter covers formatting and style.

## When this skill applies

- "review this API test / spec", "is this contract test correct / flaky / OK?"
- An API spec shared without instructions
- A PR diff touching API clients, fixtures, or test data

If the user shares a directory, scan every `.spec.ts` plus the clients and fixtures they import.

## Context you need before reviewing

Read `CLAUDE.md` in the test folder first ("Project profile" and "Test conventions"). It tells
you what this skill cannot know:

- Response shapes: plain JSON, or an envelope where a business failure can be HTTP 200 with a
  non-success code; where the machine-readable error code lives.
- Auth: which headers or tokens every call needs, and where test accounts come from.
- Access rules: which hosts and routes tests may use, which endpoints must not be called, where
  mutating tests may run.
- The suite's own conventions (fixtures, data helpers, naming).

No `CLAUDE.md`: infer these from the fixtures and two existing specs, and say in the report that
the review assumed them. The writer conventions are in the `api-contract-writer` skill
(`references/honest-tests.md`, `references/optional-layers.md`); cite them when a finding depends
on one. Catalog items about envelopes (C2, H2) and forbidden routes (C4) apply only when the
profile describes such a thing: adapt the names in them to this product.

## Workflow

1. **Read the code.** Open every file in scope, plus the fixtures and clients it imports.
2. **Walk the catalog.** Read `references/anti-patterns.md` and check each item top-down. Record
   file path, line number, and snippet.
3. **Write the report** using `references/output-template.md`. Skip empty sections. One sentence per
   "why", explaining the mechanism.
4. **Don't fabricate.** No finding without a line number and a mechanism. Always include "What's good".

## Philosophy

The author is a senior QA engineer. Every finding explains **how** the pattern breaks at runtime:
which false pass, which leak, which flake. Where the product handles money, balances or
permissions, treat silent false passes on those as Critical.

## References

- `references/anti-patterns.md` — catalog Critical → Low, with mechanism and fix
- `references/output-template.md` — report structure

Open both at the start of every review.
