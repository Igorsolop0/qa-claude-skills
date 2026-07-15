# Anti-pattern catalog

Walk through the test code and flag the following. Categorize each finding by priority (Critical / High / Medium / Low). If a priority bucket is empty, omit it from the report — don't pad.

## Table of contents

- [Critical](#critical) — almost certainly causes problems
- [High](#high) — strong code smell
- [Medium](#medium) — worth fixing but not urgent
- [Low](#low) — nice-to-have / cosmetic
- [Context-aware priority bumps](#context-aware-priority-bumps)

---

## Critical

### 1. `waitUntil: 'networkidle'`

- **Why:** many real sites have background polling (analytics, websockets, telemetry) that prevents networkidle from ever firing → timeout. Also some requests don't affect functional readiness, so waiting for them wastes time.
- **Fix:** wait for a concrete element instead. `await expect(page.getByRole('...')).toBeVisible()` after the navigation.

### 2. Missing `await` on a Playwright async call

- **Why:** floating promise — the test continues past the line, and ordering becomes nondeterministic. Classic root cause of "passes locally, flaky on CI".
- **Fix:** add `await`. Recommend wiring up ESLint with `@typescript-eslint/no-floating-promises` so it gets caught automatically.

### 3. `page.waitForTimeout(N)` with a hardcoded number

- **Why:** sleeping for a fixed time is the textbook flaky pattern. Either too short (flaky on slow CI) or too long (slow suite). Playwright has built-in auto-waiting; this disables it.
- **Fix:** wait for the actual condition — `await expect(...).toBeVisible()`, `await page.waitForLoadState('load')`, or wait for a network response with `page.waitForResponse(...)`.

### 21. `.all()` / `count()` loop with no `toHaveCount` guard

- **Why:** `locator.all()` and `count()` do **not** auto-wait — they return whatever exists at
  call time. On a list that hasn't rendered yet, or is legitimately empty, `all()` returns `[]`,
  the `for…of` body never runs, every assertion inside is skipped, and the test goes **green
  without checking anything**. Same trap with `if (await locator.count() > 0) { … }`. This is a
  false *pass* — the worst failure mode, because a broken feature ships green.
- **Fix:** assert the expected size first with an auto-waiting matcher —
  `await expect(locator).toHaveCount(n)` — *then* iterate. For "at least one", guard with
  `await expect(locator.first()).toBeVisible()` before the loop. Never let the loop body be the
  only assertion.

---

## High

### 4. `beforeAll` / `afterAll` with shared mutable state

- **Why:** Playwright runs tests in parallel worker processes. `beforeAll` runs **once per worker**, not once globally. Any shared variable initialized in `beforeAll` is duplicated per worker, and order between workers is undefined.
- **Fix:** move to `beforeEach` (cheap thanks to browser contexts), or use worker-scoped fixtures, or — better — make each test self-contained.

### 5. Nested `describe` blocks

- **Why:** visual indentation grows, readability drops fast, and hooks defined in outer describes apply to inner tests in non-obvious ways. The "test as living documentation" pattern they were designed for is dead in practice.
- **Fix:** split into separate files. Each file is implicitly its own group.

### 6. `toContainText(...)` where exact match is intended

- **Why:** substring match. `"$100"` passes `toContainText("$1")`. Especially dangerous for prices, balances, currencies, IDs — all over iGaming and fintech.
- **Fix:** `toHaveText(exact)` for exact equality. Reserve `toContainText` for genuinely partial matches and add a comment why.

### 7. Unchecked `response.status()` after `page.goto()`

- **Why:** `goto()` resolves with a 4xx/5xx and does NOT throw. A test that "navigates" to a 500 page and then asserts the page title might still pass on a generic title.
- **Fix:** `const response = await page.goto(url); expect(response.status()).toBe(200);` — at least for navigation to protected/critical pages.

### 8. `click({ force: true })` without justification

- **Why:** `force: true` disables actionability checks (element visible, stable, attached, receiving events). It's a sledgehammer that masks real bugs — buttons that "click" in tests but users can't interact with.
- **Fix:** figure out why the element isn't actionable. Usually it's a covering overlay, animation, or wrong locator. If `force` truly is needed (e.g., scroll-into-view edge case), add a code comment with the reason.

### 9. `toContainText` on a plain string (not a Locator)

- **Why:** `toContainText` is a Locator matcher. Calling `expect('some string').toContainText(...)` is either a type error or silently always passes — depending on setup.
- **Fix:** for plain strings use `toContain` (Jest-style) or `toMatch`/`toEqual`.

### 22. Positional `first()` / `last()` / `nth(i)` on reorderable content

- **Why:** positional locators bind to DOM order, not identity. The moment the list re-sorts —
  new item, async load, a changed default sort — `nth(2)` points at a different row and the test
  asserts against the wrong entity, passing or failing for the wrong reason. Common in tables,
  feeds, leaderboards, transaction lists.
- **Fix:** locate by something stable on the row — `getByRole('row', { name })`,
  `.filter({ hasText })`, a `data-testid`. Reserve positional locators for genuinely identical,
  orderless element sets (e.g. N unnamed inputs) and wrap them in a named accessor with a comment.

### 23. Using `.first()` to silence a strict-mode violation

- **Why:** when a locator matches more than one element, strict mode throws on **actions** — a
  deliberate signal that the selector is ambiguous. `.first()` / `.nth(0)` suppresses it, and the
  test then drives whatever element happens to be first, which is non-deterministic across
  renders. Web-first assertions like `toHaveText`/`toHaveValue` also throw strict-mode violations
  on multi-match; `toBeVisible`/`toBeAttached` instead resolve against any matching node, which
  hides the ambiguity differently — neither outcome is what you want.
- **Fix:** make the locator unique — add an accessible name, `.filter(...)`, or scope to a parent
  container. Treat a strict-mode violation as "my selector is wrong", not "add `.first()`".

---

## Medium

### 10. Locators by raw CSS / XPath when a `getBy*` exists

- **Why:** `getByRole`, `getByLabel`, `getByText`, `getByTestId` are resilient to DOM changes and reflect user intent. `page.locator('div.container > button:nth-child(2)')` breaks on refactor.
- **Priority order:** `getByRole` → `getByLabel` → `getByPlaceholder` → `getByText` → `getByTestId` → CSS as last resort.
- **Fix:** swap to the highest-priority one available. If only CSS works because the app lacks accessibility, flag it as accessibility-debt too.

### 11. `toBeChecked` on non-native checkboxes

- **Why:** works only with `<input type="checkbox">`. Most modern UI uses styled divs with `role="checkbox"` or `aria-checked`. The assertion silently behaves wrong on those.
- **Fix:** `toHaveAttribute('aria-checked', 'true')` or `toBeEnabled()` depending on what you actually mean.

### 12. `page.goto(url)` with `timeout: 0` not overridden

- **Why:** default 0 means "wait the full test timeout" — often 60s. Not infinite, but big. Can mask a hang.
- **Fix:** set `navigationTimeout` explicitly in `playwright.config.ts` (10–30s typical), or pass `timeout` to the specific `goto`.

### 13. Hardcoded URLs instead of `baseURL`

- **Why:** breaks environment switching, leaks prod URLs into the suite, and complicates running the same tests against staging/local.
- **Fix:** set `baseURL` in `playwright.config.ts` and use relative paths in `page.goto('/path')`.

### 14. Hardcoded test data that collides on rerun

- **Why:** fixed email like `newuser@test.com` works the first time, fails the second (already exists). Looks flaky, but it's deterministic and a data-cleanup problem.
- **Fix:** generate a unique value per run — `\`user-\${Date.now()}@test.com\`` — or use a fixture that creates and cleans up the user.

### 15. Test creates a server/chain-side artifact but never surfaces its identifier in the report

- **Why:** when a spec mints a downstream artifact whose ID is only known at runtime — an on-chain address, a created user ID, a transaction hash, an order number, an uploaded file URL — and that ID never lands in `testInfo.annotations` or `testInfo.attach()`, the report becomes a dead end. Whoever opens it later (CI failure triage, flake investigation, "did the test actually do what it claimed") has to dig through `console.log` output, traces, or screenshots to find the value, then paste it into the dApp/admin/DB manually. On long-running suites this is the difference between a 30-second verification and a 10-minute hunt.
- **Fix:** the moment the test learns the identifier (after the URL settles, after the API response, after the success modal), call `testInfo.annotations.push({ type: '<thing>', description: <id-or-url> })` so it renders at the top of the HTML report. Add `testInfo.attach('<thing> url', { body: url, contentType: 'text/plain' })` if you also want a copy-paste attachment. If the same value is needed in multiple specs, do it once in the fixture that produces it — not in each spec.

### 24. Brittle locator chains (extends rule 10)

- **Why:** long CSS/XPath chains like `div > ul > li:nth-child(2) > button` encode layout, so
  any structural refactor breaks them. Playwright offers composition that survives refactors:
  `.filter({ hasText })`, `.and()`, `.or()`, `getByRole(...).getByText(...)`.
- **Fix:** prefer `getBy*` + `.filter()` / `.and()` / `.or()` over hand-built chains. If a
  positional step is unavoidable, isolate it in a named POM getter with a comment explaining why.

### 25. XPath against components rendering into shadow DOM

- **Why:** `getBy*` and CSS pierce open shadow roots; **XPath does not**. An XPath selector
  silently fails to find elements inside web components — common in design-system or
  widget-heavy apps, and the failure looks like a flake rather than a wrong selector.
- **Fix:** use `getBy*` or CSS for anything that may render into shadow DOM. If you see XPath
  used against a component that renders into shadow DOM, flag it as broken-by-design, not just
  brittle.

---

## Low

### 16. `.spec.ts` vs `.test.ts` inconsistency

- Cosmetic but: pick one convention across the project. The "spec" naming dates back to a defunct "tests as specification" idea.

### 17. Comments explaining `await`

- If you see `// await is needed here because async` — that's noise. Remove.

### 18. Captured response that's never asserted on

- `const response = await page.goto(...)` followed by no `response.status()` check is a misleading lint signal. Either drop the variable or check the status.

### 19. Global test-data file (`testData.ts` / `fixtures.ts` / `data.ts`)

- **Why:** when one file aggregates presets/users/payloads from multiple unrelated flows, every spec imports the union, every change touches the same file, and the test data becomes a god object. Renaming a single preset cascades into specs that should have nothing to do with it.
- **Fix:** colocate test data with the flow that owns it (`tests/<flow>/<flow>.presets.ts`). Lift only true cross-flow atoms (durations, enums, hard ceilings) into domain-scoped `src/constants/<domain>.ts` — still not one mega-file.

### 20. Separate `locators/` folder or `*.locators.ts` file

- **Why:** extracting locators away from the Page Object that owns them adds an import edge without payoff — the locator and the action that uses it now drift independently, and you can't see in one place what a page exposes. The "swap locators per environment" use case rarely materialises.
- **Fix:** locators are `get`-properties on the POM/Component class. If you need environment-conditional selectors, branch inside the getter, not via a parallel file tree.

---

## Context-aware priority bumps

When the user mentions any of: **money, balances, transactions, KYC, iGaming, fintech, payments, wallets**, raise the priority of these findings by one level (Medium → High, High → Critical):

- `toContainText` on numeric values (rule 6) — substring match on `"950"` can match `"9509"`.
- Unchecked `response.status()` (rule 7) — silent 5xx on a wallet page can keep tests green while real users see a broken balance.
- Hardcoded URLs (rule 13) — accidentally pointing staging tests at prod with real money is a Sev-1 incident.
- `.all()` / `count()` loop with no `toHaveCount` guard (rule 21) — a silent false pass over a
  balances / transactions / bets list keeps the suite green while the feature is broken. In these
  domains an empty-list false pass is a Critical, not a Critical-only-in-theory.

State the bump explicitly in the report so the reader knows you weighted it.
