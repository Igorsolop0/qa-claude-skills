# Templates

Adapt names to the interview answers. Match the repository's formatter and package manager.

## Folder tree (API and browser, inside a repository)

```
qa/
  .env.example
  .gitignore
  CLAUDE.md
  README.md
  package.json
  playwright.config.ts
  tsconfig.json
  scripts/generate-api-types.mjs
  src/
    api/base-client.ts
    fixtures/index.ts
    matchers/to-match-schema.ts
    types/api.d.ts            # generated, committed
    types/api-schemas.json    # generated, committed
  tests/
    _setup/auth.setup.ts
    api/health/health.spec.ts
```

Do not create empty folders: git does not keep them. `tests/api/<domain>/` appears with its first
spec, `tests/e2e/` with the first browser test. In a separate repository the same tree is the
repository root (no `qa/` level).

## Dev dependencies

Install exactly these, with these ranges. Unpinned installs break: `openapi-typescript` 7 needs
TypeScript 5 and crashes on TypeScript 7.

```
npm install -D @playwright/test typescript@^5 openapi-typescript@^7 yaml@^2 dotenv@^17 ajv@^8 ajv-formats@^3 @types/node@<major>
```

`<major>` is the first number of `node --version` (Node 24 gives `@types/node@24`). Leave out
`openapi-typescript` and `yaml` when there is no API description. Commit `package-lock.json`:
`npm ci` in CI needs it.

## `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["playwright.config.ts", "src", "tests"]
}
```

## `.gitignore`

```
node_modules/
.env
.auth/
test-results/
playwright-report/
blob-report/
```

## `playwright.config.ts`

```ts
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '.env'), quiet: true });

const required = ['BASE_URL'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0 && !process.argv.includes('--list')) {
  throw new Error(`Missing in .env: ${missing.join(', ')}. See .env.example.`);
}

