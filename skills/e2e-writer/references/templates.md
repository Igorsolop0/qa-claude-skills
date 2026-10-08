# Templates

Used only when the project has no page objects yet. A project that has them keeps its own
structure. The examples use a sample bug tracker with roles `admin` and `tester`; names, paths
and locators come from the real product, never from here.

## What is added

```
scripts/page-snapshot.mjs
src/
  app/
    abstract.ts              # PageHolder, Component, AppPage
    index.ts                 # Application: every page and component, created once
    pages/login.page.ts
    pages/<name>.page.ts
    components/<name>.component.ts   # only when a second page needs it
  fixtures/e2e.ts            # app, <role>App
tests/
  _setup/browser.login.ts
  e2e/<area>/<scenario>.spec.ts
```

Four levels, each adding one thing:

| Class | Adds | Used for |
|---|---|---|
| `PageHolder` | holds `page` | base of everything |
| `Component` | `expectLoaded()` | a piece of screen shared by pages: menu, dialog, message |
| `AppPage` | `path`, `open()` | a page with its own address |
| `Application` | one field per page and component | what a test receives: `adminApp.tickets.open()` |

## `src/app/abstract.ts`

```ts
import type { Page } from '@playwright/test';

/** Address of the web app. Absolute, so the API `baseURL` of the project stays untouched. */
export function webUrl(path = ''): string {
  const base = (process.env.WEB_URL ?? process.env.BASE_URL ?? '').replace(/\/*$/, '/');
  return new URL(path.replace(/^\//, ''), base).toString();
}

export abstract class PageHolder {
  constructor(protected readonly page: Page) {}

  /** What is on screen now: roles and names, then visible test ids. For looking, not for tests. */
  async snapshot(): Promise<string> {
    const testIds = await this.page
      .locator('[data-testid]')
      .evaluateAll((elements) =>
        elements.filter((element) => element.checkVisibility()).map((element) => element.getAttribute('data-testid')),
      );
    return `URL: ${this.page.url()}\n${await this.page.locator('body').ariaSnapshot()}\nTest ids: ${testIds.join(', ')}`;
  }
}

/** A piece of screen. `expectLoaded` checks the one element that proves it is there. */
export abstract class Component extends PageHolder {
  abstract expectLoaded(): Promise<void>;
}

/** A page with its own address. */
export abstract class AppPage extends Component {
  abstract readonly path: string;

  async open(): Promise<void> {
    await this.goto(this.path);
  }

  /** For pages whose address carries an id; see `TicketPage` below. */
  protected async goto(path: string): Promise<void> {
    await this.page.goto(webUrl(path));
    await this.expectLoaded();
  }
}
```

## A page: `src/app/pages/tickets.page.ts`

```ts
import { expect, type Locator } from '@playwright/test';
import { AppPage } from '../abstract';

export class TicketsPage extends AppPage {
  readonly path = '#/tickets';

  readonly heading = this.page.getByRole('heading', { name: 'Tickets' });
  readonly newTicketButton = this.page.getByRole('button', { name: 'New ticket' });
  readonly titleField = this.page.getByLabel('Title');
  readonly saveButton = this.page.getByRole('button', { name: 'Create' });

  /** The row of one ticket, found by its title. */
  row(title: string): Locator {
    return this.page.getByRole('row').filter({ hasText: title });
  }

  /** The status cell of that row. It has no role or label, so: test id. */
  statusOf(title: string): Locator {
    return this.row(title).getByTestId('ticket-row-status');
  }

  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  async createTicket(data: { title: string }): Promise<void> {
    await this.newTicketButton.click();
    await this.titleField.fill(data.title);
    await this.saveButton.click();
  }
}
```

Only what the tests use. The next test adds what it needs.

A page whose address carries an id keeps the common part in `path` and gets its own opening
method; the inherited `open()` is not used on it:

```ts
export class TicketPage extends AppPage {
  readonly path = '#/tickets';
  readonly status = this.page.getByTestId('ticket-status');

  async openTicket(id: number): Promise<void> {
    await this.goto(`${this.path}/${id}`);
  }

  async expectLoaded(): Promise<void> {
    await expect(this.status).toBeVisible();
  }
}
```

## The first page: `src/app/pages/login.page.ts`

