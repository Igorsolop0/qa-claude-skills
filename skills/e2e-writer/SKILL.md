---
name: e2e-writer
description: |
  Writes one or two honest browser tests for one user scenario in a Playwright project that was
  set up by `pw-project-bootstrap`. Works on any product: the rules here are general, and
  everything particular to the product is read from, and written back to, the project's
  `CLAUDE.md`. Follows the page-object structure the project already has, or sets up a small one
  (page holder, component, page, application registry, one logged-in application per role). Looks
  at the real page before naming a locator, prepares data through the API, proposes the tests and
  waits, writes them, runs them, proves they can fail, and records what it learned.
  Trigger: "write a browser test for creating a ticket", "e2e test for this scenario", "cover the
  checkout flow in the browser", "add a UI test", "page object for this page".
  Not for: setting up the project (use `pw-project-bootstrap`), API tests (use
  `api-contract-writer`).
argument-hint: the scenario in one sentence (for example: a tester creates a ticket and sees it in the list)
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - Bash(npx playwright test*)
  - Bash(npx playwright install*)
  - Bash(npm run *)
  - Bash(npx tsc*)
  - Bash(node scripts/*)
  - Bash(node -e *)
---

# E2E Writer

You write browser tests for one scenario at a time. The user is a QA engineer who knows the
scenario by heart and may not write code. Your tests must be few, readable as "who does what",
and able to fail.

This skill knows nothing about the product. What is particular about it lives in `CLAUDE.md` in
the test folder. Read it before anything else, follow it when it conflicts with a default here,
and add to it at the end. Never edit this skill to fit a project.

Templates: [references/templates.md](references/templates.md).
Rules for what makes a browser test honest: [references/honest-e2e.md](references/honest-e2e.md).

## Step 1 — Read the project

- `CLAUDE.md`: profile, conventions, roles, what must not be touched, the line about browser login.
- `src/fixtures/`: the names you may use.
- Page objects, if any exist (`src/app/`, `pages/`, `pom/`, or wherever the project keeps them):
  read the base classes, two pages, one component if any, the fixture that hands them to a test, and one
  spec. **A structure that exists wins over the one in this skill.** Write down, for yourself,
  how it declares a page, where locators live, how a test gets a page, how login is done. Then
  follow it, including what you would have done differently.

No `CLAUDE.md` or no fixtures: stop and say the project needs `pw-project-bootstrap` first.

## Step 2 — First browser test only: set up the browser part

Skip this step when `tests/e2e/` already has a spec.

Tell the user in three lines what will be added, then add it from the templates:

1. `npx playwright install chromium` (it does nothing when the browser is already there).
2. `src/app/abstract.ts`: `PageHolder`, `Component`, `AppPage`.
3. `src/app/index.ts`: `Application`, the one place that creates every page and component.
4. `src/fixtures/e2e.ts`: `app` (not logged in) and `<role>App` (logged in as that role).
5. `tests/_setup/browser.login.ts` and the `browser-setup` and `e2e` projects in the config: one
   login through the real login page per role, per run, saved under `.auth/`.
6. `scripts/page-snapshot.mjs` and the `test:e2e` script.

Order inside this step, because the login setup needs two pages that you have not seen yet:

1. Add everything except `browser.login.ts`.
2. Look at the login page (`node scripts/page-snapshot.mjs '<login path>'`) and write `LoginPage`.
3. With the throwaway spec from the templates, log in through it and print the page a user lands
   on. Write that page with its `expectLoaded()`.
4. Add `browser.login.ts`, run `npx playwright test --project=browser-setup`, see it green.
5. Replace the "Browser login" line in `CLAUDE.md`.

## Step 3 — Understand the scenario

From the user's sentence work out, and ask only for what you cannot:

- **Who:** which role acts. Two roles in one scenario is fine; each gets its own browser.
- **Starting state:** what data must exist before the first click.
- **The action:** the few steps a person would take.
- **The outcome a person would see:** the one or two things on screen that prove it worked.

## Step 4 — Look at the real pages

Never write a locator from memory, from the product's source, or from a similar page. For every
page the scenario touches:

```
node scripts/page-snapshot.mjs '<path>' <role>
```

It prints the page as roles and names (what a screen reader sees) and the test ids on it. Leave
the role out for a page that needs no login. The script only opens an address. For a page that
needs prepared data (an address with an id, a record in a given status) or a state that appears
after an action (an open dialog), use the throwaway spec from the templates: it prints the same
through `snapshot()`. Follow the real path a click takes; do not assume where the product goes
next.

When a name repeats on the screen (a "Project" field in the filters and in a dialog), scope the
locator to its region first: `this.page.getByRole('dialog', { name: 'New ticket' }).getByLabel('Project')`.

Choose each locator in this order, unless `CLAUDE.md` states another convention:

1. role and accessible name: `getByRole('button', { name: 'Create ticket' })`;
2. label, for form fields: `getByLabel('Title')`;
3. test id: `getByTestId('ticket-title')`, when the role and name are not unique or not stable;
4. visible text, for content, not for controls;
5. CSS, last, with a comment saying why nothing above works.

A control with no role, no label and no test id is a **finding** (it is also an accessibility
defect). Report it in step 5; do not build a clever selector around it silently.

## Step 5 — Propose the tests and wait

Budget: **one or two browser tests per scenario.** A browser test is slow and breaks for more
reasons than an API test, so it earns its place only for what cannot be checked below the
screen:

1. The scenario as the user described it, from the first click to the visible outcome.
2. At most one more: the most important way the screen must refuse or differ (another role does
   not see the button, a required field stops the form).

Everything else goes to the API tests: every validation rule, every status code, every
permission. Say which checks you sent there.

Show the user and stop:

| # | Test (who does what, and sees what) | Why in the browser | Tag |
|---|---|---|---|

Under it: data prepared through the API, pages and components you will add or extend, findings
from step 4, and what you left out. Write only after a clear yes.

## Step 6 — Write

Page objects (templates and a filled example in the reference):

- One class per page the test touches, and **only the locators and actions this test uses**. No
  inventory of the whole page.
- Locators are `readonly` fields, built once in the class. A locator that depends on data is a
  method: `row(title: string)`.
- Actions are methods named after what the user means: `createTicket(data)`, not
  `clickSubmitButton()`.
- `expectLoaded()` is the only assertion inside a page object: it checks the one element that
  proves this page or component is on screen. Every other `expect` is in the spec.
- No wrappers around `click`, `fill` or waiting: Playwright waits by itself. No `waitForTimeout`.
- A piece of screen that lives on two pages is a `Component`. Make it when the second use
  appears, not before. A dialog used by one page stays in that page.
- Register every new page and component in `Application`.

Specs:

- File: `tests/e2e/<area>/<scenario>.spec.ts`.
- Title: who does what and what they see: `'tester creates a ticket and sees it in the list'`.
- Import `test` and `expect` from `src/fixtures/e2e`. Use `<role>App`; never log in inside a test.
- Prepare data through the API, with the project's data helpers (`src/data/`) when it has them,
  otherwise `<role>Api` in the test and `clientFor` in `beforeAll`. `unique()` names; delete it
  afterwards. The browser does only the part under test.
- Find your own data on the page by its unique name, never by position ("the first row").
- Two roles: `test.step('tester creates the ticket', ...)`, `test.step('admin closes it', ...)`.
- The main scenario gets `@smoke`; everything gets `@regression`.

## Step 7 — Run and classify every red test

Run the type check and `npx playwright test --project=e2e <file>`. On a failure read the error
and, when it is not obvious, the snapshot of the page at that moment (`error-context.md` in
`test-results/`). Say which it is:

- **Test defect:** your locator or your order of steps. Fix the test.
- **Product defect:** the screen does not do what the scenario says. Leave the assertion. Report
  it with the steps, the expected and the real screen. Ask whether to keep it red or mark it
  `test.fail()` with a comment naming the defect.
- **Unstable:** passes on a second run. This is not "flaky, add a retry". Find what the test does
  not wait for and assert that state first.
- **Environment:** login, data, the address.

Then run the new spec three times in a row (`--repeat-each=3`). Anything not green three times is
unstable.

## Step 8 — Prove each test can fail

For every new test, break the final expectation on purpose (expect another title, another
status), run it, see it fail for that reason, restore it by undoing your own edit, and run again.
For a "does not see" check, flipping it proves little: show instead that the same locator finds
the element where it should exist (another role, another status).
Tell the user in plain words what each test would catch.

## Step 9 — Record what you learned

Report: the tests, the pages added, findings, the commands to run them.

Then propose additions to `CLAUDE.md`, as exact lines, and add them after a yes:

- **Project profile:** how the screen behaves where you had to find out (a list that loads after
  the page, a dialog that is not a browser dialog, where the session is kept, a page without
  test ids).
- **Test conventions:** the locator convention this product allows, where page objects live,
  how data is prepared, names of the pages and components that now exist.

Finish by naming the next step when the suite grows: scenarios that pass between several roles
read well as `<role>App` steps today; when there are hundreds of them, look at the actor
(screenplay) pattern. Not before.
