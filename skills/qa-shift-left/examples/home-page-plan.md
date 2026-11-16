# Example — spec "Shop home page" (web shop)

Condensed plan. Shows the shape and the reasoning, not a full artifact.

## Layer 0 — memory

- Similar work: the category page and the sticky header specs — both already have test cases.
- Known risks: category links depend on seeded catalogue content; a missing seed reads as a product defect.
- Existing coverage: `<tests dir>/e2e/home.spec.ts` covers the guest header and the category tab order.
- Reusable: helpers (`openGuestHome`, `expectHomeMainContentOrder`), profiles `guest` and `registered-user`.

## Layer 1 — feature container

- What changes: the home page composes existing capabilities (banner slider, category tabs, quick-action row, product sliders) instead of a bespoke page shell.
- Scope: all variants.
- Profiles: `guest`, `registered-user`.
- Dependencies: CMS page content, product catalogue, header, footer.
- Unknown: how many product sliders are published in a given environment — treated as an assumption, not asserted exactly.

## Layer 2 — testing types

- Functional, black box, positive and negative.
- White box at unit level for the block-order mapper.
- Excluded: performance (no new upstream call), security (no new auth surface), accessibility (covered by a separate visual and a11y review).

## Layer 3 — techniques

| Technique | Slice it cuts |
| --- | --- |
| Use case | Guest opens home and scans the page top to bottom |
| Decision table | `profile` × `breakpoint band` → which blocks are visible (quick-action row appears on small and medium screens, not on large ones) |
| Boundary value analysis | Product sliders: 0, 1, and the maximum published sections |
| Pairwise | `{small, large} × {guest, registered-user}` instead of the full matrix |
| Error guessing | Empty CMS collection, missing translation, unseeded category link |

## Layer 4 — principles and risk

- Risk-based and early testing; defect clustering around CMS-driven content.
- Top risks: unseeded category link (regression, high likelihood), block order drifting per breakpoint (ux, medium), signed-in chrome leaking into the guest view (auth, low likelihood but high impact).
- Order: block composition first, then per-profile chrome, then breakpoint bands.

## Layer 5 — scenario set (must only)

| ID | Scenario | Type | Technique | Level | Destination | Rationale |
| --- | --- | --- | --- | --- | --- | --- |
| S-1 | Block order mapper returns banner → tabs → quick-action row → sliders for the small and medium bands | positive | decision table | `unit` | `src/**/home-blocks.test.ts` | Pure mapping, no I/O |
| S-2 | Quick-action row is absent in the large band | boundary | decision table | `unit` | same | Same mapper, other branch |
| S-3 | Home renders zero product sliders when none is published | edge | boundary values | `component` | `*.test.tsx` | Rendering with stub data |
| S-4 | Guest home shows menu button, logo, `Log in`, `Sign up` and the guest sticky items | positive | use case | `mocked-e2e` | `TC-HOME-001` | Deterministic with mock profiles |
| S-5 | Signed-in home keeps the same main-content order with signed-in chrome | positive | pairwise | `mocked-e2e` | `TC-HOME-002` | Profile difference provable on mocks |
| S-6 | Guest home on the deployed build loads with the required chrome and block order | positive | use case | `e2e-live` | `<tests dir>/e2e/home.spec.ts` (`TC-HOME-001`) | Critical path; proves real CMS content and the deployed build |

## Coverage ladder (AC-2: quick-action row appears only on small and medium screens)

| Level | Status | Owner | Evidence / action |
| --- | --- | --- | --- |
| `unit` | `covered` | dev | `src/…/home-blocks.test.ts` — both bands asserted on the mapper |
| `component` | `missing` | dev | Recommend a render test: row present on small, absent on large |
| `api` | `not-applicable` | qa | No endpoint involved; composition is server-rendered from CMS content |
| `mocked-e2e` | `missing` | dev | `TC-HOME-003/004` — one case per band with mock profiles |
| `e2e-live` | `not-applicable` | qa | Band behavior is deterministic on mocks; a live run adds cost, not signal |

`dev` on the `mocked-e2e` row means the developer with their agent, per `methodology/test-budget.md`:
they write and run the case before the PR; QA does not.

Note the inversion: the missing component test is a recommendation for the developer, not a reason to
add a second browser scenario.

## Budget

QA-owned: 0 `api`, 1 `e2e-live` (limit 2) → within limits.
Delegated: 2 `unit`, 1 `component`, 2 `mocked-e2e`.

Challenge phase:

- S-4 and S-5 stay on mocks: per-profile composition is deterministic there, and live runs would create real accounts for no extra signal.
- S-6 cannot move down: only the deployed build with live CMS content proves the page composes in production-like conditions.
- No API scenarios: this change adds no endpoint. The page reads CMS content already covered by its own contract tests.

Notes: "UI composition change — the base grows on the developer side once the mapper and the
component test land."

## Handoff

- Mocked cases: `TC-HOME-001`, `TC-HOME-002` → the project's test-case location (or the "Mocked cases" section of `test-plan.md`).
- Deferred: both, backend mode `mock required`, pickup condition "real test user available".
- Live suite: `TC-HOME-001` only. `TC-HOME-002` (tab order) already exists — reused, not duplicated.
- Not promoted to the live suite: breakpoint matrix and empty-state cases. They fail promotion question 3 — mocks prove them, and live runs would only add cost.
- Recommended to the developer: component render test for the quick-action row (see the ladder above).

## Verdict

`ready_to_implement` — every AC has a `must` scenario; the only open question (number of published sliders) is recorded as an assumption and does not block implementation.
