# API Contract Writer — First Test in a Target, New Domain

## A. One-time bootstrap (done for Client in HEX-1193)

Already in place: `zod` + `openapi-typescript` devDependencies, `generate:types:local` (Client types
from `../openapi-v1.json` into `qa/.schema/client-gateway.d.ts`, wired into Turbo `typecheck` through
`qa/turbo.json`), `src/api/core/*`, `src/config/env.ts`, `src/fixtures/api.fixture.ts`
(`clientApi`, `clientApiWithoutGateAuth`), and the reference spec
`tests/Client/API/auth/register.spec.ts`. Re-read those files before adding to them.

The steps below stay as the checklist for the **Backoffice** target, which still needs its own
types, fixture, and auth:

1. **Dependencies** — add to `qa/package.json` devDependencies:
   - `"zod": "catalog:"`
   - `"openapi-typescript": "7.13.0"` (same pin as `packages/bff`)
   Run `bun install` from the repo root.
2. **Generated types** — add to `qa/package.json` scripts and gitignore `qa/.schema/`:
   ```jsonc
   "generate:types:local": "openapi-typescript ../openapi-v1.json -o .schema/client-gateway.d.ts"
   ```
   For Backoffice, the contract is only published at `{MANAGEMENT_API_GATEWAY_URL}/openapi/v1.json`
   (about 3.4 MB). How CI gets those types (committed snapshot, trimmed spec, or generation with
   network access) is **not decided**. Ask the user before adding a Backoffice generate script.
3. **Typecheck must not depend on a manual step.** If specs import `.schema/*`, wire generation
   into Turbo so `typecheck`/`typecheck:agent` run it first (see how `packages/bff` uses
   `generate:types:local` in `turbo.json`). A package-local `qa/turbo.json` can override inputs
   and outputs. Confirm the approach with the user before editing `turbo.json`.
4. **Core** — `src/api/core/base.client.ts`, `envelopes.ts`, `schema.matcher.ts`
   (templates in `references/conventions.md` and `references/builders.md`).
5. **Fixtures** — `src/fixtures/api.fixture.ts` exporting `test` and `expect`
   (`references/auth-patterns.md`).
6. **Env** — add any new variable **names** to `qa/.env.example` with a comment. Never values.
7. **README** — add the new scripts and env names to `qa/README.md`.

## B. New domain checklist

### 1. Contract and types
Find the endpoint in the target spec. Regenerate types if needed:
```sh
bun run --cwd qa generate:types:local
```
Endpoint or schema missing → stop and report. Partially wrong → augment and report.

### 2. Client
```
qa/src/api/client/<service>/<domain>.client.ts    (service: legacy | gd | ccb | cab)
qa/src/api/client/<service>/<domain>.types.ts
```
or
```
qa/src/api/backoffice/<domain>.client.ts
qa/src/api/backoffice/<domain>.types.ts
```

### 3. Facade
Register the client in `client.api.ts` or `backoffice.api.ts`.

### 4. Builder (payload > 3 fields)
`qa/test-data/<target>/<domain>/<name>.builder.ts`

### 5. Zod schema
`qa/test-data/<target>/<domain>/schemas/<name>.schema.ts`

### 6. Spec
```
qa/tests/Client/API/<domain>/<name>.spec.ts
qa/tests/Backoffice/API/Bonus-Admin/<name>.spec.ts
```

Minimum coverage per endpoint (after the user approves the case list):
- Happy path: status + `toMatchSchema()` (+ success `ResponseCode` for the legacy envelope service).
- Auth: at least one rejected call (missing/invalid gate auth or player token; for Backoffice only
  once the auth contract is known).
- Validation: at least one invalid input with the exact error code/message.

### 7. Playwright project
`client-api` and `backoffice-api` already exist with `testDir` on the target folder. Add a new
project only when a suite needs its own setup dependency:

```typescript
{
  name: "client-api-setup",
  testDir: "./tests/_setup",
  testMatch: /client-api\.setup\.ts/,
},
{
  name: "client-api",
  testDir: "./tests/Client/API",
  dependencies: ["client-api-setup"],
  use: { baseURL: process.env.CLIENT_API_GATEWAY_URL },
},
```

Setup project names end with `-setup` (the Testomat reporter skips them). `testDir` values must not
overlap between projects.

### 8. Verify
```sh
bun run --cwd qa typecheck
bun run --cwd qa lint
bun run --cwd qa e2e:list
bun run --cwd qa e2e:client:api        # live: say which environment and what data was created
bunx turbo run lint:agent typecheck:agent test:agent --filter=qa
```

## Checklist summary

- [ ] Contract located; types generated or gap reported
- [ ] Case list approved by the user
- [ ] Client + types created and registered in the facade
- [ ] Builder (if payload > 3 fields)
- [ ] Zod schema for every new response type
- [ ] Spec: happy path, auth, validation; `@T` id only if Testomat assigned one
- [ ] No credentials, tokens, `UserId`, or `admin-api` anywhere in the diff
- [ ] New env names documented in `qa/.env.example` and `qa/README.md`
- [ ] Typecheck, lint, list pass; live run result reported with environment and created data
