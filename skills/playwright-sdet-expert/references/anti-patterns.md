# Anti-patterns — refactor on sight

Read this file when reviewing test code, debugging a flaky spec, or sanity-checking a generated
patch. Each bullet maps to a rule in `SKILL.md` or one of the other reference files; the cross-
reference tells you where the positive convention lives.

---

- ❌ `page.waitForTimeout()` anywhere — use web-first assertions
  (`expect(...).toBeVisible()`, `toBeEnabled()`, `toHaveURL(...)`, `expect.poll`,
  `page.waitForResponse`).
- ❌ Hardcoded URLs (`http://localhost:3000/...`, staging URLs) in specs or POMs — read
  `process.env.BASE_URL` with a sane default in one place (the POM's `goto`).
- ❌ `page.goto` followed by `waitForLoadState('networkidle')` — apps with long-lived sockets
  (analytics, feature flags, chat) hold connections open indefinitely; this hangs. Wait for a
  concrete UI signal instead (`toBeVisible` on the first stable element).
- ❌ `browser.close()` / `context.close()` / `page.close()` in a test or fixture when the
  context is intentionally long-lived (persistent context, user-owned browser, remote CDP) —
  it kills the shared session.
- ❌ `nth(i)` outside a named POM getter (see locator priority exception in
  `references/playwright-conventions.md`).
- ❌ CSS class selectors (`.btn-primary`, `.MuiButton-root`, Tailwind utility chains) — these
  break on theme changes and refactors. Use role/text/testid first.
- ❌ Selectors based on user-specific display strings (a full name, an email prefix) unless
  that user is deterministically seeded — those change per environment.
- ❌ Adding envalid / zod / page-object base classes without the user explicitly asking.
  (Faker is fine — use it per the presets section of `references/playwright-conventions.md`.)
- ❌ Using faker without the `<ticket-id>-e2e-pw-` prefix tag on identifiers written to a
  shared test environment.
- ❌ Writing the test before reading the requirements — the workflow is
  requirements → UI exploration → gap analysis → spec (see `references/workflows.md`).
- ❌ Global test-data file (`testData.ts`, `fixtures.ts`, `data.ts`) that aggregates presets
  from multiple flows — god-object anti-pattern. Presets are per-flow (`<flow>.presets.ts`);
  shared atoms live in domain-scoped `src/constants/<domain>.ts`.
- ❌ Separate `locators/` folder or `*.locators.ts` file. Locators live as `get`-properties on
  the Page Object / Component class that owns the interaction — extracting them adds an
  import edge with zero payoff.
- ❌ Duplicating `Page` / `Component` in the filename (`LoginPage.page.ts`,
  `HeaderComponent.component.ts`). Kebab-case + single suffix only.
- ❌ Adding Allure / JUnit / any third-party reporter. Playwright's built-in HTML reporter is
  the default; new reporters require an explicit ask.
- ❌ Asserting outcome state immediately after a form submit whose backend is async (job
  queue, eventual consistency, cache warm-up) — passes on fast environments, flakes on slow
  ones. Use `expect.poll` / `toPass` (see `references/async-waits.md`).
- ❌ `toContainText` / substring assertions on prices, dates, IDs, counts, percentages, email
  addresses — `'50'` matches `'500'`. Use `toHaveText({ exact: true })` (see assertion
  strictness in `references/playwright-conventions.md`).
- ❌ `.first()` / `.nth()` used to silence a strict-mode violation instead of narrowing the
  locator — hides ambiguity and picks a non-deterministic node (see flaky-locator diagnostics
  in `references/playwright-conventions.md`).
- ❌ Looping `locator.all()` or branching on `count()` without a preceding `toHaveCount`
  assertion — vacuously green on an empty list (see flaky-locator diagnostics in
  `references/playwright-conventions.md`).
- ❌ `BasePage` / `PageHolder` / abstract test class hierarchies. Playwright fixtures are the
  composition primitive — use `test.extend`.
- ❌ Nested `test.describe` blocks that only wrap a single test, or `describe` used for
  narrative grouping — flat suites read better and don't nest hooks.
- ❌ `beforeAll` that establishes shared, mutable state (a logged-in user, a seeded record)
  used by every test in the file — tests become order-dependent. Prefer a fixture per real
  need; use `beforeEach` for state that must be reset.
