# Output template

Use this exact structure. Skip sections that have no findings.

```
# PW test review: <file or PR identifier>

## Critical (must fix)
- **Line N**: `<code snippet>` — <one-sentence mechanism explanation>
  - Fix: `<one-line fix or code snippet>`

## High (strongly recommend)
- ... (same shape)

## Medium
- ...

## Low / nice-to-have
- ...

## What's good
- 1–3 short bullets about patterns the test got right (e.g., uses `getByRole`, no `force: true`, asserts on visible state instead of network). This isn't flattery — it tells the author what to keep.

## Summary
<2–3 sentence verdict — "ship after fixing Critical and Highs", or "fundamentally needs restructuring", or "looks solid, only minor polish".>
```

## Behavioral notes for writing the review

- **Be specific.** Cite line numbers and quote the offending code. A finding without a line number is a vague complaint.
- **Be brief in the "why".** One sentence per finding is the target. Two if there's a non-obvious mechanism. Anything more belongs in a long-form post, not a review.
- **Don't invent problems.** If you can't honestly justify a finding by mechanism, drop it.
- **Multiple files.** Group findings by file. Top of the report is a one-line tally: `3 Critical, 5 High, 2 Medium across 4 files.`

## What this review is NOT

- Not a stylistic linter (variable names, import order, semicolons). Use the project's existing linter for that.
- Not a recommendation to rewrite working code just because a different pattern exists.
- Not a place to quote docs. Explain the **mechanism** — the reader is senior, they need the why.
- Not a place to say "this might be flaky" without a reason. Say what flake it'll cause and under what condition.
