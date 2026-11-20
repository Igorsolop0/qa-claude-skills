# Templates

## Folder tree (API and browser, inside a repository)

```
qa/
  .env.example
  .gitignore
  AGENTS.md                 # the project's rules, profile and skill routing: every agent reads it
  CLAUDE.md                 # one line, `@AGENTS.md`: Claude Code reads this file and imports the other
  README.md
  eslint.config.mjs
  package.json
  playwright.config.ts
  tsconfig.json
  scripts/generate-api-types.mjs
  src/
    api/base-client.ts
    config/tags.ts
    fixtures/api.fixture.ts
    fixtures/index.ts         # merges the fixture files into the one `test`
    matchers/to-match-schema.ts
    types/api.d.ts            # generated, committed
    types/api-schemas.json    # generated, committed
    utils/unique.ts
    utils/unique.test.ts
  tests/
    _setup/auth.setup.ts
    api/health/health.spec.ts
```

Do not create empty folders: git does not keep them. `tests/api/<domain>/` appears with its first
spec, `tests/e2e/`, `src/ui/` and `test-data/` with the first browser test. In a separate repository
the same tree is the repository root (no `qa/` level).

What lives where, and what may not:

| Path | Holds |
|---|---|
| `tests/` | `*.spec.ts` only, plus `_setup/`. No helpers, page objects, data or fixtures. |
| `src/api/` | HTTP clients. |
| `src/ui/` | Page objects (`pages/`, `components/`) and the `App` container (`e2e-writer` adds them). |
| `src/fixtures/` | Fixture wiring: one `<domain>.fixture.ts` per domain, merged in `index.ts`. |
| `src/utils/` | Pure functions with no `page`, `request` or `test`, each with a `*.test.ts` next to it. |
| `src/config/` | Tags, addresses. |
| `test-data/` | Builders and presets of input data. |

## Dev dependencies

Install exactly these, with these ranges. Unpinned installs break: `openapi-typescript` 7 needs
TypeScript 5 and crashes on TypeScript 7.

```
npm install -D @playwright/test typescript@^5 openapi-typescript@^7 yaml@^2 dotenv@^17 ajv@^8 ajv-formats@^3 @types/node@<major> eslint@^10 typescript-eslint@^8 eslint-plugin-playwright@^2
```

`<major>` is the first number of `node --version` (Node 24 gives `@types/node@24`). Leave out
`openapi-typescript` and `yaml` when there is no API description. Commit `package-lock.json`:
`npm ci` in CI needs it.

## `tsconfig.json`

`paths` gives the `@/…` and `@test-data/…` imports. Playwright and `tsc` both read them; no
`baseUrl` is needed.

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
    "types": ["node"],
    "paths": {
      "@/*": ["./src/*"],
      "@test-data/*": ["./test-data/*"]
    }
  },
  "include": ["playwright.config.ts", "src", "test-data", "tests"]
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
import { defineConfig } from '@playwright/test';
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
// A domain whose tests use only `api` (no token) goes here too, so a failed login does not stop it.
const noLogin = new Set(['health']);
const utilsDir = path.join(__dirname, 'src/utils');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // `results.json` is what `pw-failure-triage` reads when a run goes red.
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
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
    // Unit tests of the pure functions in src/utils/, next to the code (`*.test.ts`). No browser, no API.
    ...(fs.existsSync(utilsDir) ? [{ name: 'unit', testDir: './src/utils', testMatch: /.*\.test\.ts/ }] : []),
  ],
});
```

Leave out the `setup` project and `dependencies` when there is no login. The `e2e` project appears
with the first browser test, which `e2e-writer` adds. `baseURL` stays the API address; pages are
opened by full address from `WEB_URL` (or `BASE_URL` when the web app and the API share one).

The `unit` project runs the `*.test.ts` files next to the pure functions in `src/utils/`: Playwright's
own runner, so they need no extra tool and the `@/` imports work. `tests/` never holds a `*.test.ts`.

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
    "test:unit": "playwright test --project=unit",
    "test:smoke": "playwright test --grep @smoke",
    "report": "playwright show-report",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
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

## `src/config/tags.ts`

```ts
/**
 * Every tag a test may carry: `tag: [Tag.smoke, Tag.auth]`, never a raw `'@…'` string. Add a new tag here
 * first. Regression is every test, so there is no regression tag: a run without `--grep` is the regression run.
 */
