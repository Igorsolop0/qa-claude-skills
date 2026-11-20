# Templates

Used only when the project has no page objects yet. A project that has them keeps its own
structure. The examples come from a sample bug tracker (a visitor registers a workspace and becomes
its admin) and were run green against it; names, paths, locators and session details come from
the real product, never from here.

## What is added

```
scripts/page-snapshot.mjs
src/
  config/urls.ts                    # webUrl(), if the bootstrap did not add it
  ui/
    step.ts                         # @step
    app.ts                          # App: every page object, created on first use
    pages/<name>.page.ts
    components/<name>.component.ts  # only when a second page shows the same part
  fixtures/app.fixture.ts           # app, account, <role>App, shared<Role>App; merged in index.ts
test-data/<topic>.ts                # input data builders, if the scenario types data
tests/e2e/<area>/<scenario>.spec.ts
```

| Piece | Holds | A test uses it as |
|---|---|---|
| page object | locators (`get`), user-intent methods, `expect*` checks, `open()` | `app.registerPage.createWorkspace(account)` |
| `App` | one getter per page object, nothing else | `app`, `adminApp`, `sharedAdminApp` |
| `app.fixture.ts` | how an account is made and how a browser is signed in | the test's arguments |
| `<NAME>_COPY` | the copy a page object checks | `REGISTER_COPY.takenEmail` |

No base class: each page object takes `page` in its constructor and nothing else. Playwright already
waits; a base class with `click`/`fill` helpers would only hide errors.

## `src/ui/step.ts`

Copy as is. TC39 decorators work with Playwright and TypeScript 5 without any `tsconfig` flag.

```ts
import { test } from '@playwright/test';

/** `openSignInFromHeader` → `open sign in from header`. */
function words(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
}

/**
 * Reports a page object method as a step named after the class and the method
 * (`RegisterPage: register`), so the report and the trace read as user actions.
 * The title never holds the arguments: they can be passwords. `box` points a failure at the line in
 * the spec that called the method. For async methods only; a getter or a locator factory stays plain.
 */
export function step<This extends object, Args extends unknown[], Result>(
  method: (this: This, ...args: Args) => Promise<Result>,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Promise<Result>>,
): (this: This, ...args: Args) => Promise<Result> {
  const name = words(String(context.name));
  return function (this: This, ...args: Args): Promise<Result> {
    return test.step(`${this.constructor.name}: ${name}`, () => method.call(this, ...args), { box: true });
  };
}
```

## `src/config/urls.ts`

Pages are opened by full address, so the project `baseURL` stays the API address and `request` and `<role>Api` keep working in browser tests. Add `WEB_URL` to `.env` only when the web app has another address than the API.

```ts
/** Address of a page in the web app. Absolute, so the API `baseURL` of the project stays untouched. */
export function webUrl(path = ''): string {
  const base = (process.env.WEB_URL || process.env.BASE_URL || '').replace(/\/*$/, '/');
  if (!base || base === '/') throw new Error('Missing in .env: BASE_URL (and WEB_URL when the web app has another address).');
  return new URL(path.replace(/^\//, ''), base).toString();
}
```

## A page: `src/ui/pages/register.page.ts`

Locators first, then `open()`, then what the user does, then the checks. Only what the tests use;
the next test adds what it needs.

```ts
import { expect, type Locator, type Page } from '@playwright/test';
import type { NewAccount } from '@test-data/accounts';
import { webUrl } from '../../config/urls';
import { step } from '../step';

/** Copy the registration page shows. A spec may import it to assert against. */
export const REGISTER_COPY = {
  takenEmail: 'This email is already registered',
} as const;

/** `#/register`: a visitor creates a workspace and becomes its admin. */
export class RegisterPage {
  static readonly path = '#/register';

  constructor(readonly page: Page) {}

