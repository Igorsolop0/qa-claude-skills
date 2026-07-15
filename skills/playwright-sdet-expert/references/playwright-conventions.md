# Playwright conventions — locators, POMs, presets, assertions, flaky diagnostics

Read this file when writing a spec, creating a Page Object, adding presets, or fixing a flaky
locator. When the repo has a reference flow, mirror it.

---

## Locator priority

Use Playwright locators in this exact order. Stop at the first that produces a unique, stable
selector. Do NOT skip to CSS just because it's faster to type.

1. `page.getByRole(role, { name })`
2. `page.getByLabel(...)`
3. `page.getByPlaceholder(...)`
4. `page.getByText(..., { exact: true })`
5. `page.getByTestId(...)` — only if `data-testid` exists on the element
6. CSS selector — last resort, anchor on a stable attribute (`[name=...]`, `[data-*]`), never
   on layout classes, **never** `nth(i)` or positional

If the live UI has an accessibility gap (e.g. clickable `<div>` without `role="button"`), prefer
`getByText('...', { exact: true })` and flag the gap in the exploration report so a frontend
engineer can add proper semantics.

**Allowed exception:** when the DOM exposes a set of identical-role elements with no accessible
name (e.g. multiple `<input role="spinbutton">` for a distribution/percentage grid), `.nth(i)`
is acceptable *if wrapped in a named getter* on the POM with a comment explaining why:

```ts
poolInput(index: 0 | 1 | 2 | 3 | 4 | 5): Locator {
  // Six unnamed spinbuttons in a fixed order — see gap in exploration report.
  return this.page.getByRole('spinbutton').nth(index);
}
get platformInput()  { return this.poolInput(0); }
```

## Page Object pattern (per-flow, no inheritance hierarchy)

There is **no `BasePage`**, no `PageHolder`, no abstract base classes. Each flow has a single
`<Flow>Page` class that takes `page: Page` in the constructor:

```ts
export class LoginPage {
  constructor(readonly page: Page) {}

  async goto(baseUrl: string) {
    await this.page.goto(new URL('/login', baseUrl).toString());
    await expect(this.heading).toBeVisible();
  }

  get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Sign in' });
  }

  // high-level actions group locators into intent
  async loginAs(preset: LoginPreset) { /* ... */ }
}
```

- Locators are `get`-properties returning `Locator`. Never store `Locator` instances on `this` —
  they're lazy already. Never extract locators into a separate `locators/` folder or
  `*.locators.ts` file — they belong on the POM/Component class that owns the interaction.
- **Naming.** Class keeps the `Page` / `Component` suffix (`LoginPage`, `HeaderComponent`) —
  useful for IDE search and grep. File name is kebab-case + suffix (`login.page.ts`,
  `header.component.ts`) — do NOT duplicate `Page`/`Component` in the filename.
- High-level actions can take a `preset` and stamp it onto the form in one pass.
- POs MAY contain `expect(...)` calls inside `goto()`/section-load helpers as readiness probes.
  Test-level outcome assertions still live in the spec.
- Cross-flow surfaces (header, global modals, toasts) live as `*.component.ts` under
  `tests/components/` and are composed into specs alongside the flow POM.

Worked example of a component (mirror this for new cross-flow surfaces):

```ts
// tests/components/header.component.ts
import { type Page, type Locator } from '@playwright/test';

export class HeaderComponent {
  constructor(readonly page: Page) {}

  get loginButton(): Locator { return this.page.getByRole('button', { name: 'Log in' }); }
  get userMenu(): Locator    { return this.page.getByRole('button', { name: 'Account menu' }); }

  async isSignedIn(): Promise<boolean> {
    return !(await this.loginButton.isVisible());
  }
}
```

Compose it in a spec alongside the flow POM: `const header = new HeaderComponent(page);`.

### Adding a new Page Object to an existing flow

1. Add the class to the existing `tests/<flow>/<flow>.page.ts` if the surface is part of the
   same user journey; otherwise create a new flow folder.
2. Use locator getters, not stored locators.
3. Group locators by UI section with `// ───── Section name ─────` comment dividers.
4. Add high-level actions that take a preset slice and stamp it onto the UI. Keep them
   composable — `fillProfileSection` + `fillPreferencesSection` + `fillFromPreset`
   orchestrator.

## Presets — typed test data, faker allowed for dynamic fields