export const Tag = {
  smoke: '@smoke',
  auth: '@auth',
} as const;
```

Start with `smoke` and the tag of the first domain. A spec writes `tag: [Tag.smoke, Tag.users]`;
`--grep @smoke` still selects by the string. A typo in a raw `'@smok'` would drop the test out of a
run without any error; a typo in `Tag.smok` fails the type check.

## `src/utils/unique.ts` and its unit test

```ts
import { randomUUID } from 'node:crypto';

/** Marks what tests create, so leftovers on a shared environment can be found and filtered. */
export const TEST_DATA_PREFIX = 'qa-pw';

/** A value that does not repeat between runs and parallel workers: `unique('ticket')` → `qa-pw-ticket-…`. */
export function unique(name: string): string {
  return `${TEST_DATA_PREFIX}-${name}-${Date.now().toString(36)}-${randomUUID().slice(0, 4)}`;
}
```

```ts
import { expect, test } from '@playwright/test';
import { unique } from './unique';

test('unique marks the value as test data, keeps the name and never repeats', () => {
  const values = new Set(Array.from({ length: 50 }, () => unique('ticket')));

  expect(values.size).toBe(50);
  for (const value of values) expect(value).toMatch(/^qa-pw-ticket-[a-z0-9]+-[a-f0-9]{4}$/);
});
```

## `src/fixtures/api.fixture.ts`

The code below is written for a sample API with roles `admin` and `tester`. `Role`, the `<role>Api`
fixtures and, in the auth setup, the top block and the role lines are what you change for the
real product; an API without roles keeps only `api` and one authorised client. Later skills rely on these
exact names: `test`, `expect`, `Schemas`, `Body`, `unique`, `clientFor`, `api`, `<role>Api`.

```ts
import fs from 'node:fs';
import path from 'node:path';
import { test as base, type APIRequestContext } from '@playwright/test';
import { BaseClient } from '../api/base-client';
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
```

No API description: drop the `../types/api` import, and replace the two types with
`export type Schemas = Record<string, any>;` and
`export type Body<_Path extends string, _Method extends string> = Record<string, unknown>;`.
Tests then type response bodies with interfaces in `test-data/`, written from real responses, and
schemas are passed to `toMatchSchema` as objects.

## `src/fixtures/index.ts`

The one `test` and `expect` every spec imports. A new domain gets its own `<domain>.fixture.ts`
(extending `api.fixture.ts` or another fixture it needs) and one more argument to `mergeTests`.

```ts
/**
 * The one `test` and `expect` every spec imports: `import { expect, test } from '@/fixtures'`.
 * Each domain keeps its fixtures in its own `<domain>.fixture.ts`; this file only merges them. Playwright
 * sets a fixture up only when a test asks for it, so merging costs nothing for the tests that do not.
 */
import { expect as baseExpect, mergeTests } from '@playwright/test';
import { toMatchArrayOf, toMatchSchema } from '../matchers/to-match-schema';
import { test as apiTest } from './api.fixture';

export const test = mergeTests(apiTest);

export const expect = baseExpect.extend({ toMatchSchema, toMatchArrayOf });

export { type AuthState, authFile, type Body, clientFor, type Role, readAuthState, type Schemas } from './api.fixture';
export { unique } from '../utils/unique';
```

## How a test uses the pieces

Not generated by the bootstrap; this is the shape the writer skills follow. Write it into
`AGENTS.md` as the convention.

```ts
import { Tag } from '@/config/tags';
import { expect, type Schemas, test } from '@/fixtures';

