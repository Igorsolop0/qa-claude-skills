# Example — OpenSpec change `create-home-page` (brand `client`)

Condensed plan. Shows the shape and the reasoning, not a full artifact.

## Layer 0 — memory

- Similar work: `common-tab-switcher-for-categories`, `sticky-menu` — both already have OpenSpec cases.
- Known risks: category destinations depend on seeded CMS content; a missing seed reads as a product defect.
- Existing coverage: `qa/tests/Client/FE/smoke/home.spec.ts` covers guest chrome and the switcher order.
- Reusable: `helpers.ts` (`openGuestHome`, `expectHomeMainContentOrder`), profiles `guest` and `player-default`.

## Layer 1 — feature container

- What changes: the home page composes existing capabilities (banner slider, category tab switcher, action row, game sliders) instead of a bespoke page shell.
- Brand scope: `client`.
- Profiles: `guest`, `player-default`.
- Dependencies: CMS page content, games manifest, sticky menu, header, footer.
- Unknown: how many game sliders are published in a given environment — treated as an assumption, not asserted exactly.

## Layer 2 — testing types

- Functional, black box, positive and negative.
- White box at unit level for the block-order mapper.
- Excluded: performance (no new upstream call), security (no new auth surface), accessibility (covered by the visual QA skill).

## Layer 3 — techniques

| Technique | Slice it cuts |
| --- | --- |
| Use case | Guest opens home and scans the page top to bottom |
| Decision table | `profile` × `breakpoint band` → which blocks are visible (action row appears at xs–lg, not xl–2xl) |
| Boundary value analysis | Game sliders: 0, 1, and the maximum published sections |
| Pairwise | `{xs, xl} × {guest, player}` instead of the full matrix |
| Error guessing | Empty CMS collection, missing translation, unseeded category destination |

## Layer 4 — principles and risk

- Risk-based and early testing; defect clustering around CMS-driven content.
- Top risks: unseeded category destination (regression, high likelihood), block order drifting per breakpoint (ux, medium), player chrome leaking into guest view (auth, low likelihood but high impact).
- Order: block composition first, then per-profile chrome, then breakpoint bands.

## Layer 5 — scenario set (must only)

| ID | Scenario | Type | Technique | Level | Destination | Rationale |
| --- | --- | --- | --- | --- | --- | --- |
| S-1 | Block order mapper returns banner → switcher → action row → sliders for the xs–lg band | positive | decision table | `unit` | `apps/client-site/**/*.test.ts` | Pure mapping, no I/O |
| S-2 | Action row is absent in the xl–2xl band | boundary | decision table | `unit` | same | Same mapper, other branch |
| S-3 | Home renders zero game sliders when no section is published | edge | boundary values | `component` | `*.test.tsx` | Rendering with stub data |
| S-4 | Guest home shows burger, logo, `Accede`, `Regístrate` and the guest sticky items | positive | use case | `openspec-mock` | `quality-assurance/test-cases/client/home-page.md` (`TC-BRAND-HOME-001`) | Deterministic with mock profiles |
| S-5 | Player home keeps the same main-content order with player chrome | positive | pairwise | `openspec-mock` | same file (`TC-BRAND-HOME-002`) | Profile difference provable on mocks |
| S-6 | Guest home on the deployed build loads with the required chrome and block order | positive | use case | `e2e-live` | `qa/tests/Client/FE/smoke/home.spec.ts` (`SMK-HOME-001`) | Critical path; proves real CMS content and the deployed build |

## Coverage ladder (AC-2: action row appears only in the xs–lg band)

| Level | Status | Owner | Evidence / action |
| --- | --- | --- | --- |
| `unit` | `covered` | dev | `apps/client-site/src/…/home-blocks.test.ts` — both bands asserted on the mapper |
| `component` | `missing` | dev | Recommend a render test: action row present at xs, absent at xl |
| `api` | `not-applicable` | qa | No endpoint involved; composition is server-rendered from CMS content |
| `openspec-mock` | `missing` | dev | `TC-BRAND-HOME-003/004` — one case per band with mock profiles |
| `e2e-live` | `not-applicable` | qa | Band behavior is deterministic on mocks; a live run adds cost, not signal |

`dev` on the `openspec-mock` row means the developer with their agent, per `methodology/test-budget.md`:
they write and run the OpenSpec case before the PR; QA does not.

Note the inversion: the missing component test is a recommendation for the developer, not a reason to
add a second browser scenario.

## Budget

QA-owned: 0 `api`, 1 `e2e-live` (limit 2) → within limits.
Delegated: 2 `unit`, 1 `component`, 2 `openspec-mock`.

Challenge phase:

- S-4 and S-5 stay on mocks: per-profile composition is deterministic there, and live runs would create real accounts for no extra signal.
- S-6 cannot move down: only the deployed build with live CMS content proves the page composes in production-like conditions.
- No API scenarios: this change adds no endpoint. The storefront reads CMS content already covered by its own contract tests.

Notes: "UI composition change — the base grows on the developer side once the mapper and the
component test land."

## Handoff

- OpenSpec: `TC-BRAND-HOME-001`, `TC-BRAND-HOME-002` → `quality-assurance/test-cases/client/home-page.md`.
- Deferred: both, backend mode `mock required`, pickup `real-user` → `quality-assurance/deferred/index.md`.
- `qa/`: `SMK-HOME-001` only. `SMK-HOME-002` (switcher order) already exists — reused, not duplicated.
- Not promoted to `qa/`: breakpoint matrix and empty-state cases. They fail promotion question 3 — mocks prove them, and live runs would only add cost.
- Recommended to the developer: component render test for the action row (see the ladder above).

## Verdict

`ready_to_implement` — every AC has a `must` scenario; the only open question (number of published sliders) is recorded as an assumption and does not block implementation.
