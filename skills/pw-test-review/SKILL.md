---
name: pw-test-review
description: Review Playwright tests (TypeScript/JavaScript) for known anti-patterns and reliability issues — networkidle abuse, missing await, nested describe, beforeAll with shared state, toContainText false positives, unchecked goto status, weak locators, force clicks, hardcoded sleeps. Use whenever a user asks to review a Playwright test file, snippet, PR diff, or code-smell-check a `.spec.ts` / `.test.ts` / `e2e` test, or asks "why is this test flaky", "is this test good", "anti-patterns in this playwright code", "code review playwright", or wants a second opinion on Playwright test quality. Trigger even if they don't explicitly say "review" — any time Playwright test code is shared with intent to evaluate it.
---

# pw-test-review

Behavioral review of Playwright tests — find anti-patterns that cause flakes, false positives, slow runs, or hidden bugs. Not a stylistic linter.

## When this skill applies

Trigger on requests like:

- "Review this playwright test"
- "Is this test good / flaky / OK?"
- "Why is this test flaky?"
- "Code smell in this PW spec"
- "PR review for playwright"
- A `.spec.ts` / `.test.ts` / `e2e` file shared without explicit instructions — assume review.

If the user shares a whole directory, scan all `.spec.ts` / `.test.ts` files; otherwise focus on what they share.

## Workflow

1. **Read the test code.** For each file the user supplies — open it, look at the actual contents. Don't review off vibes.
2. **Walk the anti-pattern catalog.** Read `references/anti-patterns.md` and check each item against the code. The catalog is organized by priority — work top-down, capture line numbers and code snippets as you go.
3. **Context-aware bumps.** If the user mentions money / iGaming / fintech / KYC / balances, raise the priority of `toContainText` and unchecked `response.status()` findings by one level. They cause silent bugs in those domains.
4. **Write the report.** Use the structure in `references/output-template.md`. Skip empty sections. Cite line numbers. One sentence per "why" — explain mechanism, not policy.
5. **Don't fabricate.** If a category has no findings, omit it. Better three sharp findings than ten wobbly ones. Always include a "What's good" section — tells the author what to keep.

## Philosophy

The user is a senior QA engineer. They value root-cause reasoning over rules. For every finding, the "why" should explain the **mechanism** by which the pattern causes a problem — not "the docs say so", not "best practice". If you can't justify a finding by mechanism, drop it.

This is a **behavioral** review. Don't nitpick formatting, variable naming, semicolons, import order, or stylistic preferences — that's what ESLint and Prettier are for. Focus on patterns that cause real flakes, false positives, slow runs, or hidden bugs.

## References

- `references/anti-patterns.md` — full catalog of patterns to flag, grouped Critical → Low, with mechanism and fix for each.
- `references/output-template.md` — exact output structure.

Open both at the start of every review.