test('200: returns the ticket in the documented shape', { tag: [Tag.smoke, Tag.tickets] }, async ({ adminApi, ticket }) => {
  const response = await adminApi.send('GET', `/tickets/${ticket.id}`);

  expect(response.status()).toBe(200);
  const body: Schemas['Ticket'] = await response.json();
  expect(body).toMatchSchema('Ticket');
  expect(body.id).toBe(ticket.id);
});
```

- `ticket` is a precondition fixture (`src/fixtures/tickets.fixture.ts`): it creates the ticket
  through the API before the test and deletes it after. Data a test needs is a fixture, not steps at
  the top of the test.
- Type the body with `Schemas[...]`. `expect(await response.json())` without a type does not offer
  the schema matchers.
- Lists: `expect(body).toMatchArrayOf('Ticket')`.
- Request bodies: `const data: Body<'/tickets', 'post'> = { ... }`, so a wrong field name fails the
  type check.
- Names that must not collide: `unique('ticket')`.
- Imports through `@/…` and `@test-data/…`; `test` and `expect` only from `@/fixtures`.

## `tests/api/health/health.spec.ts`

```ts
import { Tag } from '@/config/tags';
import { expect, test } from '@/fixtures';

test('service answers', { tag: [Tag.smoke] }, async ({ api }) => {
  // No leading slash needed: the client adds the path to BASE_URL, including its own path.
  const response = await api.send('GET', '<path from the interview>');

  expect(response.status()).toBe(200);
});
```

## Auth setup: `tests/_setup/auth.setup.ts`

Template for token login (a login endpoint returns a token). Adapt the block at the top and the
role lines at the bottom; leave the helpers as they are. Exercised paths: first login, session
reuse, stale token, refused saved credentials, login limit (429), self-registration.

```ts
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { APIRequestContext, APIResponse } from '@playwright/test';
import { BaseClient } from '@/api/base-client';
import { type AuthState, authFile, expect, type Role, readAuthState, test as setup, unique } from '@/fixtures';

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

/**
 * A role without an account: it is created through the API once, and later runs reuse it. `creator` is
 * the role whose token makes the call (an admin adds a tester); leave it out when anyone may register.
 */
async function useCreatedAccount(
  request: APIRequestContext,
  role: Role,
  create: (client: BaseClient, email: string, password: string) => Promise<APIResponse>,
  creator?: Role,
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

  const creatorToken = creator ? readAuthState(creator)?.token : undefined;
  if (creator) {
    expect(creatorToken, `"${role}" is created by "${creator}": the ${creator} login must pass first`).toBeTruthy();
  }

  // `unique()` marks the account with `qa-pw-`, so it can be found on a shared environment.
  const email = `${unique(role)}@example.test`;
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
  await useCreatedAccount(
    request,
    'tester',
    (admin, email, password) =>
      admin.send('POST', '/users', { data: { email, password, name: 'QA tester (autotests)', role: 'tester' } }),
    'admin',
  );
});

// Anyone may register: no creator.
// setup('member: registers itself', async ({ request }) => {
//   await useCreatedAccount(request, 'member', (client, email, password) =>
//     client.send('POST', '/auth/register', { data: { email, password, name: 'QA member (autotests)' } }),
//   );
// });
```

Rules for every login type:

- One setup test per role, in interview order; a role created by another role comes after it.
- `.auth/` is ignored by git. Deleting it forces a fresh login; a role created by setup then gets a
  new account, and the old one stays on the server. Say this in the README.
- Cookie login: replace the token handling with
  `await request.storageState({ path: authFile(role) })` and build clients from that state.
- Static API key: no setup project; the key is read from env in `clientFor`.
- Self-registered users: `useCreatedAccount` with the registration call and no creator.
- A setup test asserts inside its helpers; `eslint.config.mjs` turns `expect-expect` off for `tests/_setup/`.

## `eslint.config.mjs`

The rules a reviewer would otherwise repeat in every pull request. `npm run lint` runs them, CI runs
them on every push, and the writer skills run them before they say "done". The page object rules
apply as soon as `e2e-writer` adds `src/ui/`; until then they find nothing.

```js
// Playwright rules and the architecture rules of this project. What each rule protects: AGENTS.md.
import { defineConfig } from 'eslint/config';
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