**Presets are per-flow, NOT global.** Each flow owns its own `<flow>.presets.ts` next to its
spec and POM. Never create a single `testData.ts` / `fixtures.ts` / `data.ts` god file at the
project root or under `src/` — that pattern collapses unrelated domains into one editing
hotspot and forces every spec to import the union.

`<flow>.presets.ts` exports a `<Flow>Preset` type plus one or more named presets. The type
**must mirror the full form/contract shape**, not just the minimal required fields — that way a
single preset is a full snapshot a test can stamp onto the UI in one pass. Keep notes about
requirements-vs-UI contradictions inline as JSDoc above the preset.

Shared atoms (durations, enums, ceilings reused across flows) live in
`src/constants/<domain>.ts` — one file per domain (`user.ts`, `billing.ts`, `courses.ts`),
again not one mega-file.

**Faker** (`@faker-js/faker`) is fine for fields where uniqueness across runs matters —
typically titles/names/identifiers that would otherwise collide in a shared test environment.
Rules:

- **Always prefix faker-generated identifiers with a stable, traceable tag** so artifacts
  created by tests are filterable. Convention: `<ticket-id>-e2e-pw-<faker-value>`. Example:
  `` `edu-101-e2e-pw-${faker.lorem.word()}` ``.
- Centralize the prefix as a `const` in the preset file (e.g. `USER_NAME_PREFIX`) — never
  inline the literal twice.
- Generate at module load so a single test run uses one stable value across assertions;
  re-imports across processes (separate runs) get fresh values. If a test needs *per-test*
  freshness, generate inside the test.
- Faker output that is rendered into UI should remain ASCII-safe and short — prefer
  `faker.lorem.word()`, `faker.string.alphanumeric(8)`, `faker.number.int(...)` over
  locale-heavy generators.
- Do NOT use faker for fields that have business semantics (roles, grades, plan tiers,
  enum-like values) — those stay as explicit values in the preset.

When a user-supplied preset contradicts the live UI (e.g. a field is disabled given the current
form state), keep the original as `userProvidedPreset` for traceability and create an adjusted
`minimumPreset` the test actually uses. Annotate why.

## Assertion strictness — exact match for money, dates, IDs, quantities

Locator priority governs how you *select*; this governs how you *assert*. Any value with a
schema-like shape — prices, dates, IDs, counts, percentages, email addresses — must be asserted
**exactly**, not by substring. Substring matching silently lies on all of them.

- `toContainText('50')` passes on `'500'`; `toContainText('5')` passes on `'15.5%'`; a
  truncated ID `'ABC12…'` is a substring of many.
- Default to **exact** assertions: `await expect(locator).toHaveText('€49.99', { exact: true })`
  (or `toHaveValue` / `toHaveAttribute` for inputs and data attributes).
- Reserve `toContainText` for genuinely partial UI copy (a heading with a dynamic user name),
  and add a one-line comment why.
- For numbers rendered with formatting (`1,000.00`, `12.5%`, `Jan 5, 2026`), assert the full
  formatted string — the formatting *is* part of the contract the user sees.

## Diagnosing a flaky locator (the "fix flaky locator" trigger)

When asked to fix a flaky locator, don't just swap selectors — walk this ladder top-down and
name the actual failure mode before changing code:

1. **Strict-mode violation** — the locator matches >1 element. Playwright throws on action; on
   assertion it can resolve to the wrong node. Fix: narrow with an accessible name, a
   `.filter({ hasText })`, or scope to a parent — not `.first()` (that hides the ambiguity).
2. **`.all()` / `count()` on a list with no guard** — iterating `await locator.all()` or
   branching on `count()` passes vacuously when the list is empty (0 elements → loop body never
   runs → green). Gate with `await expect(locator).toHaveCount(n)` first.
3. **Positional `nth()/first()/last()` on reorderable content** — flakes when order changes
   between runs. Allowed only inside a named POM getter for stable identical-role sets (locator
   priority exception); otherwise anchor on a name.
4. **Race / animation** — the element exists but isn't stable yet. Use a web-first assertion
   (`toBeVisible`/`toBeEnabled`) as the wait; never `waitForTimeout`. For state that requires
   backend eventual consistency, see `references/async-waits.md`.
5. **Non-unique role with no accessible name** — the app has an a11y gap. Flag it in the
   exploration report and fall back per the locator priority ladder above.