const apiDir = path.join(__dirname, 'tests/api');
const apiDomains = fs
  .readdirSync(apiDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
// Folders whose tests need no login: they must stay green when an account is missing.
const noLogin = new Set(['health']);
const e2eDir = path.join(__dirname, 'tests/e2e');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    // The trailing slash keeps a path in BASE_URL (https://host/api/v1) when requests are resolved.
    baseURL: process.env.BASE_URL?.replace(/\/*$/, '/'),
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testDir: './tests/_setup', testMatch: /.*\.setup\.ts/ },
    ...apiDomains.map((domain) => ({
      name: `api-${domain}`,
      testDir: `./tests/api/${domain}`,
      dependencies: noLogin.has(domain) ? [] : ['setup'],
    })),
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
  ],
});
```

Leave out the `setup` project and `dependencies` when there is no login. Leave out the two browser
projects for an API-only project. They appear by themselves with the first browser test, which
`e2e-writer` adds together with the browser login. `baseURL` stays the API address; pages are opened
by full address from `WEB_URL`.

The config check covers only what every run needs (`BASE_URL`). Role credentials are checked inside
the setup test of that role, with the same message format: `Missing in .env: TESTER_EMAIL,
TESTER_PASSWORD. See .env.example.` Setup is one project: when a role fails, the projects that depend on setup do not run and
Playwright reports them as "did not run". The health project is the exception. Say this in the README.

## `package.json` scripts

```json
{
  "scripts": {
    "test": "playwright test",
    "test:api": "playwright test --project=api-*",
    "test:smoke": "playwright test --grep @smoke",
    "report": "playwright show-report",
    "typecheck": "tsc --noEmit",
    "types:api": "node scripts/generate-api-types.mjs"
  }
}
```

## `scripts/generate-api-types.mjs`

One command, two files: types for the editor and the same schemas as data for the run-time check.
A script, not a shell one-liner, so it behaves the same on Windows and macOS.

```js
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { parse } from 'yaml';

dotenv.config({ quiet: true });

const source = process.env.OPENAPI_SOURCE;
if (!source) {
  console.error('OPENAPI_SOURCE is not set. Put the Swagger/OpenAPI link or file path in .env.');
  process.exit(1);
}

// 1. Types for the editor and the type check.
execFileSync('npx', ['openapi-typescript', source, '-o', 'src/types/api.d.ts'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

// 2. The same schemas as data, for `toMatchSchema` at run time.
let text;
if (/^https?:\/\//.test(source)) {
  const response = await fetch(source);
  if (!response.ok) {
    console.error(`Could not read ${source}: ${response.status}`);
    process.exit(1);
  }
  text = await response.text();
} else {
  text = fs.readFileSync(source, 'utf8');
}
const schemas = parse(text).components?.schemas ?? {};
fs.writeFileSync(
  'src/types/api-schemas.json',
  `${JSON.stringify({ components: { schemas } }, null, 2)}\n`,
);
console.log(`${Object.keys(schemas).length} schemas → src/types/api-schemas.json`);
```

`openapi-typescript` reads OpenAPI 3.x. For a Swagger 2.0 document, convert it once with
`swagger2openapi` into `openapi.json` in the test folder and point `OPENAPI_SOURCE` at that file.
Both generated files are committed: a diff after regeneration means the contract changed.
Schemas split across several files with external `$ref` are not followed; bundle the document first.

## `.env.example`

```
# Test environment
BASE_URL=

# Swagger / OpenAPI link or file path, used by `npm run types:api`
OPENAPI_SOURCE=

# Web app address for browser tests, if it differs from BASE_URL
WEB_URL=

# One pair per role named in the interview
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

Claude writes the non-secret values (`BASE_URL`, `OPENAPI_SOURCE`, `WEB_URL`) into `.env` during
generation, so type generation works at once. The user adds only emails and passwords.

## `src/api/base-client.ts`

```ts
import type { APIRequestContext, APIResponse } from '@playwright/test';

type RequestOptions = Parameters<APIRequestContext['fetch']>[1];

export class BaseClient {
  constructor(
    protected readonly request: APIRequestContext,
    private readonly token?: string,
  ) {}

  send(method: string, url: string, options: RequestOptions = {}): Promise<APIResponse> {
    // A leading slash would drop the path part of BASE_URL.
    return this.request.fetch(url.replace(/^\//, ''), {
      ...options,
      method,
      failOnStatusCode: false,
      headers: {
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...options.headers,
      },
    });
  }
}
```

`failOnStatusCode: false` lets a test assert a 401 or 422 as a normal response.

## `src/matchers/to-match-schema.ts`

```ts
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import type { components } from '../types/api';
import apiSchemas from '../types/api-schemas.json';

/** Every schema named in the API description. Regenerate with `npm run types:api`. */
export type SchemaName = keyof components['schemas'];

// strict: false, because OpenAPI adds keywords plain JSON Schema does not know.
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(apiSchemas, 'api');

const compiled = new Map<string, ValidateFunction>();

function validator(schema: SchemaName | object, list: boolean): ValidateFunction {
  const item = typeof schema === 'string' ? { $ref: `api#/components/schemas/${schema}` } : schema;
  const key = `${list}:${JSON.stringify(item)}`;
  let validate = compiled.get(key);
  if (!validate) {
    validate = ajv.compile(list ? { type: 'array', items: item } : item);
    compiled.set(key, validate);
  }
  return validate;
}

function check(received: unknown, schema: SchemaName | object, list: boolean) {
  const validate = validator(schema, list);
  const pass = validate(received) === true;
  const name = typeof schema === 'string' ? schema : 'the schema';
  const problems = (validate.errors ?? [])
    .map((error) => `  ${error.instancePath || '(body)'} ${error.message ?? ''}`)
    .join('\n');

  return {
    pass,
    message: () =>
      pass
        ? `Expected the body not to match ${name}, but it does.`
        : `The body does not match ${name}${list ? '[]' : ''}:\n${problems}\n\nReceived: ${JSON.stringify(received, null, 2)}`,
  };
}

/** `expect(body).toMatchSchema('Ticket')` — a schema name from the API description, or a schema object. */
export function toMatchSchema(received: unknown, schema: SchemaName | object) {
  return check(received, schema, false);
}

/** `expect(body).toMatchArrayOf('Ticket')` — the body is a list and every item matches. */
export function toMatchArrayOf(received: unknown, schema: SchemaName | object) {
  return check(received, schema, true);
}
```

The matchers are synchronous on purpose: an async matcher without `await` passes silently.
No API description: drop the two `../types` imports and `ajv.addSchema`, make `SchemaName` `never`;
tests then pass schema objects written from real responses.

## `src/fixtures/index.ts`

The code below is written for a sample API with roles `admin` and `tester`. `Role`, the `<role>Api`
fixtures and, in the auth setup, the top block and the role lines are what you change for the
real product; an API without roles keeps only `api` and one authorised client. Later skills rely on these
exact names: `test`, `expect`, `Schemas`, `Body`, `unique`, `clientFor`, `api`, `<role>Api`.

```ts
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { expect as baseExpect, test as base, type APIRequestContext } from '@playwright/test';
import { BaseClient } from '../api/base-client';
import { toMatchArrayOf, toMatchSchema } from '../matchers/to-match-schema';
import type { components, paths } from '../types/api';

/** Body types from the API description: `const ticket: Schemas['Ticket'] = await response.json()`. */
export type Schemas = components['schemas'];

/**
 * Request body of an operation, checked against the API description:
 * `const data: Body<'/tickets', 'post'> = { projectId, title }`.
 */
export type Body<Path extends keyof paths, Method extends keyof paths[Path]> = paths[Path][Method] extends {
  requestBody?: { content: { 'application/json': infer Json } };
}
  ? Json
  : never;

/** A value that does not repeat between runs and parallel workers: `unique('ticket')`. */
export const unique = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${randomUUID().slice(0, 4)}`;

export type Role = 'admin' | 'tester';

/** What the auth setup stores per role. `password` only for accounts the setup created. */
export type AuthState = { token: string; email?: string; password?: string };

export const authFile = (role: Role): string => path.join(__dirname, '../../.auth', `${role}.json`);

export function readAuthState(role: Role): AuthState | undefined {
  const file = authFile(role);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as AuthState) : undefined;
}

/**
 * A client for a role; without a role, a client with no token.
 * Fixtures below cover tests. Use this directly in `beforeAll` / `afterAll`, where only `request` exists.
 */
export function clientFor(request: APIRequestContext, role?: Role): BaseClient {
  if (!role) return new BaseClient(request);
  const token = readAuthState(role)?.token;
  if (!token) {
    throw new Error(
      `No saved login for "${role}" (.auth/${role}.json). Run \`npx playwright test --project=setup\` and read its message.`,
    );
  }
  return new BaseClient(request, token);
}

