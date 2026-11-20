---
name: e2e-writer
description: |
  Writes one or two honest browser tests for one user scenario in a Playwright project that was
  set up by `pw-project-bootstrap`, and the page objects they need. Works on any product: the
  rules here are general, and everything particular to the product is read from, and written back
  to, the project's `AGENTS.md`. Follows the page-object structure the project already has, or sets
  up the default one: an `App` container of page objects handed to tests by fixtures (`app` for a
  visitor, `<role>App` for a fresh account, `shared<Role>App` for read-only tests), page objects
  with locators, user-intent methods, `expect*` checks and `@step` reporting. Looks at the real
  page before naming a locator, prepares data through the API in fixtures, proposes the tests and
  waits, writes them, lints and runs them, proves they can fail, and records what it learned.
  Trigger: "write a browser test for creating a ticket", "e2e test for this scenario", "cover the
  checkout flow in the browser", "add a UI test", "page object for this page", "new spec",
  "add page object".
  Not for: setting up the project (use `pw-project-bootstrap`), API tests (use
  `api-contract-writer`), reviewing tests (use `pw-test-review`), a red run (use `pw-failure-triage`).
argument-hint: "the scenario in one sentence (for example: a visitor creates a workspace and lands on the ticket list)"
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
  - Bash(npx eslint*)
  - Bash(node scripts/*)
  - Bash(node -e *)
---

# E2E Writer

You write browser tests for one scenario at a time. The user is a QA engineer who knows the
scenario by heart and may not write code. Your tests must be few, readable as "who does what",
and able to fail.

This skill knows nothing about the product. What is particular about it lives in `AGENTS.md` in
the test folder (`CLAUDE.md` there only imports it). Read it before anything else, follow it when
it conflicts with a default here, and add to it at the end. Never edit this skill to fit a project.

- Templates, with a filled example: [references/templates.md](references/templates.md).
- What makes a browser test honest: [references/honest-e2e.md](references/honest-e2e.md).
- Locators, assertions, waits, TypeScript and anti-patterns in detail:
  [references/playwright-rules.md](references/playwright-rules.md). Read it before step 6.

## The structure in one screen

```
src/ui/app.ts                     App: one getter per page object, created on first use
src/ui/step.ts                    @step: a page object method shows as a step in the report
src/ui/pages/<name>.page.ts       a page with its own address
src/ui/components/<name>.component.ts   a part of the screen several pages share
src/fixtures/app.fixture.ts       app, account, <role>App, shared<Role>App
tests/e2e/<area>/<scenario>.spec.ts     specs only: they call page objects, never locators
```

- **`App` is a container, not a page object.** No steps, no checks. Each member is a page object
  class in camelCase: `RegisterPage` is `app.registerPage`. A new page object gets its getter in
  `src/ui/app.ts`. `createApp(page)` is called by fixtures only; a spec never calls it and never
  writes `new SomePage(page)`.
- **A page object has no base class.** Locators first, as `get` accessors. Below them, methods
  named after what the user does (`createWorkspace(account)`), and `expect*` methods for the
  states the page can be in (`expectFormError(message)`). Not one method per click.
- **Every public `async` method carries `@step`**: the report shows
  `RegisterPage: create workspace` under the spec's own step, and a failure points at the spec line
  that called it. Getters and locator methods (`row(title)`) stay plain.
- **A page has `open()`**: it navigates, checks the answer, and waits for the element that proves
  the page is ready.
- **The copy a page object checks** is a `<NAME>_COPY` constant next to it (`REGISTER_COPY`); a
  spec may import it to assert against.
- **A spec takes the `App` it needs and calls it `app`**:
  `async ({ adminApp: app }) => { await app.ticketsPage.open(); }`.
- **Preconditions are fixtures.** An account, a project, a ticket that must exist before the first
  click comes from a fixture, never from steps at the top of the test.

ESLint (`npm run lint`) enforces the spec rules; the bootstrap added them.

## Step 1 — Read the project

- `AGENTS.md`: profile, conventions, roles, what must not be touched, the line about the browser.
- `src/fixtures/`: the names you may use. `src/config/tags.ts`: the tags.
- Page objects, if any exist (`src/ui/`, `src/app/`, `pages/`, `pom/`, or wherever the project
  keeps them): read the container or base classes, two pages, one component, the fixture that
  hands them to a test, and one spec. **A structure that exists wins over the one in this skill.**
  Write down, for yourself, how it declares a page, where locators live, how a test gets a page,
  how a session is made. Then follow it, including what you would have done differently.

No `AGENTS.md` (or `CLAUDE.md`) or no fixtures: stop and say the project needs
`pw-project-bootstrap` first.

## Step 2 — First browser test only: set up the browser part

Skip this step when `tests/e2e/` already has a spec.

Tell the user in three lines what will be added, then add it from the templates:

1. `npx playwright install chromium` (it does nothing when the browser is already there).
2. `src/ui/step.ts`, `src/ui/app.ts`, and `src/config/urls.ts` if it is missing.
3. `scripts/page-snapshot.mjs` and the `test:e2e` script.
4. The `e2e` project in `playwright.config.ts`.

Then, in this order, because the fixtures need facts you have not seen yet:

1. Look at the first page of the scenario (`node scripts/page-snapshot.mjs '<path>'`) and write its
   page object.
2. Find out how the browser keeps a session: with the throwaway spec from the templates, sign in
   or register through the page, and print the cookies and the storage keys. Compare them with what
   the login or registration endpoint returns.
3. Write `src/fixtures/app.fixture.ts` from the template: `createAccount` (how the API makes an
   account) and `addSession` (how a browser becomes signed in without the login form). Merge it in
   `src/fixtures/index.ts`.
4. With the throwaway spec, open the first page after login as `<role>App` and print it: it must
   show the signed-in state. Write that page with its `expectOpen()`.
5. Replace the "Browser" line in `AGENTS.md`.

A product whose API cannot create accounts and whose session cannot be set from outside: say so,
and fall back to one login through the login page per role in a setup project (templates, last
section).

## Step 3 — Understand the scenario

From the user's sentence work out, and ask only for what you cannot:

- **Who:** which role acts. Two roles in one scenario is fine; each gets its own browser.
- **Starting state:** what data must exist before the first click. Each piece becomes a fixture.
- **The action:** the few steps a person would take.
- **The outcome a person would see:** the one or two things on screen that prove it worked.

## Step 4 — Look at the real pages

Never write a locator from memory, from the product's source, or from a similar page. For every
page the scenario touches:

```
node scripts/page-snapshot.mjs '<path>'
```

It prints the page as roles and names (what a screen reader sees) and the test ids on it. The
script only opens an address as a visitor. For a page that needs a session, prepared data or an
action first (an open dialog), use the throwaway spec from the templates. Follow the real path a
click takes; do not assume where the product goes next.

Choose each locator in this order, unless `AGENTS.md` states another convention:

1. role and accessible name: `getByRole('button', { name: 'Create workspace' })`;
2. label, for form fields: `getByLabel('Email', { exact: true })`;
3. placeholder;
4. visible text, for content, not for controls;
5. test id: `getByTestId('ticket-row-status')`, when role and name are not unique or not stable;
6. a stable `data-*` attribute or id;
7. CSS, last, with a comment saying why nothing above works. Never layout classes, never `nth()`
   outside a named getter.

When a name repeats on the screen, scope the locator to its region first:
`this.page.getByRole('dialog', { name: 'New ticket' }).getByLabel('Project')`.

A control with no role, no label and no test id is a **finding** (it is also an accessibility
defect). Report it in step 5; do not build a clever selector around it silently.

## Step 5 — Propose the tests and wait

Budget: **one or two browser tests per scenario.** A browser test is slow and breaks for more
reasons than an API test, so it earns its place only for what cannot be checked below the
screen:

1. The scenario as the user described it, from the first click to the visible outcome.
2. At most one more: the most important way the screen must refuse or differ (a registered email
   shows an error, another role does not see the button).

Everything else goes to the API tests: every validation rule, every status code, every
permission. Say which checks you sent there.

Show the user and stop:

| # | Test (who does what, and sees what) | Why in the browser | Tags |
|---|---|---|---|

Under it: the fixtures that prepare data, the page objects and methods you will add or extend,
findings from step 4, and what you left out. Write only after a clear yes.

## Step 6 — Write

Read [references/playwright-rules.md](references/playwright-rules.md) first.

Page objects (templates and a filled example in the reference):

- One class per page or shared part of the screen, and **only the locators and methods these
  tests use**. No inventory of the whole page.
- Locators are `get` accessors. A locator that depends on data is a method: `row(title: string)`.
- Methods carry a user intent: `createWorkspace(account)` fills, submits; not `clickSubmit()`.
- `expect*` methods hold the checks of a state the page can be in. A check two specs share becomes
  an `expect*` method; a one-off assertion on a page object's locator may stay in the spec.
- `@step` on every public `async` method. Never wrap `click`, `fill` or waiting: Playwright waits
  by itself. No `waitForTimeout`, no `networkidle`.
- A part of the screen that two pages show is a component. Make it when the second use appears.
- Register every new page object in `App`. Shared page objects change additively: add a method,
  do not change one that other specs use.
- Logic that spans pages lives in the page object where the user starts it, or the spec calls
  several page objects in a row. Pure logic with no `page` (a parser, a calculation) goes to
  `src/utils/` with a unit test next to it (`*.test.ts`, run by the `unit` project).

Fixtures:

- A precondition is a fixture in `src/fixtures/<domain>.fixture.ts`, extending the fixture it
  needs, merged in `src/fixtures/index.ts`. It creates the data through the API and deletes it after
  the test.
- `<role>App` for a test that changes data (a fresh account per test); `shared<Role>App` for a test
  that only reads.

Specs:

- File: `tests/e2e/<area>/<scenario>.spec.ts`. Specs only in `tests/`; no helpers, no page objects.
- Import `test` and `expect` from `@/fixtures`, tags from `@/config/tags`, input data from
  `@test-data/…`. No relative path into `src/`.
- Title: who does what and what they see: `'Visitor creates a workspace and lands on the ticket list'`.
- `test.step` per step of the scenario, named in the user's words, as the steps of the manual case.
- Tags from `Tag`: `tag: [Tag.smoke, Tag.auth]`. The main scenario gets `Tag.smoke`. Never
  `@regression` and never a raw `'@…'` string. A new tag goes into `src/config/tags.ts` first.
- Never act on a locator in a spec (`.click()`, `.fill()` are lint errors there); call page object
  methods. Never log in inside a test unless the test is about logging in.
- Find your own data on the page by its unique name, never by position ("the first row").
- Two roles: `async ({ adminApp, memberApp }) => { await test.step('admin …'); await test.step('member …'); }`.

## Step 7 — Check, run and classify every red test

Run `npm run typecheck`, `npm run lint` and `npx playwright test --project=e2e <file>`. Fix every
lint error in the files you touched. On a failure read the error and, when it is not obvious, the
snapshot of the page at that moment (`error-context.md` in `test-results/`). Say which it is:

- **Test defect:** your locator or your order of steps. Fix the test.
- **Product defect:** the screen does not do what the scenario says. Leave the assertion. Report
  it with the steps, the expected and the real screen. Ask whether to keep it red or mark it
  `test.fail()` with a comment naming the defect.
- **Unstable:** passes on a second run. This is not "flaky, add a retry". Find what the test does
  not wait for and assert that state first.
- **Environment:** access, data, the address.

Then run the new spec three times in a row (`--repeat-each=3`). Anything not green three times is
unstable.

## Step 8 — Prove each test can fail

For every new test, break the final expectation on purpose (expect another text, another page),
run it, see it fail for that reason, restore it by undoing your own edit, and run again. When the
expectation lives in a page object or a `<NAME>_COPY` constant, break it there and run only this
spec. For a "does not see" check, flipping it proves little: show instead that the same locator
finds the element where it should exist (another role, another state).
Tell the user in plain words what each test would catch.

## Step 9 — Record what you learned

Report: the tests, the page objects and fixtures added, findings, the commands to run them.

Then propose additions to `AGENTS.md`, as exact lines, and add them after a yes:

- **Project profile:** how the screen behaves where you had to find out (where the session lives,
  a list that loads after the page, a dialog that is not a browser dialog, a page without test ids,
  the label the screen uses for each status).
- **Test conventions:** the page objects and fixtures that now exist, the locator convention this
  product allows, how data is prepared.

Finish by naming the next step: `pw-test-review` before a pull request (with its mutation check),
`pw-failure-triage` when a run goes red.
