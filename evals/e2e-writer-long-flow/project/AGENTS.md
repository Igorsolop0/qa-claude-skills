# QA project

## Setup
- Run commands and Claude Code from this folder (it is the repository root).
- Tests: API and browser (Chromium). Domains live in `tests/api/<domain>/`; a new folder is a new
  project (`api-<domain>`). First domain planned: `auth`. Currently only `health` exists.
- Tags: from `src/config/tags.ts` only (`tag: [Tag.smoke, Tag.auth]`). Regression is every test,
  so there is no regression tag.
- API description: `OPENAPI_SOURCE` (`https://bugboard.xyz/openapi.json`, Swagger UI at `/docs`).
  Regenerate types and schemas with `npm run types:api`.
- Login: token. `POST /auth/login` returns `{ token, user }`, sent as `Authorization: Bearer <token>`.
  Roles: `admin` (registered by the setup through `POST /auth/register`, once per run; reused from
  `.auth/admin.json` while the token works). Login has a rate limit (429): do not log in per test.
- Environment: shared (https://bugboard.xyz). Tests touch only data they created; names come from
  `unique()` and carry the `qa-pw-` prefix. Each registration gets a private workspace.
- Secrets live in `.env` only. No secret is needed now: the admin account is created by the tests.
- Browser: project `e2e` (Chromium, `tests/e2e/<area>/`), run with `npm run test:e2e`. Web app: `WEB_URL`
  (same host as the API), hash routes (`#/register`, `#/tickets`). The UI has `data-testid` attributes.
  The session is `localStorage['bugboard.session']` = `{ token, user }` (no cookies), so a browser can be
  signed in from outside with `context.addInitScript`. Registration through the form signs the visitor in
  and lands on `#/tickets`.
- CI: GitHub Actions, `.github/workflows/qa.yml`: manual run (`project`, `grep`) and push to `main`.
  Report: HTML (`playwright-report/`) plus `test-results/results.json` for `pw-failure-triage`.

## Project profile
- Product: BugBoard, a practice bug tracker (projects, tickets, comments, reports). Registration
  creates an admin with a private workspace and a demo project; data is not shared between
  workspaces. (description)
- Errors: body `Error` = `{ code, message, details?: [{ path, message }] }`; assert `code`, which
  is stable and machine-readable (for example `NOT_FOUND`). (description, real response)
- Statuses in use: 201 registered, 409 email taken, 422 validation, 401 bad credentials,
  429 login limit, 404 unknown route. (description)
- Ids and lists: ids are integers (`User.id`, minimum 1). (description)
- Roles in `User.role`: `admin`, `tester`. (description)
- Do not call from tests: `POST /workspace/reset` (wipes the workspace data), `DELETE /users/{id}`
  (removes users). Tests delete only what they created, through the endpoint of that object.
  (description)
- `POST /auth/register`: 409 has `code = EMAIL_TAKEN`, 422 has `code = VALIDATION_ERROR` with
  `details[].path` like `/email`. Validation reports only the first error. An extra body field
  (for example `role`) gives 422. The email is case-insensitive (upper case is also 409; not
  covered by a test). (real response)
- The header shows the user in `data-testid="current-user-name"` / `current-user-role` (no role or label).
  Taken-email on the registration form: `role="alert"` with "This email is already registered".
- Open questions: paging and list shape of `/tickets`, `/projects`; ticket status transitions
  (`POST /tickets/{id}/transition`); what the demo project contains.

## Test conventions
- `tests/` holds specs only. Clients in `src/api/`, fixtures in `src/fixtures/<domain>.fixture.ts`
  (merged in `index.ts`), pure functions with unit tests in `src/utils/`, input data in `test-data/`.
- Import `test`, `expect`, `Schemas`, `Body`, `unique`, `clientFor` from `@/fixtures`; `Tag` from
  `@/config/tags`. No relative path into `src/`.
- Data a test needs before it starts comes from a fixture that creates and deletes it. Exception:
  `registeredUser` (`src/fixtures/auth.fixture.ts`, returns `credentials` and `user`) cannot delete
  the account, because `DELETE /users/{id}` is forbidden; its names carry the `qa-pw-` prefix.
- The `auth` domain is in `noLogin` in `playwright.config.ts`: its tests need no admin token.
- Page objects: `src/ui/pages/`, `src/ui/components/`, each a getter in `src/ui/app.ts`. Locators first,
  user-intent methods, `expect*` checks, `@step` on every public async method, copy in `<NAME>_COPY`.
- Browser tests take `app` (visitor) from `@/fixtures`; an existing account comes from `registeredUser`.
  Look at a page before writing a locator: `node scripts/page-snapshot.mjs '<path>'`.
- Order of checks: status, schema, values.
- Before saying "done": `npm run typecheck`, `npm run lint`, the new tests green, each new test
  shown to fail once.
- Example:

```ts
import { Tag } from '@/config/tags';
import { expect, type Schemas, test } from '@/fixtures';

test('200: returns the current user in the documented shape', { tag: [Tag.smoke, Tag.auth] }, async ({ adminApi }) => {
  const response = await adminApi.send('GET', '/me');

  expect(response.status()).toBe(200);
  const body: Schemas['User'] = await response.json();
  expect(body).toMatchSchema('User');
  expect(body.role).toBe('admin');
});
```

## Skills
| Job | Skill |
|---|---|
| Tests for one API endpoint | `api-contract-writer` |
| A browser test for one scenario, with its page objects | `e2e-writer` |
| Review API tests before a pull request | `api-contract-reviewer` |
| Review browser tests, prove they can fail (mutation check) | `pw-test-review` |
| A red run: what broke and whose fault it is | `pw-failure-triage` |
| A test plan for a feature before it is built | `qa-shift-left` |
