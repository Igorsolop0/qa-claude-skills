# Acceptance Criterion Quality Rubric

Every extracted AC is scored on five dimensions. Each is boolean. An AC that fails any dimension is
flagged for refinement. This is static testing: the cheapest defect removal available.

## Dimensions

### 1. Testable

Can a tester decide pass or fail without asking for more information?

- Pass: "When the player submits with an empty email, the error `Email required` appears."
- Fail: "It should work intuitively."

### 2. Measurable

Are values, thresholds, and behaviors concrete?

- Pass: "The bonus list returns in under 500 ms at p95."
- Fail: "The page should be fast."

### 3. Atomic

Is the AC about exactly one behavior?

- Pass: "An editor can publish a draft promotion."
- Fail: "An editor can create, edit, publish, and delete a promotion, and players get notified."

### 4. Complete

Does the AC cover both the happy path and the failure or boundary, or explicitly scope one of them out?

- Pass: "A player can claim a bonus until its expiry. After expiry the claim button is disabled and shows `Expirado`."
- Partial: "A player can claim a bonus." (no failure or boundary)

### 5. Independent

Does the AC stand on its own, without depending on the wording of another?

- Pass: each AC reads as a standalone behavior.
- Fail: "AC-2: same as AC-1 but for the player profile."

## Scoring output

```json
{
  "id": "AC-1",
  "quality_score": {
    "testable": true,
    "measurable": false,
    "atomic": true,
    "complete": true,
    "independent": true
  },
  "refinement_needed": true,
  "failed_dimensions": ["measurable"],
  "refinement_note": "AC-1 says 'fast' — quantify it (suggested: 500 ms p95)."
}
```

## Threshold

- 0 failed dimensions → `refinement_needed: false`.
- 1+ failed → `refinement_needed: true`, propose a Given/When/Then rewrite.
- 2+ failed including `testable` → the whole change gets `verdict: needs_refinement`.

## OpenSpec note

Requirement scenarios in `openspec/changes/<change>/specs/**` are already written as
`#### Scenario:` blocks in Given/When/Then shape. Score them with the same rubric — being in the
right format does not make a scenario measurable or atomic.
