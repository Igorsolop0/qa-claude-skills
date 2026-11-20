# Playwright rules for browser tests

Read before writing page objects or specs. `AGENTS.md` of the project wins where it says otherwise.

## Locators

Order (stop at the first that is unique and stable): role and name, label, placeholder, visible
text (`exact: true`), test id, a stable `data-*` attribute (`data-slot`, `data-state`), a stable id
or `name`. Never layout classes, utility classes or positional CSS.

- Scope a repeated name to its region (`getByRole('dialog', { name: 'New ticket' }).getByLabel('Project')`)
  instead of `.first()`.
- `nth(i)` only inside a named getter, for a fixed set of identical controls with no name, with a
  comment saying why:

  ```ts
  /** Six unnamed spinbuttons in a fixed order: no role name to tell them apart (finding reported). */
  poolInput(index: 0 | 1 | 2 | 3 | 4 | 5): Locator {
    return this.page.getByRole('spinbutton').nth(index);
  }
  ```

- A clickable element without a role (`<div onclick>`) is an accessibility gap: use its exact text,
  and report the gap.
- Locators live on the page object that owns them. No `locators/` folder, no `*.locators.ts`.

## Assertions

- Web-first: `await expect(locator).toBeVisible()`, `toHaveText`, `toHaveCount`, `toHaveURL`. Never
  `expect(await locator.isVisible()).toBe(true)`: it looks once, too early.
- Exact for values with a shape: money, dates, ids, counts, percentages, emails.
  `toContainText('50')` passes on `500`. Use `toHaveText('€49.99')`; keep `toContainText` for
  partial copy (a heading with a name in it) with a comment.
- Assert the full formatted value (`1,000.00`, `Jan 5, 2026`): the format is part of what the user sees.
- Before `toBeHidden()`, assert something that is present in that state, or the check passes on a
  page that is still loading.
- `.all()` or `count()` on a list only after `toHaveCount(n)`: an empty list makes a loop pass with
  nothing checked.
- Assert the outcome where the feature's user sees it: a customer feature in the customer UI or API,
  an operator feature in the back office. A read the user cannot see is a precondition or a second
  check, never the only proof.

## Waiting

- No `waitForTimeout`, no `waitForLoadState('networkidle')` (apps with sockets never go quiet).
  Wait for an element, a text, a URL, a response.
- A submit is two waits. First the request is accepted (`page.waitForResponse`, or the visible
  state after submit). Then the effect appears, which may need a reload:

  ```ts
  await expect(async () => {
    await page.reload(); // the list reads its data on load
    await expect(ticketsPage.row(title)).toBeVisible();
  }).toPass({ timeout: 30_000, intervals: [2_000, 5_000, 5_000] });
  ```

| Situation | Tool |
|---|---|
| the request a click sends has returned | `page.waitForResponse` |
| a single value changes later (API, page function) | `expect.poll(() => ..., { timeout })` |
| a block must reload to see new data | `expect(async () => { ... }).toPass()` |
| an element appears, no backend involved | `expect(locator).toBeVisible()` |

- A method that `expect.poll` calls stays without `@step`: one step per poll floods the report.
  Put `// eslint-disable-next-line no-restricted-syntax -- polled by expect.poll` above it.
- A longer `timeout` only for a step that is slow by design, with a comment saying why.

## Titles, steps and tags

- The title says what the feature's user can do or see, not how the test does it:
  `Visitor creates a workspace and lands on the ticket list`, not `Clicks submit and checks #tickets`.
- `test.step('…')` per step of the manual case, in the same words, so the report names the failing step.
- When the project links tests to a test-management tool (an id in the title), keep the id the tool
  assigned; never invent one.
- Tags only from `src/config/tags.ts` (`tag: [Tag.smoke, Tag.auth]`). Regression is every test, so
  there is no regression tag. A prod-safe tag, if the project has one, marks only tests that create
  nothing and submit nothing.

## TypeScript in test code

1. **A method carries an intent, not one call.** If deleting the method and inlining its body loses
   nothing, it should not exist.
2. **Helpers and fixtures take what they need and return what they made.** No helper opens its own
   context or reads env vars; the caller passes `page`, a client, the data. A fixture that creates
   data returns it and deletes it after the test.
3. **Domain concepts get types.** A literal union for a closed set (`type Status = 'open' | 'closed'`),
   one interface for fields that travel together (`NewAccount`), types imported from the module
   that defines them (`Schemas['User']`), never redeclared.
4. **A repeated `switch` becomes one map:** `Record<Status, string>` next to the type, so a missing
   member fails the type check.
5. **No `as` casts on test data.** Build valid data through a builder. A deliberately invalid
   payload keeps one narrow cast at the request boundary, with a comment.
6. **Import from the file that defines the thing.** No barrels in page object folders; the one
   exception is `@/fixtures`, which merges the fixtures.
7. **Pure logic goes to `src/utils/`** with a `*.test.ts` next to it, run by the `unit` project:
   a parser, a calculation, a builder invariant a test verdict depends on.

## Data builders

- `test-data/<topic>.ts` returns new input data each call: `newAccount()`, `newTicket(projectId)`.
- Every generated name or email carries the `qa-pw-` prefix through `unique()`, so leftovers on a
  shared environment can be found and filtered.
- Values with business meaning (roles, statuses, plan tiers) stay explicit, never random.
- When the user's data contradicts the screen (a field the form does not offer), keep the original
  as a comment and use what the screen allows; report the difference.

## Anti-patterns: refactor on sight

- A `BasePage` with `click`/`fill`/`waitFor` wrappers, or an abstract test class specs extend.
- A spec that constructs a page object (`new RegisterPage(page)`), calls `createApp`, or acts on a
  locator (`.click()`, `.fill()`).
- `test`/`expect` imported from `@playwright/test` or from one fixture file in a spec.
- Steps that create data at the top of a test instead of a fixture; `beforeAll` that sets up shared
  state every test changes.
- A global test-data file that collects every domain (`testData.ts`).
- Hardcoded URLs in specs or page objects instead of `webUrl()`.
- `{ force: true }`, retries to get green, `try`/`catch` around a step, an `if` around an assertion.
- `.first()`/`.nth()` to silence a strict-mode error instead of narrowing the locator.
- Nested `describe` that wraps one test or only tells a story.
- `@regression`, or a raw `'@…'` tag string.
- A new reporter, a mock switch or a base class added without the user asking.

## A flaky locator: name the failure before changing code

1. **Strict mode:** the locator matches more than one element. Narrow by name, `filter({ hasText })`
   or a parent; not `.first()`.
2. **List without a count:** a loop over `.all()` with no `toHaveCount` first passes on an empty list.
3. **Position on content that moves:** `nth()` on data other people change. Anchor on a name.
4. **Not ready yet:** the element exists but is still animating or hydrating. A web-first assertion
   on the state you need is the wait.
5. **No accessible name:** an accessibility gap. Report it and step down the locator order.
