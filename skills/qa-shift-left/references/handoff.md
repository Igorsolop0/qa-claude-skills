# Handoff: where each scenario lands

The plan is worthless until each scenario has a home. Use the homes the project already has. Never
create a new test location when an existing one fits.

## Find the project's conventions

Before writing any file, look for where this project keeps tests and plans:

1. `CLAUDE.md`, `AGENTS.md`, `README`, `CONTRIBUTING` — they often name the test folders and the
   case or plan format.
2. Existing test-plan or test-case folders (`docs/`, `test-plans/`, `<tests dir>/`, or a change
   folder with a QA section) — copy the layout and the id scheme you find.
3. The test-management tool the team uses, if any — carry its case id as `<test-management id>`.

No convention found: write the plan to `test-plan.md` next to the change document (or the working
directory when the input is an issue or pasted text), or print it in the reply.

## Destination per level

| Level | Destination | Format | Executed by |
| --- | --- | --- | --- |
| `unit`, `component` | The workspace next to the code | The project's unit-test format | CI on every PR |
| `api` (stubbed backend) | The service's own test folder | The project's API-test format | CI on every PR |
| `api` (live) | `<tests dir>/api/<domain>/` | Live API contract spec | QA run against a deployed environment |
| `mocked-e2e` | The project's test-case location, or the "Mocked cases" section of `test-plan.md` | Markdown case: id, steps, expected | The developer (or their agent) before the PR |
| `e2e-live` | `<tests dir>/e2e/` | Browser spec | QA run against a deployed environment |

## Writing test cases

Follow the project's own case template when it has one. Otherwise use this minimum:

- One scenario in the spec → exactly one case id (1:1). Never collapse several scenarios into one id,
  and never add cases the spec does not back. The number of cases follows the spec, not the 5–15
  matrix guide.
- Ids are stable and unique to this change, for example `TC-<AREA>-<CHANGE-SLUG>-NNN`. Scenario titles
  match the spec exactly.
- Each case has: the source requirement and scenario, category, required or optional, preferred
  check, access profile, backend mode (mock or live), preconditions, and numbered steps with
  expected results.
- Never record execution results in the case file. Results belong in a separate run report.

The plan itself holds coverage intent, ids, required checks, and the post-implementation run plan.
No executable steps and no results there.

## Deferred register

Any case that can only pass against mocks at authoring time goes into a "Deferred" list in the plan,
with a pickup condition (for example "real test user available" or "staging data seeded"). It keeps
its id for the later real-data run. Mocked smoke never counts as complete coverage.

**This is the bridge into the live suite.** When a deferred case is picked up with real data, the
natural home is a live spec, if the behavior is on the critical path. Otherwise it is re-run manually
once and stays a documented case.

## What earns a live spec

Promote to the live suite only when all of these hold:

1. The behavior is on the critical path: the flows the business cannot work without (for a web shop:
   sign-up and login, search, checkout, payment), or a backend contract the frontend cannot work
   without.
2. It would still be worth running next month — live specs are regression assets, not one-off proofs.
3. Mocks cannot prove it: a real session, real catalogue, real API gateway, or real content is required.
4. It can run without manual setup and without polluting production data beyond a disposable test
   account.

If a scenario fails any of these, keep it as a mocked case. The live suite must stay small enough to
run often; every spec added there is a recurring cost.

Trace the link in both directions: the live spec title carries the case id and the
`<test-management id>`, and the test-management case points back at the requirement it came from.

## Checklist before you finish

- [ ] Every scenario has a destination from the table above.
- [ ] Every `e2e-live` scenario passed the four promotion questions.
- [ ] Mock-only cases are listed in the deferred register with their ids.
- [ ] Ids are stable and reused; no parallel case was invented for existing coverage.
- [ ] The variant scope (or `all variants`) is named on every case.