type ApiFixtures = {
  /** No token: endpoints without login and 401 checks. */
  api: BaseClient;
  adminApi: BaseClient;
  testerApi: BaseClient;
};

export const test = base.extend<ApiFixtures>({
  api: async ({ request }, use) => use(clientFor(request)),
  adminApi: async ({ request }, use) => use(clientFor(request, 'admin')),
  testerApi: async ({ request }, use) => use(clientFor(request, 'tester')),
});

export const expect = baseExpect.extend({ toMatchSchema, toMatchArrayOf });
```

## How a test uses the pieces

Not generated by the bootstrap; this is the shape the writer skill follows. Write it into
`CLAUDE.md` as the convention.

```ts
import { clientFor, expect, test, type Schemas } from '../../../src/fixtures';

test('200: returns the ticket in the documented shape', { tag: '@smoke' }, async ({ adminApi }) => {
  const response = await adminApi.send('GET', `/tickets/${ticket.id}`);

  expect(response.status()).toBe(200);
  const body: Schemas['Ticket'] = await response.json();
  expect(body).toMatchSchema('Ticket');
  expect(body.id).toBe(ticket.id);
});
```

- Type the body with `Schemas[...]`. `expect(await response.json())` without a type does not offer
  the schema matchers.
- Lists: `expect(body).toMatchArrayOf('Ticket')`.
- Request bodies: `const data: Body<'/tickets', 'post'> = { ... }`, so a wrong field name fails the
  type check.
- Names that must not collide: `unique('ticket')`.
- Data for a group of tests: `test.beforeAll(async ({ request }) => { const admin = clientFor(request, 'admin'); ... })`.
  Role fixtures do not exist in `beforeAll` / `afterAll`.

## `tests/api/health/health.spec.ts`

```ts
import { expect, test } from '@playwright/test';

test('service answers', { tag: '@smoke' }, async ({ request }) => {
  // No leading slash: the path is added to BASE_URL, including its own path.
  const response = await request.get('<path from the interview, without the leading slash>');

  expect(response.status()).toBe(200);
});
```

## Auth setup: `tests/_setup/auth.setup.ts`

Template for token login (a login endpoint returns a token). Adapt the block at the top and the
role lines at the bottom; leave the helpers as they are. All five paths were exercised: first login,
session reuse, stale token, refused saved credentials, login limit (429).

```ts
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test as setup, type APIRequestContext, type APIResponse } from '@playwright/test';
import { BaseClient } from '../../src/api/base-client';
import { authFile, readAuthState, type AuthState, type Role } from '../../src/fixtures';