/** Specs get page objects from the `app` fixtures and `test`/`expect` from `@/fixtures`. */
const SPEC_IMPORTS = {
  paths: [
    {
      name: '@playwright/test',
      importNames: ['test', 'expect'],
      allowTypeImports: true,
      message: 'Import `test` and `expect` from `@/fixtures`.',
    },
    {
      name: '@/ui/app',
      importNames: ['createApp', 'App'],
      allowTypeImports: true,
      message: '`createApp` is for fixtures only: take `app`, `<role>App` or `shared<Role>App` from the test arguments.',
    },
  ],
  patterns: [
    {
      group: ['@/ui/pages/*', '@/ui/components/*'],
      allowTypeImports: true,
      // The copy a page object checks (`REGISTER_COPY`) is data a spec may assert against.
      allowImportNamePattern: '_COPY$',
      message: 'Take the page object from the `app` fixture; do not construct it in a spec.',
    },
    {
      group: ['@/fixtures/*'],
      importNames: ['test', 'expect'],
      allowTypeImports: true,
      message: 'Import `test` and `expect` from `@/fixtures`, not from one fixture file.',
    },
    { group: ['**/src/**', '**/src'], message: 'Import from `@/…` (tsconfig alias), not a relative src path.' },
    { group: ['**/test-data/**', '**/test-data'], message: 'Import from `@test-data/…`, not a relative path.' },
  ],
};

/** A spec acts through page object methods, never on a locator. */
const LOCATOR_ACTION = {
  selector:
    'CallExpression[callee.property.name=/^(click|dblclick|fill|press|pressSequentially|tap|check|uncheck|selectOption|setInputFiles|hover|type|clear)$/]',
  message: 'Act through a page object method, not on a locator in the spec.',
};

/** Every public async method of a page object is a `@step`, so the report reads as user actions. */
const UNSTEPPED_METHOD = {
  selector:
    'ClassBody > MethodDefinition[kind="method"][static=false][value.async=true][key.type="Identifier"][accessibility!="private"][decorators.length=0]',
  message: 'Put `@step` on a public async page object method (a read polled by `expect.poll` may opt out).',
};

/** Rules that would otherwise stay warnings: a warning does not stop `npm run lint` or CI. */
const STRICT = {
  'playwright/no-wait-for-timeout': 'error',
  'playwright/no-force-option': 'error',
  'playwright/no-conditional-in-test': 'error',
  'playwright/no-conditional-expect': 'error',
  'playwright/no-networkidle': 'error',
  'playwright/prefer-web-first-assertions': 'error',
};

