# Test Budget

Replaces flat pyramid enforcement. The pyramid is a routing idea, not a per-change scorecard: QA does
not own the base of it, and percentages are noise at six scenarios.

## Who owns which level

| Level | Owner | Where the work lands | Enforced by |
| --- | --- | --- | --- |
| `unit`, `component` | Developer | Tests next to the code, written test-first where the team does TDD | CI on every PR |
| `mocked-e2e` | Developer with their agent | The project's test-case location (see [handoff](../references/handoff.md)) | Run before the PR |
| `api`, `e2e-live` | QA | `<tests dir>` | QA runs against a deployed environment |

The plan still assigns a level to every scenario, including the ones QA does not own. For `unit` and
`component` the output is a **recommendation to the developer**, carried into
the plan — not a work item for the QA suite. Writing "this needs no live test because the
mapper unit test proves it" is the whole point; silently dropping the lower levels is how a plan
drifts into an ice-cream cone.

## The budget QA is measured on

Only what QA writes is measured: of the automated checks QA owns, roughly **70–80% at `api` level and
20–30% live in the browser**. Report it per suite, not per change.

## Per-change limits (these are the actual gate)

- **At most 1–2 `e2e-live` scenarios per change.** More requires a written justification per extra scenario.
- **`e2e-live` only on the critical path:** the flows the business cannot work without (for a web shop: sign-up and login, search, checkout, payment), or a backend contract the frontend cannot work without.
- **Every per-profile difference in a response is an `api` test**, never a second browser run.
- **Every new or changed endpoint gets a contract test:** status, response shape, schema, plus one negative case (missing or wrong credentials).
- **No duplicates.** Behavior already proven at a lower level or by an existing mocked case does not get a second home in the live suite. See [coverage-ladder.md](coverage-ladder.md).

## Challenge phase (keep this)

The valuable part of the pyramid was never the ratio — it was the forced question. Ask it for every
scenario above `api`:

1. "Can this be proven by an API contract test instead?" → yes: demote, update the rationale.
2. "Can this be proven with a stubbed backend in a mocked E2E case?" → yes: demote to `mocked-e2e`.
3. "Is the behavior already proven below, and this only adds the human-visible aspect?" → keep one representative, drop the rest.

And for every `api` scenario: "is this pure logic with no I/O?" → yes: it is a unit test, and it belongs to the developer.

## Output shape

```json
"test_budget": {
  "qa_owned": { "api": 4, "e2e_live": 1 },
  "delegated": { "unit": 3, "component": 2, "mocked_e2e": 2 },
  "e2e_live_limit": 2,
  "within_limits": true,
  "challenges_run": 3,
  "demoted": [
    { "scenario_id": "S-7", "from": "e2e-live", "to": "api", "reason": "Per-profile response is provable at the API." }
  ],
  "justified_e2e": [
    { "scenario_id": "S-12", "reason": "Live sign-up — session persistence is not observable with mocks." }
  ],
  "notes": "UI composition change: base grows on the developer side once the mapper gains cases."
}
```

## When the budget is exceeded

`within_limits: false` does not block the verdict. It forces a written reason per extra live
scenario, and the team decides. Legitimate cases: live auth work, a change whose whole scope is
"add live smoke coverage", an integration change across several services.

Never invent lower-level tests to make a ratio look better, and never move a check into the live suite just
because nobody wrote it lower — that is the inversion described in [coverage-ladder.md](coverage-ladder.md).
