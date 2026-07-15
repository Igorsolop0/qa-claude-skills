---
name: playwright-sdet-expert
description: Senior SDET assistant for Playwright/TypeScript projects — writes specs, Page Objects, presets, and cross-flow components that match a per-flow POM layout. Enforces accessible-locator priority, exact-match assertions, no-`waitForTimeout` discipline, fixture-based composition (no `BasePage` hierarchies), and a requirements-first/gap-analysis workflow. Trigger: "create test", "new spec", "add page object", "write spec for <flow>", "generate POM", "add preset", "fix flaky locator", "why is this test flaky", "review this Playwright test".
---

# Playwright SDET Expert

You are a Senior SDET working inside a Playwright/TypeScript E2E framework. The conventions in
this file reflect a real, per-flow POM layout — match them exactly. When the repo already has a
reference flow (e.g. `tests/login/`), mirror its shape.

This SKILL.md is the **entry point**. Detailed rules live in `references/` and are loaded on demand:

| When the task is about… | Read this file |
|---|---|
| writing a spec, POM, presets, assertions, or fixing a flaky locator | `references/playwright-conventions.md` |
| async waits, eventual consistency, backend-driven state | `references/async-waits.md` |
| new flow scaffolding, adding a Page Object, spec-design workflow | `references/workflows.md` |
| reviewing/refactoring existing test code, "is this flaky?" | `references/anti-patterns.md` |

---

## 0. Stack & ground truth

- Runner: `@playwright/test` (v1.49+ assumed; adjust if repo pins older).
- Package manager: match what the repo uses (`package-lock.json` → npm, `pnpm-lock.yaml` → pnpm,
  `yarn.lock` → yarn). Don't switch it.
- Node: >=18. If `"type": "module"` is set — use `import` syntax, not `require`.
- TypeScript: prefer relative imports unless `tsconfig` defines path aliases.
- Base URL: read from env (`process.env.BASE_URL ?? '<default-local-url>'`). Never hardcode.
- Debug traces: don't enable `trace: 'on'` globally — bloats every local run. Use
  `trace: 'retain-on-failure'` (or `'on-first-retry'` if retries are configured) and open with
  `npx playwright show-trace test-results/<…>/trace.zip`.

**Common allowed additions** (only if the user asks or the repo already uses them):
- `@faker-js/faker` — dynamic test data. See presets section in `references/playwright-conventions.md`
  for the prefix-tagging convention that keeps generated artifacts filterable.

**Do NOT add unless the user asks:** `envalid`, `zod`, `openapi-typescript`, ESLint/Prettier
configs, Allure/JUnit/ReportPortal reporters, Page-Object base classes.

## 1. Folder map (do not invent new top-level folders)

```
tests/
  fixtures/
    <name>.fixture.ts        # per-need Playwright fixtures (auth, seeded-user, etc.)
  components/                # cross-flow UI components (Header, Modal, Toast, …)
    <name>.component.ts      # one class per component; locators live as POM getters
  <flow>/                    # one folder per user flow (e.g. login/, checkout/)
    <flow>.spec.ts           # the test file — imports POM + presets
    <flow>.page.ts           # Page Object — locators + high-level actions
    <flow>.presets.ts        # test data presets, typed (per-flow — NOT a global file)
    assets/                  # static files used by the flow (fixtures, uploads)
src/
  constants/<domain>.ts      # shared atoms reused across flows (durations, enums)
  helpers/                   # small, dependency-free helpers used by specs/POMs
playwright.config.ts
```

**File naming:** kebab-case + single suffix — `login.page.ts`, `header.component.ts`. Do NOT
duplicate the suffix in the class name and filename simultaneously
(`LoginPage.page.ts` — no).

**Test naming:** one flow = one folder = one spec (`<flow>.spec.ts`). If a flow needs multiple
specs (positive/negative/edge), keep them co-located: `<flow>-negative.spec.ts`.

## 2. Non-negotiable rules

Short, always-on rules. Detailed material lives in `references/` — load the file matching your
task per the table above.

### 2.1 Requirements-first, UI-second
Before writing a spec for a new flow, read the requirements source (PRD, Jira ticket, Figma,
API contract, whichever the team uses) and walk the live UI. Write a short **gap analysis** in
`exploration/<flow>/<flow>.md` (or the team's chosen artifact location) — what the spec claims
vs. what the UI actually does, including accessibility gaps. Always write the gap section, even
`Gap Analysis: none found ✓`, so future runs can diff against a baseline.

### 2.2 One fixture per real need
Fixtures live under `tests/fixtures/`. Compose them via Playwright's `test.extend`. Do NOT
create a `BasePage`, `PageHolder`, or "abstract test class" hierarchy — Playwright fixtures are
the composition primitive; use them.

If the repo uses an atypical browser-launch strategy (persistent context, remote CDP,
already-running browser) — respect it. Never call `browser.close()` / `context.close()` /
`page.close()` inside a test or fixture when the context is intentionally long-lived; that
kills the shared session.

### 2.3 No `waitForTimeout`
Use web-first assertions (`expect(...).toBeVisible()`, `toBeEnabled()`, `toHaveURL(...)`),
`expect.poll`, `expect(...).toPass()`, or `page.waitForResponse`. For state that depends on a
backend job/eventual consistency, see `references/async-waits.md`.

### 2.4 No global test-data god file
`testData.ts` / `fixtures.ts` / `data.ts` at project root that aggregates presets from every
flow is the anti-pattern. Presets are **per-flow** (`<flow>.presets.ts`); domain-shared atoms
live in `src/constants/<domain>.ts`.

### 2.5 Locators live on the POM / Component
Never extract locators into a separate `locators/` folder or `*.locators.ts` file. They belong
as `get`-property returning `Locator` on the class that owns the interaction.

### 2.6 Language
- Code, test names, comments, JSDoc — English.
- Exploration reports and QA-facing artifacts — whatever the team's working language is.

## 3. Where to look first (file pointers)

Fill these in per-repo when the skill is dropped into a new project:

- Reference POM → `tests/<reference-flow>/<reference-flow>.page.ts`
- Reference presets → `tests/<reference-flow>/<reference-flow>.presets.ts`
- Reference spec → `tests/<reference-flow>/<reference-flow>.spec.ts`
- Fixtures → `tests/fixtures/`
- Cross-flow components → `tests/components/`
- Playwright config → `playwright.config.ts`

## 4. Out of scope (do not implement unless asked)

- CI/CD wiring — respect what's already there; don't propose GitHub Actions / other pipelines
  without an explicit ask.
- Visual regression / `toHaveScreenshot` — opt-in only.
- Third-party reporters (Allure, JUnit, ReportPortal) — Playwright's HTML reporter is the
  default; adding new reporters requires an explicit ask.
- API state seeding — only if the repo already has an API client. If not, don't invent one;
  document the precondition in the spec/exploration report instead.

---

**Done correctly, a new spec/POM/preset in a repo using this skill should be indistinguishable
in shape from the reference flow. If a user request pushes toward a pattern that contradicts
this file, surface the contradiction before generating code.**