export default defineConfig(
  {
    ignores: ['.auth/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'src/types/**'],
  },
  {
    // The throwaway spec for looking at a page (`e2e-writer`) is not a test and is deleted after use.
    ignores: ['tests/**/_look.spec.ts'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      // Type information, so a call to an async page object method without `await` is an error.
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: { '@typescript-eslint/no-floating-promises': 'error' },
  },
  {
    files: ['tests/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      ...STRICT,
      // `expect*` page object methods count as assertions.
      'playwright/expect-expect': ['error', { assertFunctionPatterns: ['^expect[A-Z]'] }],
      // Tags come from the `Tag` constants, which this rule cannot read.
      'playwright/valid-test-tags': 'off',
      // Blank lines are formatting, not behaviour.
      'playwright/consistent-spacing-between-blocks': 'off',
      '@typescript-eslint/no-restricted-imports': ['error', SPEC_IMPORTS],
    },
  },
  {
    // A setup test asserts inside its helpers (`useCreatedAccount`), which the rule cannot see.
    files: ['tests/_setup/**'],
    rules: { 'playwright/expect-expect': 'off' },
  },
  {
    files: ['tests/e2e/**/*.spec.ts'],
    rules: { 'no-restricted-syntax': ['error', LOCATOR_ACTION] },
  },
  {
    // Page objects get the same Playwright rules (a missing `await`, `waitForTimeout`, `{ force: true }`).
    files: ['src/ui/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      ...STRICT,
      // A page object is not a test: it holds `expect*` methods and no `test()`.
      'playwright/expect-expect': 'off',
      'playwright/no-standalone-expect': 'off',
      'playwright/no-conditional-in-test': 'off',
      'playwright/no-conditional-expect': 'off',
      'no-restricted-syntax': ['error', UNSTEPPED_METHOD],
    },
  },
);
```

What the rules catch, in the words to use with a person new to ESLint:

| Rule | Catches |
|---|---|
| `playwright/*` recommended | a missing `await`, `waitForTimeout`, `networkidle`, `{ force: true }`, `isVisible()` where a web-first assertion waits, a test with no assertion |
| `test` / `expect` from `@/fixtures` | a spec that misses the project's matchers and fixtures |
| page objects and `createApp` from the fixtures | a spec that builds its own page objects |
| no action on a locator in a spec | `.click()` / `.fill()` in a spec: actions belong to page objects |
| `@` aliases | `../../../src/...` imports |
| `@step` on public async page object methods | a page object action that would not show in the report |
| `no-floating-promises` (type-aware) | a call to an async page object method without `await`: the test would end before the step |
| Playwright rules on `src/ui/` too | the same mistakes inside page objects, where specs cannot see them |

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
  # Only when "on every push to the main branch" was chosen:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    defaults:
      run:
        working-directory: qa
    env:
      # Addresses are not secrets: write them here, so a new repository runs without any setting.
      BASE_URL: <base URL from the interview>
      # Credentials are: one secret pair per role whose account exists.
      ADMIN_EMAIL: ${{ secrets.QA_ADMIN_EMAIL }}
      ADMIN_PASSWORD: ${{ secrets.QA_ADMIN_PASSWORD }}
      INPUT_PROJECT: ${{ inputs.project }}
      INPUT_GREP: ${{ inputs.grep }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: lts/*
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npx playwright install --with-deps chromium
      - run: |
          args=()
          [ -n "$INPUT_PROJECT" ] && args+=(--project="$INPUT_PROJECT")
          [ -n "$INPUT_GREP" ] && args+=(--grep "$INPUT_GREP")
          npx playwright test "${args[@]}"
      - uses: actions/upload-artifact@v7
        if: always()
        with:
          name: playwright-report
          path: qa/playwright-report
          retention-days: 14
```

Inputs go through `env`, never straight into the shell line; on a push they are empty, so the push
runs every test, while a manual run defaults to `@smoke`. Use the action versions above or newer:
older majors run on a Node version GitHub has retired and print a warning on every run. Add `WEB_URL` when the web app has another address. Roles that tests create
themselves need no secret. In a separate repository remove `defaults.run.working-directory` and use
`path: playwright-report`. If `BASE_URL` is `localhost` or behind a VPN, say in the README that
hosted CI cannot reach it. Drop the browser install step for an API-only project. Add `schedule`
only when nightly was chosen. For other CI providers, keep the same shape: manual trigger, two
inputs, type check, lint, tests, report as an artifact.

## `AGENTS.md` and `CLAUDE.md` in the test folder

`AGENTS.md` is the one file with the project's rules: Claude Code, Cursor and Codex all read it.
`CLAUDE.md` holds a single line, so Claude Code loads `AGENTS.md` through it:

```md
@AGENTS.md
```

`AGENTS.md` has four parts. **Setup** records the interview so later skills do not ask again.
**Project profile** records what is particular about this product; it is the only place where
project-specific rules live. **Test conventions** say how tests are written here. **Skills** says
which skill does which job. The skills stay universal and read this file first; they add to it,
never to themselves.

Fill the profile only with what you observed in the API description, the codebase or a real
response. Leave a line out rather than guess. Mark where each fact came from.

```md
# QA project

## Setup
- Run commands and Claude Code from this folder.
- Tests: <API and browser | API only>. Domains live in `tests/api/<domain>/`; a new folder is a
  new project. First domain planned: <domain>.
- Tags: from `src/config/tags.ts` only (`tag: [Tag.smoke, Tag.<domain>]`). Regression is every test,
  so there is no regression tag.
- API description: `OPENAPI_SOURCE`, regenerate types and schemas with `npm run types:api`.
- Login: <type and endpoint>. Roles: <role (where its account comes from)>, ... State in `.auth/`.
- Environment: <test | shared | close to production>. <what tests may change>
- Secrets live in `.env` only.
- Browser: not set up yet. `e2e-writer` adds it with the first browser test.

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
- `tests/` holds specs only. Clients in `src/api/`, fixtures in `src/fixtures/<domain>.fixture.ts`
  (merged in `index.ts`), pure functions with unit tests in `src/utils/`, input data in `test-data/`.
- Import `test`, `expect`, `Schemas`, `Body`, `unique`, `clientFor` from `@/fixtures`; `Tag` from
  `@/config/tags`. No relative path into `src/`.
- Data a test needs before it starts comes from a fixture that creates and deletes it.
- Order of checks: status, schema, values.
- Before saying "done": `npm run typecheck`, `npm run lint`, the new tests green, each new test
  shown to fail once.
- <the usage example from "How a test uses the pieces", with this product's names>

## Skills
| Job | Skill |
|---|---|
| Tests for one API endpoint | `api-contract-writer` |
| A browser test for one scenario, with its page objects | `e2e-writer` |
| Review API tests before a pull request | `api-contract-reviewer` |
| Review browser tests, prove they can fail (mutation check) | `pw-test-review` |
| A red run: what broke and whose fault it is | `pw-failure-triage` |
| A test plan for a feature before it is built | `qa-shift-left` |
```

`<source>` is one of: description, codebase, real response, user. Write a line only for what you
found; delete the rest. Never copy a fact from this template or from another project.

## `README.md`

Short, for a person who has never run Playwright. Sections in this order:

1. First run: `npm install`, how to open the hidden `.env` (`code .env`), what to put in it.
2. Commands. Use only forms that work in every shell: `npm test`, `npm run test:api`,
   `npm run test:smoke`, `npm run test:unit`, `npx playwright test --project=api-users`,
   `npm run report`, `npm run typecheck`, `npm run lint`, `npm run types:api`. A wildcard typed by
   hand needs quotes: `--project="api-*"`.
3. Reading a red run: the first line of the error is the cause; "did not run" means setup failed,
   read the setup error first; `Missing in .env: ...` names what to fill.
4. Login problems: delete the `.auth/` folder and run again.
5. ESLint in two sentences: it reads the code without running it and stops a change that breaks
   the rules in `eslint.config.mjs` (no `waitForTimeout`, no clicks in specs, imports through
   `@/fixtures`). `npm run lint` shows the same as CI.
6. CI: what triggers it, where secrets go if any role needs one (GitHub: Settings → Secrets and
   variables → Actions → New repository secret), their names, and whether CI can reach the
   environment.
7. Publishing the project on GitHub (a separate repository): `gh auth login`, then
   `gh repo create <name> --private --source . --push`; the push starts the CI run. When a role
   needs a secret: `gh repo create <name> --private --source .`, `gh secret set <NAME>` for each,
   then `git push -u origin main`.
8. Next step: call `api-contract-writer` with an endpoint, or `e2e-writer` with a scenario.
