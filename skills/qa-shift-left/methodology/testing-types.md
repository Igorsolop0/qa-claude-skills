# Testing Types and Visibility Levels

Layer 2 of the Burger method. Choose deliberately and write down what you excluded.

## Visibility: black box, white box, grey box

| | Black box | White box | Grey box |
| --- | --- | --- | --- |
| What you know | Requirements and observable behavior only | The implementation: branches, data structures, queries | Requirements plus partial internals (schema, contract, DOM structure) |
| Derived from | Acceptance criteria, specs, API contracts, UI states | Source code and its paths | Contract plus a look at the code |
| Typical the platform home | `qa/tests/**` live specs, OpenSpec mock cases | `bun test` unit tests next to the code | API contract tests asserting a response schema, component tests against `data-slot` hooks |
| Coverage question | "Is every required behavior observable and correct?" | "Is every branch and boundary in this function exercised?" | "Does the observable contract match what the code actually produces?" |
| Blind spot | Untested internal branches, dead code | Wrong requirement implemented perfectly | Inherits both, in smaller doses |

How to use the distinction:

- **Start black box.** Requirements come first: derive scenarios from the AC before opening the code.
  This keeps the plan honest about what the user needs.
- **Add white box after reading the diff or the implementation.** It answers a different question:
  which internal paths exist that the requirements never mentioned (error branches, fallbacks,
  retries, cache misses, locale fallbacks, null-object paths).
- **Grey box is the default for API contract work.** You know the envelope (`DomainApiResponse`,
  `ProblemDetails`), the status codes, and the schema, without knowing the handler internals.
- **Coverage note:** black-box coverage is measured against requirements, white-box coverage against
  code (statement, branch, condition). Never report code coverage as proof of requirement coverage.

## Functional and non-functional

Functional is the default: does the system do what it must.

Non-functional types worth naming when the change touches them:

| Type | When product work triggers it | Where it usually lands |
| --- | --- | --- |
| Performance / load | New upstream call on a hot path, slider with many items, CMS query per request | Out of scope for `qa/`; raise as a risk and route to the platform team |
| Security | Auth, sessions, tokens, permissions, secret handling, redaction | Unit tests plus a negative API contract test (call without auth) |
| Compatibility | New viewport band, new locale, a brand-specific route | Component tests per band, plus one `openspec-mock` case; live only if the band is on the critical path, within the `e2e-live` budget |
| Usability / accessibility | Focus order, keyboard traps, contrast, labels | Component tests for roles and names; visual QA skill for the rest |
| Reliability | Retry, timeout, degraded upstream, cache miss | Unit tests for the fallback branch, API contract for the error envelope |
| Localization | Copy, pluralization, currency and date formats, RTL | Unit tests for the formatter, component tests for copy; live only if the screen is on the critical path, within the `e2e-live` budget |

## Positive, negative, boundary, edge

- **Positive** — the requirement's happy path. One per AC, minimum.
- **Negative** — invalid input, missing permission, unauthorized call, upstream error. The system must
  fail in the specified way, not just "fail".
- **Boundary** — the value exactly at, just below, and just above a limit. See
  [design-techniques.md](design-techniques.md).
- **Edge** — rare but legal states: empty list, single item, maximum items, very long string,
  concurrent action, expired session, slow network.

## Static testing

Reviewing requirements, specs, and designs is testing too, and it is the cheapest defect removal
available. The AC quality rubric ([ac-quality-rubric.md](ac-quality-rubric.md)) is exactly that:
a static test of the requirement before any code exists.