  get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Create a workspace', exact: true });
  }

  get nameInput(): Locator {
    return this.page.getByLabel('Your name', { exact: true });
  }

  get emailInput(): Locator {
    return this.page.getByLabel('Email', { exact: true });
  }

  get passwordInput(): Locator {
    return this.page.getByLabel('Password (8 characters or more)', { exact: true });
  }

  get createWorkspaceButton(): Locator {
    return this.page.getByRole('button', { name: 'Create workspace', exact: true });
  }

  /** The form error under the fields (`role="alert"`). */
  get formError(): Locator {
    return this.page.getByRole('alert');
  }

  /** Opens the page, checks the server answered, waits for the heading. */
  @step
  async open(): Promise<void> {
    const response = await this.page.goto(webUrl(RegisterPage.path));
    // `null` means only the part after `#` changed: no new document was loaded, so there is no status to check.
    expect(response === null || response.ok(), `${RegisterPage.path} answered ${response?.status()}`).toBe(true);
    await expect(this.heading).toBeVisible();
  }

  /** Fills in name, email and password and presses `Create workspace`. */
  @step
  async createWorkspace(account: NewAccount): Promise<void> {
    await this.nameInput.fill(account.name);
    await this.emailInput.fill(account.email);
    await this.passwordInput.fill(account.password);
    await this.createWorkspaceButton.click();
  }

  @step
  async expectFormError(message: string): Promise<void> {
    await expect(this.formError).toHaveText(message);
    await expect(this.heading).toBeVisible();
  }
}
```

- `open()` checks the answer to the navigation. A hash-routed app (`#/register`) loads a new
  document only on the first `goto`; a later `goto` that only changes the part after `#` returns
  `null`, which is not a failure.
- `createWorkspace` is one user intent: three fields and a button. A method that only forwards one
  click should not exist; the spec would learn nothing from it.
- `expectFormError` also checks that the page did not move on: a refusal that navigates away is a
  different bug.

## A page the user lands on: `src/ui/pages/tickets.page.ts`

`expectOpen()` is the check for "this page is on screen", used both by `open()` and by a test that
arrives here through a click (after registration, after login).

```ts
import { expect, type Locator, type Page } from '@playwright/test';
import { webUrl } from '../../config/urls';
import { step } from '../step';

/** `#/tickets`: the ticket list, the first page after login. */
export class TicketsPage {
  static readonly path = '#/tickets';

  constructor(readonly page: Page) {}

