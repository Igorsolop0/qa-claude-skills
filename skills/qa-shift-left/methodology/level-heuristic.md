# Test Level Heuristic

For each scenario decide the level. When in doubt, push down.

## Test levels

| Level | What it is | Where it lives | Backend |
| --- | --- | --- | --- |
| `unit` | Pure logic, mappers, validators, formatters, hooks, stores | `bun test` next to the code (`packages/**`, `apps/<brand>-site/**`, `qa/src/**`) | none |
| `component` | A React island or UI component rendered in isolation | `*.test.tsx` with the workspace's preloads (happy-dom, testing-library) | stubbed |
| `api` | HTTP contract: status, envelope, schema, auth, per-profile shape | `qa/tests/<Target>/API/**` (live) or BFF tests in `packages/bff` (mocked) | live gateway or mock |
| `openspec-mock` | Browser case on the preview vertical with WireMock, executed by the developer's agent before the PR | `openspec/changes/<change>/quality-assurance/test-cases/<brand>/<module>.md` | mock profiles |
| `e2e-live` | Playwright spec against a deployed environment with real data | `qa/tests/<Target>/FE/**` | live |

`unit` and `component` are owned by developers (`tdd` skill); `api` and `e2e-live` are owned by QA;
`openspec-mock` cases are executed by the developer's agent before the PR. Ownership drives the
budget in [test-budget.md](test-budget.md).

## Decision table

| Signal in the scenario | Default level | Rationale |
| --- | --- | --- |
| Pure calculation, formatting, mapping, validation | `unit` | Cheapest, fastest feedback |
| Payload → view-model mapping (`@the platform/cms-model`) | `unit` | Mapper contract, no I/O |
| Permission or eligibility predicate, no I/O | `unit` | Logic only |
| Rendering of one component or island, given props | `component` | No browser or backend needed |
| HTTP status, envelope shape, response schema | `api` | Contract test — no UI |
| Auth enforcement on an endpoint (missing or wrong credential) | `api` | Negative contract test |
| Response differs per access profile | `api` | One contract test per profile beats duplicated UI runs |
| State persisted after a request | `api` | Verify through a read endpoint |
| Page composition, block order, chrome per profile | `openspec-mock` | Deterministic with mock data; live run adds nothing |
| Copy, locale, or breakpoint variations | `component` (+ one `openspec-mock`) | Do not pay for a live run per string |
| Critical-path user journey on the deployed build | `e2e-live` | Only provable end to end with real services |
| Real registration, login, session persistence | `e2e-live` | Mocks cannot prove the live auth stack |
| Integration between two live services (gateway → backend) | `api` (live) | Contract level, not UI |
| Visual regression of a rendered screen | visual QA skill, not this ladder | Different tool, different evidence |

## Tie-breakers

- Testable at two levels → choose the lower one. Add the higher test only when the lower cannot prove
  the integration.
- One AC may legitimately need both a `unit` test (logic) and an `api` test (response shape). Produce
  both; they cover different facets.
- Default 1–3 tests per AC. More than 3 means the AC should be split.
- A scenario that needs real money, real player data, or a third-party sandbox is not automatically
  `e2e-live` — first ask whether a contract test against the same service proves it.

## `rationale_for_level` is mandatory

Examples:

- "Pure predicate over bonus state — no I/O."
- "Asserts the gateway returns the per-profile envelope; UI adds nothing."
- "Registration through the live auth stack — mocks cannot prove session persistence."

The field forces a deliberate choice and makes the budget challenge productive.
