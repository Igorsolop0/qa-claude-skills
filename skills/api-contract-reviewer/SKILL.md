---
name: api-contract-reviewer
description: |
  Behavioral review of Playwright API contract tests in the `qa/` package
  (`qa/tests/Client/API/**`, `qa/tests/Backoffice/API/**`, `qa/src/api/**`, `qa/src/fixtures/**`)
  for patterns that cause false positives, silent contract drift, test coupling, secret leaks, or
  prohibited Backoffice access. API-only: does not check UI locators, waits, or Page Objects.
  Trigger: "review this API test", "check this API spec", "is this API test correct", "review API
  spec", "why is this contract test flaky", "code review API test", "check contract test quality",
  "anti-patterns in this API spec", any `.spec.ts` under `qa/tests/*/API/` shared without
  explicit instructions.
---

# API Contract Reviewer

Behavioral review of Playwright API contract tests. Find patterns that cause false positives,
silent contract drift, coupling between tests, auth or secret problems, and violations of the
Backoffice access rules. Not a style linter: Biome covers formatting and style.

## When this skill applies

- "review this API test / spec", "is this contract test correct / flaky / OK?"
- A spec under `qa/tests/Client/API/` or `qa/tests/Backoffice/API/` shared without instructions
- A PR diff touching `qa/src/api/**`, `qa/src/fixtures/**`, or `qa/test-data/**`

If the user shares a directory, scan every `.spec.ts` plus the clients and fixtures they import.

## Context you need before reviewing

- Envelopes: the legacy envelope service returns `DomainApiResponse` (business failures can be HTTP 200 with a non-success
  `ResponseCode`); the games service/the claim service/the availability service return bare JSON and RFC 7807 ProblemDetails with the code in `title`.
- Client calls need `gate-auth` (from `API_GATE_USER`/`API_GATE_PASS`) and, for player endpoints,
  a Bearer token from a player the run registered.
- Backoffice: Management API Gateway only. `admin-api.*`, `UserId` headers, and BO user ids are
  prohibited. Mutating tests run on dev/qa only.
- The writer conventions live in `qa/.claude/skills/api-contract-writer/`. When a finding depends
  on a convention, cite the reference file.

## Workflow

1. **Read the code.** Open every file in scope, plus the fixtures and clients it imports.
2. **Walk the catalog.** Read `references/anti-patterns.md` and check each item top-down. Record
   file path, line number, and snippet.
3. **Write the report** using `references/output-template.md`. Skip empty sections. One sentence per
   "why", explaining the mechanism.
4. **Don't fabricate.** No finding without a line number and a mechanism. Always include "What's good".

## Philosophy

The author is a senior QA engineer. Every finding explains **how** the pattern breaks at runtime:
which false pass, which leak, which flake. Money, bonuses, and balances are in scope for this
product, so treat silent false passes on those as Critical.

## References

- `references/anti-patterns.md` — catalog Critical → Low, with mechanism and fix
- `references/output-template.md` — report structure

Open both at the start of every review.
