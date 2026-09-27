# Handoff: where each scenario lands

The plan is worthless until each scenario has a home. The repo owns two of them, plus the workspace
unit tests. Never create a third.

## Destination per level

| Level | Destination | Format | Executed by |
| --- | --- | --- | --- |
| `unit`, `component` | The workspace next to the code | `*.test.ts` / `*.test.tsx`, run with `bun test` | CI on every PR |
| `api` (mock) | `packages/bff/**` tests | `*.test.ts` | CI on every PR |
| `api` (live) | `qa/tests/<Target>/API/<Domain>/*.spec.ts` | Playwright, `api-contract-writer` skill | QA run, `bun run --cwd qa e2e:*:api` |
| `openspec-mock` | `openspec/changes/<change>/quality-assurance/test-cases/<brand>/<module>.md` | Markdown case with `local_id`, steps, expected | The developer's agent before the PR, via `portal-openspec-run-test-cases` |
| `e2e-live` | `qa/tests/<Target>/FE/smoke/*.spec.ts` | Playwright, `playwright-sdet-expert` skill | QA run, `bun run --cwd qa e2e:client:fe` |

## Writing OpenSpec cases

Follow the repository write contract in `openspec/schemas/portal-workflow/templates/test-cases.md` and
`.cursor/rules/qa-spec-only.mdc`. It is inherited as-is for every `openspec_change` input:

- File header: `Status: draft` and `Owner: agent` — never a person or a free-text role.
- One `#### Scenario:` in the spec → exactly one case id (1:1). Never collapse several scenarios into one
  id, and never add cases the spec does not back. The number of cases follows the spec, not the
  5–15 matrix guide.
- `local_id` is `TC-<BRAND>-<CHANGE-SLUG>-NNN` with a slug unique to this change; scenario titles match the
  spec exactly.

Each case also needs: the source requirement and scenario, category, `Required`, preferred check,
execution context, access profile, backend mode, preconditions, and numbered steps with expected
results. Never record execution results in the case file — those belong
in `quality-assurance/dev-verification/`.

The plan itself goes to `quality-assurance/plan.md`: coverage intent, ids, required checks, and the
post-implementation run plan. No executable steps and no results there.

## Deferred register

Any case that can only pass against mocks at authoring time goes into
`openspec/changes/<change>/quality-assurance/deferred/index.md` with a pickup token, and it keeps its
`local_id` for the later real-data run. Mock smoke never counts as complete coverage.
Harvest entry point: `openspec/qa-deferred/README.md`.

**This is the bridge into `qa/`.** When a deferred case is picked up with real data, the natural home
is a live Playwright spec — if the behavior is on the critical path. Otherwise it is re-run manually
once and stays in OpenSpec.

## What earns a live spec in `qa/`

Promote to `qa/tests/**` only when all of these hold:

1. The behavior is on the critical path: home, category, game launch, auth, deposit, bonus claim, or a
   backend contract the storefront cannot work without.
2. It would still be worth running next month — live specs are regression assets, not one-off proofs.
3. Mocks cannot prove it: real session, real catalogue, real gateway, or real CMS content is required.
4. It can run without manual setup and without polluting production data beyond a disposable test account.

If a scenario fails any of these, keep it as an OpenSpec mock case. `qa/` must stay small enough to
run often; every spec added there is a recurring cost.

Trace the link in both directions: the live spec title carries the smoke id (`SMK-…`) and the
Testomat id, and the Testomat case points back at the OpenSpec requirement it came from.

## Checklist before you finish

- [ ] Every scenario has a destination from the table above.
- [ ] Every `e2e-live` scenario passed the four promotion questions.
- [ ] Mock-only cases are listed in the deferred register with their ids.
- [ ] Ids are stable and reused; no parallel case was invented for existing coverage.
- [ ] The brand scope is named on every case (`brand-a`, `brand-b`, or `cross-brand`).
