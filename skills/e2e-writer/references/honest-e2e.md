# Honest browser tests

A browser test is honest when it fails if a user would see the product wrong, and only then.

## Assertions

| Do | Not | Why |
|---|---|---|
| `await expect(row).toBeVisible()` | `expect(await row.isVisible()).toBe(true)` | The first waits for the screen; the second looks once and is early |
| `await expect(row).toContainText('closed')` | `expect(await row.textContent()).toContain(...)` | Same: read once, wrong while the page loads |
| `await expect(rows).toHaveCount(2)` on data you created | `expect(await rows.count()).toBeGreaterThan(0)` | Exact when you control the data |
| Find your item by its unique name | `rows.first()`, `nth(0)` | Other people's data moves positions |
| Assert what the user sees after the action | Assert that the click "worked" | A click always works; the outcome may not |
| Reload or open the page again for "it was saved" | Trust the screen right after saving | The screen can show what was typed without storing it |

A status or another fixed value has two forms: the value in the API (`in_progress`) and the label
on screen ("In progress"). Look the label up once, record the mapping in `CLAUDE.md`, and assert
the label on the element that holds it, not on the whole row.

Before `toBeHidden()` assert something that is present in that state. Otherwise the check passes
on a page that is still loading.

## Never

- **`waitForTimeout`.** Wait for the state: an element, a text, a count. Background work:
  `await expect(status).toHaveText('done', { timeout: 15_000 })`, with the reason in a comment.
- **A condition around an action or an assertion.** `if (await banner.isVisible()) ...` makes
  two different tests out of one. Bring the page into a known state through the API instead.
- **`try` / `catch` around a step.**
- **`{ force: true }` to click through something that covers a button.** A user cannot do that.
- **Retries to get a green run.**
- **An expected text copied from the screen.** It comes from what the test typed or created, or
  from the requirement.
- **Logging in inside a test**, unless the test is about login.
- **Checking in the browser what an API test already checks.** One screen-level refusal at most.

## Data

- Everything the scenario needs before its first click is created through the API.
- Names through `unique()`; the test finds its data by that name.
- The test deletes what it created, also when it fails (`afterAll`, or a fixture).
- Two tests never share one record that either of them changes.
- On a paged or shared list, narrow it first (filter, search) the way a user would.

## Page objects

- Locators and user actions only. No assertions except `expectLoaded()`.
- No method that only wraps one Playwright call with the same name.
- A locator used by one test and nowhere else still belongs in the page object, not in the spec.
- When the screen changes, one class changes. If two classes must change, something is duplicated.

## Reading a red browser test

1. The first line of the error: which locator, which expectation, what was there instead.
2. `error-context.md` next to it: the page as it was at that moment.
3. The trace (`npx playwright show-trace <file>`): the screen before and after each step.

"Element not found" means one of three things, in this order of likelihood: the page was not the
page you thought (a redirect to login), the name on screen differs from the locator, the element
appears later than the step that needs it.
