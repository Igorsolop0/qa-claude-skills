# Test Budget

Replaces flat pyramid enforcement. The pyramid is a routing idea, not a per-change scorecard: QA does
not own the base of it, and percentages are noise at six scenarios.

## Who owns which level

| Level | Owner | Where the work lands | Enforced by |
| --- | --- | --- | --- |
| `unit`, `component` | Developer | Workspace tests next to the code, written with the `tdd` skill | CI on every PR |
| `openspec-mock` | Developer with their agent | `openspec/changes/<change>/quality-assurance/test-cases/**` | `portal-openspec-run-test-cases` before the PR |
| `api`, `e2e-live` | QA | `qa/tests/**` | QA runs, `bun run --cwd qa e2e:*` |

The plan still assigns a level to every scenario, including the ones QA does not own. For `unit` and
`component` the output is a **recommendation to the developer**, carried into
`quality-assurance/plan.md` — not a work item for `qa/`. Writing "this needs no live test because the
mapper unit test proves it" is the whole point; silently dropping the lower levels is how a plan
drifts into an ice-cream cone.

## The budget QA is measured on

Only what QA writes is measured: of the automated checks QA owns, roughly **70–80% at `api` level and
20–30% live in the browser**. Report it per suite, not per change.

## Per-change limits (these are the actual gate)

- **At most 1–2 `e2e-live` scenarios per change.** More requires a written justification per extra scenario.
- **`e2e-live` only on the critical path:** home, category, game launch, auth, deposit, bonus claim, or a backend contract the storefront cannot work without.
- **Every per-profile difference in a response is an `api` test**, never a second browser run.
- **Every new or changed endpoint gets a contract test:** status, envelope, schema, plus one negative case (missing or wrong credentials).
- **No duplicates.** Behavior already proven at a lower level or by an existing mock case does not get a second home in `qa/`. See [coverage-ladder.md](coverage-ladder.md).

## Challenge phase (keep this)

The valuable part of the pyramid was never the ratio — it was the forced question. Ask it for every
scenario above `api`:

1. "Can this be proven by an API contract test instead?" → yes: demote, update the rationale.
2. "Can this be proven on mocks in an OpenSpec case?" → yes: demote to `openspec-mock`.
3. "Is the behavior already proven below, and this only adds the human-visible aspect?" → keep one representative, drop the rest.

And for every `api` scenario: "is this pure logic with no I/O?" → yes: it is a unit test, and it belongs to the developer.

## Output shape

```json
"test_budget": {
  "qa_owned": { "api": 4, "e2e_live": 1 },
  "delegated": { "unit": 3, "component": 2, "openspec_mock": 2 },
  "e2e_live_limit": 2,
  "within_limits": true,
  "challenges_run": 3,
  "demoted": [
    { "scenario_id": "S-7", "from": "e2e-live", "to": "api", "reason": "Per-profile envelope is provable at the gateway." }
  ],
  "justified_e2e": [
    { "scenario_id": "S-12", "reason": "Live registration — session persistence is not observable with mocks." }
  ],
  "notes": "UI composition change: base grows on the developer side once the mapper gains cases."
}
```

## When the budget is exceeded

`within_limits: false` does not block the verdict. It forces a written reason per extra live
scenario, and the team decides. Legitimate cases: live auth work, a change whose whole scope is
"add live smoke coverage", an integration change across gateway, BFF, and backend.

Never invent lower-level tests to make a ratio look better, and never move a check into `qa/` just
because nobody wrote it lower — that is the inversion described in [coverage-ladder.md](coverage-ladder.md).