// ---- Adapt this block to the API description. Nothing below it is project-specific. ----
const LOGIN_PATH = '/auth/login';
/** Any cheap request that needs a token; used to check a saved session. */
const SESSION_CHECK_PATH = '/me';
const loginBody = (email: string, password: string) => ({ email, password });
const tokenFrom = (body: { token: string }): string => body.token;
// -----------------------------------------------------------------------------------------

// Roles can depend on each other (an admin creates a tester), so the order matters.
setup.describe.configure({ mode: 'serial' });

function save(role: Role, state: AuthState): void {
  fs.mkdirSync(path.dirname(authFile(role)), { recursive: true });
  fs.writeFileSync(authFile(role), JSON.stringify(state, null, 2));
}

/** A saved token is reused while the API still accepts it: this keeps runs under the login limit. */
async function sessionWorks(request: APIRequestContext, state: AuthState | undefined): Promise<boolean> {
  if (!state?.token) return false;
  const response = await new BaseClient(request, state.token).send('GET', SESSION_CHECK_PATH);
  return response.status() === 200;
}

async function logIn(request: APIRequestContext, email: string, password: string): Promise<APIResponse> {
  const response = await new BaseClient(request).send('POST', LOGIN_PATH, { data: loginBody(email, password) });
  if (response.status() === 429) {
    const wait = response.headers()['retry-after'] ?? 'a few';
    throw new Error(`Login limit reached for ${email} (429). Wait ${wait} seconds and run again.`);
  }
  return response;
}

/** A role whose account exists: credentials come from `.env`. */
async function useExistingAccount(request: APIRequestContext, role: Role): Promise<void> {
  const prefix = role.toUpperCase();
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  const missing = [!email && `${prefix}_EMAIL`, !password && `${prefix}_PASSWORD`].filter(Boolean);
  if (!email || !password) throw new Error(`Missing in .env: ${missing.join(', ')}. See .env.example.`);

  const saved = readAuthState(role);
  if (saved?.email === email && (await sessionWorks(request, saved))) return;

  const response = await logIn(request, email, password);
  expect(response.status(), `${LOGIN_PATH} did not accept ${prefix}_EMAIL / ${prefix}_PASSWORD from .env`).toBe(200);
  save(role, { token: tokenFrom(await response.json()), email });
}

/** A role without an account: `creator` makes one through the API, once; later runs reuse it. */
async function useCreatedAccount(
  request: APIRequestContext,
  role: Role,
  creator: Role,
  create: (client: BaseClient, email: string, password: string) => Promise<APIResponse>,
): Promise<void> {
  const saved = readAuthState(role);
  if (await sessionWorks(request, saved)) return;

  // The account from an earlier run may still exist: try its saved credentials first.
  if (saved?.email && saved.password) {
    const again = await logIn(request, saved.email, saved.password);
    if (again.status() === 200) {
      save(role, { ...saved, token: tokenFrom(await again.json()) });
      return;
    }
  }

  const creatorToken = readAuthState(creator)?.token;
  expect(creatorToken, `"${role}" is created by "${creator}": the ${creator} login must pass first`).toBeTruthy();

  const email = `qa-${role}-${Date.now()}@example.test`;
  const password = randomUUID();
  const created = await create(new BaseClient(request, creatorToken), email, password);
  expect(created.ok(), `Creating the ${role} account answered ${created.status()}: ${await created.text()}`).toBe(true);

  const response = await logIn(request, email, password);
  expect(response.status(), `${LOGIN_PATH} did not accept the ${role} account that was just created`).toBe(200);
  save(role, { token: tokenFrom(await response.json()), email, password });
}

// ---- One line per role, from the interview. ----

setup('admin: log in', async ({ request }) => {
  await useExistingAccount(request, 'admin');
});

setup('tester: created by admin', async ({ request }) => {
  await useCreatedAccount(request, 'tester', 'admin', (admin, email, password) =>
    admin.send('POST', '/users', { data: { email, password, name: 'QA tester (autotests)', role: 'tester' } }),
  );
});
```

Rules for every login type:

- One setup test per role, in interview order; a role created by another role comes after it.
- `.auth/` is ignored by git. Deleting it forces a fresh login; a role created by setup then gets a
  new account, and the old one stays on the server. Say this in the README.
- Cookie login: replace the token handling with
  `await request.storageState({ path: authFile(role) })` and build clients from that state.
- Static API key: no setup project; the key is read from env in `clientFor`.
- Self-registered users: `useCreatedAccount` with the registration call and no creator token.

## GitHub Actions workflow

```yaml
name: QA Playwright

