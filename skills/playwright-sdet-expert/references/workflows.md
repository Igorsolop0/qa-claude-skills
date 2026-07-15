# Workflows — new flow, new Page Object, spec design

Read this file when starting work on a new test flow (requirements → exploration → spec), or
when extending an existing flow with a new Page Object.

---

## Requirements sources — where to look first

Before touching the UI, gather the source of truth:

- **PRD / Jira / Linear ticket** — the "what the user should be able to do".
- **Figma / design spec** — copy, states, error messages, empty states.
- **API contract** (Swagger/OpenAPI, GraphQL schema) — request/response shape; a good source
  for edge-case data (min/max, enum values).
- **Existing specs in adjacent flows** — the fastest way to learn the team's real conventions.

When a source is missing (no design for the error state, no ticket describing empty state),
note it in the exploration report as a coverage gap rather than silently guessing.

## Workflow: create a test for a new flow

1. **Requirements first.** Read the PRD/ticket/design/API contract. Write what you learned
   into `exploration/<flow>/<flow>.md` under `## Expected Behavior`.
2. **Explore the UI.** Walk the flow in the app manually (or via `agent-browser` / the
   team's UI-exploration tool). Capture screenshots into `exploration/<flow>/NN-<state>.png`
   and accessibility snapshots into `NN-<state>.json` if useful (keep binary artifacts
   gitignored; commit only the `.md` report).
3. **Write the gap analysis.** In `exploration/<flow>/<flow>.md`, document what the UI does vs.
   what the requirements say, including accessibility gaps (missing roles, missing labels) you
   observed. Always include a `Gap Analysis` section — write `none found ✓` if nothing
   diverged.
4. **Decide the locator map.** For each interaction the test will perform, pick the highest
   locator from the priority ladder (see `references/playwright-conventions.md`) that works.
   Note any `nth()` exceptions in JSDoc on the getter.
5. **Scaffold the flow folder:** `tests/<flow>/<flow>.page.ts`, `<flow>.presets.ts`,
   `<flow>.spec.ts`, plus `assets/` if you need static files (uploads, JSON fixtures).
6. **Write the POM first.** Class with `constructor(readonly page: Page)`, `goto(baseUrl)`,
   locator getters, high-level actions. Mirror the structure of the team's reference flow.
7. **Write presets next.** Full-shape type, named exports, JSDoc explaining
   requirements-vs-UI contradictions. Faker only where uniqueness matters, with the
   `<ticket-id>-e2e-pw-` prefix (see presets section in
   `references/playwright-conventions.md`).
8. **Write the spec last.** Import `test, expect` from the team's shared fixture entrypoint
   (`tests/fixtures/*` or `@playwright/test` directly). Use `test.step` for Arrange/Act/Assert
   grouping when it aids readability; skip the ceremony for a short test.
9. **Self-check:**
   - No `waitForTimeout`.
   - No `browser/context/page.close()` in a shared-context setup.
   - `BASE_URL` read from env with a sane default.
   - Locators follow the priority ladder; any `nth()` is wrapped + explained.
   - Assertions on values with schema-like shape (money, dates, IDs) use `{ exact: true }`.
   - `npx tsc --noEmit` is clean.
   - `npx playwright test <flow>` passes locally.

## Workflow: add a new Page Object to an existing flow

1. Add the class to the existing `tests/<flow>/<flow>.page.ts` if the surface is part of the
   same user journey; otherwise create a new flow folder (see workflow above).
2. Use locator getters, not stored locators.
3. Group locators by UI section with `// ───── Section name ─────` comment dividers.
4. Add high-level actions that take a preset slice and stamp it onto the UI. Keep them
   composable — `fillProfileSection` + `fillPreferencesSection` + `fillFromPreset`
   orchestrator.

## Workflow: extract a cross-flow component

Signal that a UI surface has outgrown a single flow POM:

- Two or more flow POMs re-declare the same locators (Header, GlobalToast, ConfirmModal).
- A locator is copy-pasted between specs.

Extract into `tests/components/<name>.component.ts` following the pattern in
`references/playwright-conventions.md`. Consumers compose it in the spec:
`const header = new HeaderComponent(page);`.