  get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Tickets', exact: true });
  }

  get newTicketButton(): Locator {
    return this.page.getByRole('button', { name: 'New ticket', exact: true });
  }

  /** The row of one ticket, found by its title. */
  row(title: string): Locator {
    return this.page.getByRole('row').filter({ hasText: title });
  }

  @step
  async open(): Promise<void> {
    const response = await this.page.goto(webUrl(TicketsPage.path));
    expect(response === null || response.ok(), `${TicketsPage.path} answered ${response?.status()}`).toBe(true);
    await this.expectOpen();
  }

  /** The list is on screen: after `open()`, or after a step that lands here (login, registration). */
  @step
  async expectOpen(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${TicketsPage.path}$`));
    await expect(this.heading).toBeVisible();
  }
}
```

## A component: `src/ui/components/site-header.component.ts`

A part of the screen that several pages show. Make it when the second page needs it.

```ts
import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../step';

/** The bar on top of every page after login: logo, main menu, the signed-in user, `Log out`. */
export class SiteHeader {
  constructor(readonly page: Page) {}

  get root(): Locator {
    return this.page.getByRole('banner');
  }

  get mainMenu(): Locator {
    return this.root.getByRole('navigation', { name: 'Main' });
  }

  get logOutButton(): Locator {
    return this.root.getByRole('button', { name: 'Log out', exact: true });
  }

  /** The user's name next to `Log out`. Plain text with no role or label, so it is found by its text. */
  userName(name: string): Locator {
    return this.root.getByText(name, { exact: true });
  }

  @step
  async expectSignedInAs(name: string): Promise<void> {
    await expect(this.logOutButton).toBeVisible();
    await expect(this.userName(name)).toBeVisible();
  }
}
```

## `src/ui/app.ts`

```ts
import type { Page } from '@playwright/test';
import { SiteHeader } from './components/site-header.component';
import { RegisterPage } from './pages/register.page';
import { TicketsPage } from './pages/tickets.page';

/**
 * The page objects of one browser page. A container only: it holds no steps or checks of its own, and
 * every member is the page object class in camelCase (`RegisterPage` is `app.registerPage`). Members are
 * created on first use and reused for the rest of the test. A new page object gets its getter here.
 *
 * Specs take it from the `app`, `<role>App` or `shared<Role>App` fixture; `createApp` is for fixtures.
 */
export class App {
  readonly #members = new Map<string, unknown>();

  constructor(readonly page: Page) {}

  get registerPage(): RegisterPage {
    return this.#member('registerPage', () => new RegisterPage(this.page));
  }

  get siteHeader(): SiteHeader {
    return this.#member('siteHeader', () => new SiteHeader(this.page));
  }

  get ticketsPage(): TicketsPage {
    return this.#member('ticketsPage', () => new TicketsPage(this.page));
  }

  #member<T>(name: string, create: () => T): T {
    if (!this.#members.has(name)) this.#members.set(name, create());
    return this.#members.get(name) as T;
  }
}

/** The page objects of `page`. Fixtures only: specs take `app`, `<role>App` or `shared<Role>App`. */
export function createApp(page: Page): App {
  return new App(page);
}
```

## `src/fixtures/app.fixture.ts`

Only the block at the top is product-specific: how the API makes an account, and how a browser
holds a session. Find both in step 2 of the skill; never guess them. Typical sessions:

| The product keeps the session in | `addSession` |
|---|---|
| a cookie set by the login endpoint | log in with `context.request.post(...)`: the browser context shares the cookies |
| `localStorage` / `sessionStorage` | `context.addInitScript` that writes the same value the app writes (example below) |
| memory only | it cannot be set from outside: use the login page fallback at the end |

```ts
import { type Browser, type BrowserContext, expect } from '@playwright/test';
import { newAccount } from '@test-data/accounts';
import type { BaseClient } from '../api/base-client';
import { type App, createApp } from '../ui/app';
import { readAuthState, type Schemas, test as apiTest } from './api.fixture';

/** An account a fixture made for one test, with what a browser needs to be signed in as it. */
export interface Account {
  name: string;
  email: string;
  password: string;
  token: string;
  user: Schemas['User'];
}

// ---- Adapt this block to the product: how an account is created, how a browser holds a session. ----

/** A new account through the API: `POST /auth/register` makes a fresh workspace with its admin. */
async function createAccount(api: BaseClient): Promise<Account> {
  const data = newAccount();
  const response = await api.send('POST', '/auth/register', { data });
  expect(response.status(), `POST /auth/register answered ${response.status()}: ${await response.text()}`).toBe(201);
  const body: Schemas['AuthResponse'] = await response.json();
  return { ...data, token: body.token, user: body.user };
}

/** The web app keeps its session in `localStorage['bugboard.session']` as `{ token, user }`. */
async function addSession(context: BrowserContext, session: { token: string; user: Schemas['User'] }): Promise<void> {
  await context.addInitScript((value) => localStorage.setItem('bugboard.session', value), JSON.stringify(session));
}

// -------------------------------------------------------------------------------------------------------

/** A browser of its own, signed in, so two roles can act in one test. Closed after the test. */
async function signedInApp(
  browser: Browser,
  session: { token: string; user: Schemas['User'] },
  use: (app: App) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext();
  await addSession(context, session);
  await use(createApp(await context.newPage()));
  await context.close();
}

type AppFixtures = {
  /** The page objects on the test's `page`, as a visitor who is not signed in. */
  app: App;
  /** A fresh account for this test only, made through the API. A precondition, not a step. */
  account: Account;
  /** Signed in as `account`, in a browser of its own: for tests that change data. */
  adminApp: App;
  /** Signed in as the admin saved by the setup project: for tests that only read. */
  sharedAdminApp: App;
};

export const test = apiTest.extend<AppFixtures>({
  app: async ({ page }, use) => {
    await use(createApp(page));
  },
  account: async ({ api }, use) => {
    await use(await createAccount(api));
  },
  adminApp: async ({ browser, account }, use) => {
    await signedInApp(browser, account, use);
  },
  sharedAdminApp: async ({ browser, adminApi }, use) => {
    const response = await adminApi.send('GET', '/me');
    expect(response.status(), 'the saved admin session is no longer accepted: run the setup project').toBe(200);
    const user: Schemas['User'] = await response.json();
    await signedInApp(browser, { token: readAuthState('admin')?.token ?? '', user }, use);
  },
});
```

- `account` is a precondition, not a step: a test that needs a registered email asks for `account`.
- `adminApp` gets its own browser context, so a test can take two roles (`adminApp`, `memberApp`)
  at once. Contexts made this way do not take the project's `use` options (viewport, locale): set
  them in `browser.newContext({ ... })` when the product needs them.
- One `<role>App` and one `shared<Role>App` per role in `Role`. A product without roles has `app`,
  `account`, `userApp`, `sharedUserApp`.

Merge it into `src/fixtures/index.ts`, and export the `Account` type there:

```ts
import { test as apiTest } from './api.fixture';
import { test as appTest } from './app.fixture';

export const test = mergeTests(apiTest, appTest);
export type { Account } from './app.fixture';
```

## Input data: `test-data/accounts.ts`

What a test types into the product. A builder returns a new, unique value each time; the `qa-pw-`
prefix marks what tests created on a shared environment.

```ts
import { unique } from '@/utils/unique';

/** What the registration form and `POST /auth/register` take. */
export interface NewAccount {
  name: string;
  email: string;
  password: string;
}

/** A new account nobody has registered yet. `qa-pw-` marks what tests created on a shared environment. */
export function newAccount(): NewAccount {
  const id = unique('qa-pw');
  return { name: 'QA autotest', email: `${id}@example.test`, password: `pw-${id}` };
}
```

## `playwright.config.ts`: the `e2e` project

Add to `projects`, and `devices` to the `@playwright/test` import. It depends on `setup` when a
`shared<Role>App` reuses the role saved there.

```ts
    ...(fs.existsSync(path.join(__dirname, 'tests/e2e'))
      ? [
          {
            name: 'e2e',
            testDir: './tests/e2e',
            use: { ...devices['Desktop Chrome'] },
            dependencies: ['setup'],
          },
        ]
      : []),
```

`package.json`: `"test:e2e": "playwright test --project=e2e"`.

## `scripts/page-snapshot.mjs`

```js
// Prints what is really on a page for a visitor: roles and names, and test ids.
// Usage: node scripts/page-snapshot.mjs '<path>'   (for example '#/register' or '/login')
import { chromium } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const [target = ''] = process.argv.slice(2);
const base = (process.env.WEB_URL || process.env.BASE_URL || '').replace(/\/*$/, '/');
if (base === '/') {
  console.error('Missing in .env: BASE_URL (and WEB_URL when the web app has another address).');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(15_000);
const response = await page.goto(new URL(target.replace(/^\//, ''), base).toString());
// A look, not a test: let the page render, but do not hang on apps that never go quiet.
await page.waitForLoadState('load');
await page.locator('body *').first().waitFor().catch(() => {});

console.log(`URL: ${page.url()}  (status ${response?.status() ?? 'same document'})\nTitle: ${await page.title()}\n`);
console.log(await page.locator('body').ariaSnapshot());

const testIds = await page.locator('[data-testid]').evaluateAll((elements) =>
  elements
    .filter((element) => element.checkVisibility())
    .map((element) => `${element.getAttribute('data-testid')}  <${element.tagName.toLowerCase()}>`),
);
console.log(`\nTest ids (${testIds.length}):\n${testIds.join('\n')}`);

await browser.close();
```

If the product uses another attribute for test ids, change it here and set `testIdAttribute` in
the config. The address in the output shows a redirect to login at once.

## A spec: `tests/e2e/auth/register.spec.ts`

```ts
import { Tag } from '@/config/tags';
import { expect, test } from '@/fixtures';
import { REGISTER_COPY } from '@/ui/pages/register.page';
import { newAccount } from '@test-data/accounts';

test('Visitor creates a workspace and lands on the ticket list, signed in', { tag: [Tag.smoke, Tag.auth] }, async ({ app }) => {
  const account = newAccount();

  await test.step('Visitor opens the registration page', async () => {
    await app.registerPage.open();
  });

  await test.step('Visitor fills in name, email and password and creates the workspace', async () => {
    await app.registerPage.createWorkspace(account);
  });

  await test.step('The ticket list opens with the visitor signed in', async () => {
    await app.ticketsPage.expectOpen();
    await app.siteHeader.expectSignedInAs(account.name);
  });
});

test('Visitor cannot create a workspace with an email that is already registered', { tag: [Tag.auth] }, async ({ app, account }) => {
  await app.registerPage.open();
  await app.registerPage.createWorkspace({ ...newAccount(), email: account.email });

  await app.registerPage.expectFormError(REGISTER_COPY.takenEmail);
});

test('Admin sees the demo project ticket list right after sign-in', async ({ sharedAdminApp: app }) => {
  await app.ticketsPage.open();

  await expect(app.ticketsPage.row('Login button does nothing on Safari')).toBeVisible();
});
```

- The first test is the scenario, step by step, as the manual case reads. The second is the one
  refusal the screen must show; the other refusals (short password, bad email) are API tests.
- The third test shows `shared<Role>App` for a test that only reads.
- The spec never touches a locator to act; it may assert on a page object's locator once
  (`toBeVisible()` on a row) when no other spec needs that check.

## A throwaway spec for looking at a page

For a page the snapshot script cannot reach: it needs a session, prepared data, or an action first,
and for finding where the session lives (step 2 of the skill). Put it in `tests/e2e/_look.spec.ts`,
run it with `npx playwright test tests/e2e/_look.spec.ts --project=e2e`, and delete the file when done.

```ts
import { test } from '@/fixtures';

// Throwaway: look at a page that needs a session, data or an action first. Delete this file when done.
// eslint-disable-next-line playwright/expect-expect
test('look', async ({ app }) => {
  test.setTimeout(30_000);
  await app.registerPage.open();
  // One action through the page object, then print. Never wait for an element you have not seen yet.
  const page = app.page;
  console.log(`URL: ${page.url()}\n${await page.locator('body').ariaSnapshot()}`);
  console.log('cookies:', (await page.context().cookies()).map((cookie) => cookie.name));
  console.log('localStorage:', await page.evaluate(() => Object.keys(localStorage)));
  console.log('sessionStorage:', await page.evaluate(() => Object.keys(sessionStorage)));
});
```

Before `app.fixture.ts` exists, take `{ page }` instead of `{ app }`, log in through the form with
plain locators, and print the storage: that is how you learn what `addSession` must write.

## `AGENTS.md` lines after the first browser test

The first line replaces the "Browser" line; the others go under "Test conventions".

```md
- Browser: tests take `app` (visitor), `<role>App` (fresh account, own browser) or `shared<Role>App`
  (the setup's account, read-only) from `@/fixtures`. A session is set from outside the browser:
  <how, from step 2>.
- Page objects: `src/ui/pages/`, `src/ui/components/`, each a getter in `src/ui/app.ts`. Locators
  first, user-intent methods, `expect*` checks, `@step` on every public async method, copy in
  `<NAME>_COPY`.
- Look at a page before writing a locator: `node scripts/page-snapshot.mjs '<path>'`.
```

## Fallback: the session cannot be set from outside

When the API cannot create accounts and the session lives only in the browser's memory, log in
through the login page once per role per run in a setup project, save `context.storageState()` to
`.auth/<role>.browser.json`, and build `<role>App` from that file:
`browser.newContext({ storageState: '.auth/<role>.browser.json' })`. Add the project
`{ name: 'browser-setup', testDir: './tests/_setup', testMatch: /.*\.login\.ts/, dependencies: ['setup'] }`
and make `e2e` depend on it. Record in `AGENTS.md` that tests then share one account per role, so
tests that change data must clean up after themselves.