on:
  workflow_dispatch:
    inputs:
      project:
        description: 'Playwright project, for example api-users. Empty runs all.'
        default: ''
      grep:
        description: 'Tag or title filter. Empty runs all.'
        default: '@smoke'

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    defaults:
      run:
        working-directory: qa
    env:
      BASE_URL: ${{ secrets.QA_BASE_URL }}
      ADMIN_EMAIL: ${{ secrets.QA_ADMIN_EMAIL }}
      ADMIN_PASSWORD: ${{ secrets.QA_ADMIN_PASSWORD }}
      INPUT_PROJECT: ${{ inputs.project }}
      INPUT_GREP: ${{ inputs.grep }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: |
          args=()
          [ -n "$INPUT_PROJECT" ] && args+=(--project="$INPUT_PROJECT")
          [ -n "$INPUT_GREP" ] && args+=(--grep "$INPUT_GREP")
          npx playwright test "${args[@]}"
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: qa/playwright-report
          retention-days: 14
```

Inputs go through `env`, never straight into the shell line. Add `WEB_URL` when browser tests exist. One secret pair per role. In a
separate repository remove `defaults.run.working-directory` and use `path: playwright-report`.
If `BASE_URL` is `localhost` or behind a VPN, say in the README that hosted CI cannot reach it. Drop the browser install step for an
API-only project. Add `schedule` only when nightly was chosen. For other CI providers, keep the
same shape: manual trigger, two inputs, report as an artifact.

## `CLAUDE.md` in the test folder

Two parts. **Setup** records the interview so later skills do not ask again. **Project profile**
records what is particular about this product; it is the only place where project-specific rules
live. The skills stay universal and read this file first; they add to it, never to themselves.

Fill the profile only with what you observed in the API description, the codebase or a real
response. Leave a line out rather than guess. Mark where each fact came from.

```md
# QA project

## Setup
- Run commands and Claude Code from this folder.
- Tests: <API and browser | API only>. Domains live in `tests/api/<domain>/`; a new folder is a
  new project. First domain planned: <domain>.
- Tags: `@smoke`, `@regression`.
- API description: `OPENAPI_SOURCE`, regenerate types and schemas with `npm run types:api`.
- Login: <type and endpoint>. Roles: <role (where its account comes from)>, ... State in `.auth/`.
- Environment: <test | shared | close to production>. <what tests may change>
- Secrets live in `.env` only.
- Browser login: not set up yet. `e2e-writer` adds it with the first browser test.

## Project profile
- Product: <one line: what it is, how accounts or tenants are separated>. (<source>)
- Errors: <body shape and schema name; which field tests assert>. (<source>)
- Statuses in use: <status: when>. (<source>)
- Ids and lists: <id type; list or paging shape>. (<source>)
- Limits: <only limits that are stated or were hit>. (<source>)
- Do not call from tests: <endpoint: what it destroys>. (<source>)
- Business rules worth a test: <two or three>. (<source>)
- Open questions: <what the description leaves unsaid>.

## Test conventions
- Import from `src/fixtures`: `test`, `expect`, `Schemas`, `Body`, `unique`, `clientFor`.
- Order of checks: status, schema, values.
- <the usage example from "How a test uses the pieces", with this product's names>
```

`<source>` is one of: description, codebase, real response, user. Write a line only for what you
found; delete the rest. Never copy a fact from this template or from another project.

## `README.md`

Short, for a person who has never run Playwright. Sections in this order:

1. First run: `npm install`, how to open the hidden `.env` (`code .env`), what to put in it.
2. Commands. Use only forms that work in every shell: `npm test`, `npm run test:api`,
   `npm run test:smoke`, `npx playwright test --project=api-users`, `npm run report`,
   `npm run types:api`. A wildcard typed by hand needs quotes: `--project="api-*"`.
3. Reading a red run: the first line of the error is the cause; "did not run" means setup failed,
   read the setup error first; `Missing in .env: ...` names what to fill.
4. Login problems: delete the `.auth/` folder and run again.
5. CI: where the secrets go (GitHub: Settings → Secrets and variables → Actions → New repository
   secret), their names, and whether CI can reach the environment.
6. Next step: call `api-contract-writer` with an endpoint, or `e2e-writer` with a scenario.