```ts
import { expect } from '@playwright/test';
import { AppPage } from '../abstract';

export class LoginPage extends AppPage {
  readonly path = '#/login';

  readonly emailField = this.page.getByLabel('Email');
  readonly passwordField = this.page.getByLabel('Password');
  readonly logInButton = this.page.getByRole('button', { name: 'Log in' });

  async expectLoaded(): Promise<void> {
    await expect(this.logInButton).toBeVisible();
  }

  async logIn(email: string, password: string): Promise<void> {
    await this.emailField.fill(email);
    await this.passwordField.fill(password);
    await this.logInButton.click();
  }
}
```

## `src/app/index.ts`

```ts
import { PageHolder } from './abstract';
import { LoginPage } from './pages/login.page';
import { TicketsPage } from './pages/tickets.page';

/** Everything on screen that tests can use. A new page or component is added here. */
export class Application extends PageHolder {
  readonly login = new LoginPage(this.page);
  readonly tickets = new TicketsPage(this.page);
}
```

## `src/fixtures/e2e.ts`

Extends the API fixtures, so a browser test also has `adminApi`, `unique`, `clientFor`.

```ts
import path from 'node:path';
import type { Browser } from '@playwright/test';
import { Application } from '../app';
import { test as base, type Role } from './index';

export * from './index';

/** Browser session of a role, saved by `tests/_setup/browser.login.ts`. */
export const browserStateFile = (role: Role): string =>
  path.join(__dirname, '../../.auth', `${role}.browser.json`);

type AppFixtures = {
  /** Not logged in: the login page and what a visitor sees. */
  app: Application;
  adminApp: Application;
  testerApp: Application;
};

/** Each role gets its own browser window, so two roles can act in one test. */
async function appFor(browser: Browser, role: Role, use: (app: Application) => Promise<void>) {
  const context = await browser.newContext({ storageState: browserStateFile(role) });
  await use(new Application(await context.newPage()));
  await context.close();
}

export const test = base.extend<AppFixtures>({
  app: async ({ page }, use) => use(new Application(page)),
  adminApp: async ({ browser }, use) => appFor(browser, 'admin', use),
  testerApp: async ({ browser }, use) => appFor(browser, 'tester', use),
});
```

One `<role>App` line per role in `Role`. A product without roles has `app` and `userApp`.

## `tests/_setup/browser.login.ts`

```ts
import fs from 'node:fs';
import type { Browser } from '@playwright/test';
import { Application } from '../../src/app';
import { browserStateFile, readAuthState, test as setup, type Role } from '../../src/fixtures/e2e';

/** Credentials: `.env` for accounts that exist, `.auth/<role>.json` for accounts the setup created. */
function credentials(role: Role): { email: string; password: string } {
  const prefix = role.toUpperCase();
  const saved = readAuthState(role);
  const email = process.env[`${prefix}_EMAIL`] ?? saved?.email;
  const password = process.env[`${prefix}_PASSWORD`] ?? saved?.password;
  if (!email || !password) {
    throw new Error(
      `No email and password for "${role}": fill ${prefix}_EMAIL / ${prefix}_PASSWORD in .env, or run the setup project first.`,
    );
  }
  return { email, password };
}

/** True when the saved browser session still opens the first page after login. */
async function sessionWorks(browser: Browser, role: Role): Promise<boolean> {
  if (!fs.existsSync(browserStateFile(role))) return false;
  const context = await browser.newContext({ storageState: browserStateFile(role) });
  try {
    await new Application(await context.newPage()).tickets.open();
    return true;
  } catch {
    return false;
  } finally {
    await context.close();
  }
}

async function logInThroughTheLoginPage(browser: Browser, role: Role): Promise<void> {
  if (await sessionWorks(browser, role)) return;

  const { email, password } = credentials(role);
  const context = await browser.newContext();
  const app = new Application(await context.newPage());
  await app.login.open();
  await app.login.logIn(email, password);
  await app.tickets.expectLoaded();
  await context.storageState({ path: browserStateFile(role) });
  await context.close();
}

setup('admin: browser login', async ({ browser }) => {
  await logInThroughTheLoginPage(browser, 'admin');
});

setup('tester: browser login', async ({ browser }) => {
  await logInThroughTheLoginPage(browser, 'tester');
});
```

`tickets` here stands for the page a user lands on after login; use the product's own. The
`try` / `catch` is allowed in this one place: it asks a question ("is the session alive?") and
does not hide a failed check. A product that keeps the session in memory only (nothing in cookies
or storage) cannot reuse it: say so and log in inside a fixture instead.

## `playwright.config.ts`: the browser projects

