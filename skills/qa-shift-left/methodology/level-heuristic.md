# Test Level Heuristic

For each scenario decide the level. When in doubt, push down.

## Test levels

| Level | What it is | Where it lives | Backend |
| --- | --- | --- | --- |
| `unit` | Pure logic, mappers, validators, formatters, hooks, stores | The project's unit-test runner, next to the code | none |
| `component` | A UI component rendered in isolation | Component tests with the project's DOM test setup | stubbed |
| `api` | HTTP contract: status, response envelope, schema, auth, per-profile shape | Live API specs in `<tests dir>`, or the service's own tests against a stub | live service or stub |
| `mocked-e2e` | Browser case against the assembled app with a stubbed backend (any stub or fake-server setup), run by the developer before the PR | The project's test-case location | stubbed backend |
| `e2e-live` | Browser spec against a deployed environment with real data | `<tests dir>` | live |

`unit` and `component` are owned by developers; `api` and `e2e-live` are owned by QA;
`mocked-e2e` cases are run by the developer before the PR. Ownership drives the
budget in [test-budget.md](test-budget.md).

## Decision table

| Signal in the scenario | Default level | Rationale |
| --- | --- | --- |
| Pure calculation, formatting, mapping, validation | `unit` | Cheapest, fastest feedback |
| Payload → view-model mapping | `unit` | Mapper contract, no I/O |
| Permission or eligibility predicate, no I/O | `unit` | Logic only |
| Rendering of one component, given props | `component` | No browser or backend needed |
| HTTP status, envelope shape, response schema | `api` | Contract test — no UI |
| Auth enforcement on an endpoint (missing or wrong credential) | `api` | Negative contract test |
| Response differs per access profile | `api` | One contract test per profile beats duplicated UI runs |
| State persisted after a request | `api` | Verify through a read endpoint |
| Page composition, block order, chrome per profile | `mocked-e2e` | Deterministic with mock data; live run adds nothing |
| Copy, locale, or breakpoint variations | `component` (+ one `mocked-e2e`) | Do not pay for a live run per string |
| Critical-path user journey on the deployed build | `e2e-live` | Only provable end to end with real services |
| Real sign-up, login, session persistence | `e2e-live` | Mocks cannot prove the live auth stack |
| Integration between two live services (API → backend) | `api` (live) | Contract level, not UI |
| Visual regression of a rendered screen | a visual-testing tool, not this ladder | Different tool, different evidence |

## Tie-breakers

- Testable at two levels → choose the lower one. Add the higher test only when the lower cannot prove
  the integration.
- One AC may legitimately need both a `unit` test (logic) and an `api` test (response shape). Produce
  both; they cover different facets.
- Default 1–3 tests per AC. More than 3 means the AC should be split.
- A scenario that needs real payments, real user data, or a third-party sandbox is not automatically
  `e2e-live` — first ask whether a contract test against the same service proves it.

## `rationale_for_level` is mandatory

Examples:

- "Pure predicate over coupon state — no I/O."
- "Asserts the API returns the per-profile response; UI adds nothing."
- "Sign-up through the live auth stack — mocks cannot prove session persistence."

The field forces a deliberate choice and makes the budget challenge productive.
