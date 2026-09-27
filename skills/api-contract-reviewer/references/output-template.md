# API Contract Reviewer — Output Template

Use this structure for every review report. Skip sections that have no findings.
Always include "What's good" — never omit it.

---

```
## What's good

- [Specific thing worth keeping — e.g., "All happy-path tests use toMatchSchema()"]
- [Another good pattern — e.g., "asProblemDetails() is used for every the claim service rejection"]
- [Up to 4 bullets — be specific, not generic]

## Critical

### [C-number] [Short title] — `file.spec.ts:line`

**Code:**
```typescript
// exact snippet from the file
```

**Why it breaks:** [One sentence — the mechanism, not "the docs say so".]

**Fix:**
```typescript
// minimal corrected version
```

---
(repeat for each critical finding)

## High

### [H-number] [Short title] — `file.spec.ts:line`

**Code:**
```typescript
// snippet
```

**Why it breaks:** [One sentence — mechanism.]

**Fix:**
```typescript
// minimal corrected version
```

---
(repeat)

## Medium

### [M-number] [Short title] — `file.spec.ts:line`

[Same format — code, why, fix]

## Low

### [L-number] [Short title] — `file.spec.ts:line`

[Same format — code, why, fix]
```

---

## Rules

- **Skip empty sections.** No "Medium: none found." — just omit the heading.
- **Always cite line numbers.** `active-bonus.spec.ts:67`, not "around line 67" or "in the claim test".
- **One sentence per "why".** Explain the mechanism — what actually goes wrong at runtime.
  Never write "this is a best practice" or "the docs recommend".
- **"What's good" is mandatory.** At least 2 bullets. Tells the author what patterns to keep.
  Be specific: "toMatchSchema() on all 200 responses" beats "good test structure".
- **Severity is from anti-patterns.md** — don't escalate/downgrade without a reason stated.
- **No style findings.** Not naming, not formatting, not import order, not comment style.
  Only behavioral patterns that affect correctness, reliability, or isolation.
- **Don't fabricate.** If a category has zero findings after checking anti-patterns.md, omit it.
  Three verified findings beat eight guesses.