Replace the `e2e` block of the bootstrap config with this. The project `baseURL` stays the API
address, so `request` and `<role>Api` work in browser tests; pages use `webUrl()`.

```ts
    ...(fs.existsSync(e2eDir)
      ? [
          {
            name: 'browser-setup',
            testDir: './tests/_setup',
            testMatch: /.*\.login\.ts/,
            use: { ...devices['Desktop Chrome'] },
            dependencies: ['setup'],
          },
          {
            name: 'e2e',
            testDir: './tests/e2e',
            use: { ...devices['Desktop Chrome'] },
            dependencies: ['browser-setup'],
          },
        ]
      : []),
```

`package.json`: `"test:e2e": "playwright test --project=e2e"`.

## `scripts/page-snapshot.mjs`

```js
// Prints what is really on a page: roles and names, and test ids.
// Usage: node scripts/page-snapshot.mjs '<path>' [role]
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const [target = '', role] = process.argv.slice(2);
const base = (process.env.WEB_URL ?? process.env.BASE_URL ?? '').replace(/\/*$/, '/');
const stateFile = role ? `.auth/${role}.browser.json` : undefined;
if (stateFile && !fs.existsSync(stateFile)) {
  console.error(`No saved browser login for "${role}". Run: npx playwright test --project=browser-setup`);
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext(stateFile ? { storageState: stateFile } : {});
const page = await context.newPage();
await page.goto(new URL(target.replace(/^\//, ''), base).toString());
// A look, not a test: give the page a moment to settle, and do not hang on apps that never go quiet.
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});

console.log(`URL: ${page.url()}\nTitle: ${await page.title()}\n`);
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

## A spec: `tests/e2e/tickets/create-ticket.spec.ts`

```ts
import { expect, test, unique, type Schemas } from '../../../src/fixtures/e2e';
// Data helpers the API specs already use. If the project has none, call the API with `clientFor`.
import { createProject, deleteProject } from '../../../src/data/projects';

let project: Schemas['Project'];

test.beforeAll(async ({ request }) => {
  project = await createProject(request);
});

test.afterAll(async ({ request }) => {
  await deleteProject(request, project.id);
});

test(
  'tester creates a ticket and sees it in the list',
  { tag: ['@smoke', '@regression'] },
  async ({ testerApp }) => {
    const title = unique('ticket');

    await testerApp.tickets.open();
    await testerApp.tickets.createTicket({ title });

    await expect(testerApp.tickets.row(title)).toBeVisible();
    // 'Open' is the label the screen uses for status `open`; the mapping is recorded in CLAUDE.md.
    await expect(testerApp.tickets.statusOf(title)).toHaveText('Open');
  },
);
```

Two roles in one scenario:

```ts
test('admin closes the ticket and the tester sees it closed', async ({ adminApp, testerApp, adminApi }) => {
  // data through the API: a resolved ticket reported by the tester
  await test.step('admin closes the ticket', async () => { /* adminApp... */ });
  await test.step('tester sees it closed', async () => { /* testerApp... */ });
});
```

## A throwaway spec for looking at a page

For a page the snapshot script cannot reach: it needs a login that is not saved yet, prepared
data (an address with an id, a record in a given status), or an action first. Put it in
`tests/e2e/_look.spec.ts`, run it with `npx playwright test tests/e2e/_look.spec.ts --project=e2e`,
and empty the file when done.

```ts
import { test } from '../../src/fixtures/e2e';

test('look', async ({ testerApp, adminApi }) => {
  test.setTimeout(15_000);
  // create what the page needs through the API
  try {
    await testerApp.tickets.open();
    console.log(await testerApp.tickets.snapshot());
    // one action, then print again. Never wait for an element you have not seen yet.
  } finally {
    // delete what was created
  }
});
```

Before the browser login exists, use the `app` fixture, log in with the page object you just
wrote, and print the snapshot: that shows the page a user lands on and its address.

## `CLAUDE.md` lines after the first browser test

The first line replaces the "Browser login" line in step 2; the other two go under
"Test conventions" in step 9.

```md
- Browser login: `tests/_setup/browser.login.ts` logs in through the login page once per role and
  saves the session to `.auth/<role>.browser.json`. Tests use `adminApp` / `testerApp`.
- Page objects: `src/app/` (`PageHolder` → `Component` → `AppPage`; `Application` in `index.ts`
  holds every page). Import browser tests from `src/fixtures/e2e`.
- Look at a page before writing a locator: `node scripts/page-snapshot.mjs '<path>' <role>`.
```
