# API Contract Writer — Auth Patterns

Two targets, two auth worlds. Never mix them.

## Client — Client API Gateway

### Layer 1: gate auth (every call)

The api-gate in front of the Client API Gateway requires a `gate-auth` header on every request:
Base64 of `API_GATE_USER:API_GATE_PASS` (see `packages/bff/src/http/request.ts` → `buildAuthHeader`).

- Env names: `API_GATE_USER`, `API_GATE_PASS` in `qa/.env` (gitignored). Ask the team lead for
  values; never paste them into code, docs, PRs, or chat.
- The `clientApi` fixture builds the header once and passes it as `extraHTTPHeaders` to
  `playwright.request.newContext()`. Clients and specs never touch credentials.

```typescript
// qa/src/fixtures/api.fixture.ts (excerpt)
clientApi: async ({ playwright }, use) => {
  const user = requireEnv("API_GATE_USER");
  const pass = requireEnv("API_GATE_PASS");
  const request = await playwright.request.newContext({
    baseURL: requireEnv("CLIENT_API_GATEWAY_URL"),
    extraHTTPHeaders: {
      "gate-auth": Buffer.from(`${user}:${pass}`).toString("base64"),
      Accept: "application/json",
    },
  });
  await use(new ClientApi(request, process.env.CLIENT_PARTNER_ID ?? process.env.CLIENT_PARTNER_ID));
  await request.dispose();
},
```

`requireEnv()` throws with the variable **name** when it is missing. It never prints values.

### Layer 2: player JWT (player-scoped endpoints)

Players are **registered by the test run**, never taken from a shared account list.

Flow (same calls the storefront BFF makes in `packages/bff/src/handlers/auth.ts`):

1. `POST /legacy-api/{partnerId}/api/v4/Auth/Register` with a unique `qa-pw-` email, a random
   password, and `PartnerId: <id>`. Copy the full request body from `openapi-v1.json`.
2. Assert HTTP 200 **and** a success `ResponseCode`; read the access token and client id from
   `ResponseObject`.
3. Player-scoped calls add `Authorization: Bearer <accessToken>` through a derived request context
   (`clientApi.withPlayer(player)`), not by editing headers in the spec.
4. `POST .../Auth/Refresh` exists; only test it deliberately. Refresh tokens are single-use.

Fixtures:

| Fixture | What it gives | Scope | Use when |
|---|---|---|---|
| `clientPlayer` | `{ clientId, accessToken }` for a player registered once per worker | worker | the test only reads |
| `freshClientPlayer` | a new registered player for this test | test | the test mutates the player (bonus claim, profile, password) |
| `freshPlayerCredentials` | `{ email, password }` without registering | test | testing Register/Login themselves |

Every player registration creates a real backend account. Keep the count low: reuse the worker
player for reads.

Tokens and passwords live only in memory. If a setup project must persist a session, write it
under `qa/.auth/` (gitignored) and never attach it to reports.

### Unauthenticated / wrong-auth checks

Build a separate context in the fixture (`clientApiWithoutGateAuth`, `clientApi.withPlayer(expiredPlayer)`)
so negative auth tests stay explicit. Never strip headers inside a spec.

Without `gate-auth` the api-gate answers **HTTP 200 with its HTML login page** (qa, 2026-09-17), not 401.

Registration passwords must follow the storefront rule: 6–20 characters from
`packages/ui/src/validation/password.ts`. Longer passwords fail with HTTP 400 `InvalidPassword`.

## Backoffice — Management API Gateway

**Status: confirmed 2026-09-18.** Auth is a static API key on the gateway's `/apikey/*` routes.
Platform docs: the platform's internal docs.

Two API-key schemes exist in the platform. **They are not interchangeable.**

| Scheme | Headers | Scope | Use it? |
|---|---|---|---|
| Legacy direct the Admin API | `Api-UserId`, `Api-Key` | only Product, Segment, Content controllers (built for Strapi) | **No.** Too narrow, and it needs an `admin-api.*` host. |
| Gateway ApiAuth (`/apikey/*`) | `UserId`, `ApiKey` | `/apikey/admin/{url}` catch-all to the Admin API, all verbs | **Yes.** |

### Host and route

- Base URL: `MANAGEMENT_API_GATEWAY_URL` = `<management-api-gateway-url>`.
- Never use `backoffice-spa.example` (the SPA host) as an API base. That host serves the BO SPA and answers
  **HTTP 200 `text/html`** for every path, existing or not — a silent false pass. Its `/mgw/*`
  prefix is the browser's own proxy and is not the automation contract.
- Prefix every path with `/apikey/`: `/apikey/admin/api/BonusPackage/GetAll`.
- The gateway declares one catch-all route,
  `x-tech-route-id: "Legacy:/apikey/admin/{url}:DELETE,GET,OPTIONS,PATCH,POST,PUT"`. The published
  OpenAPI expands it into ~500 concrete `/apikey/...` paths. A **404 therefore means the downstream
  the Admin API path is wrong**, not that the route is undeclared.
- Deleted, never call: `/integration/*`, `/affiliate-api/*`.

### Credentials

The API key **is** the BO user's `SecurityCode`. It is permanent and never expires — treat it like
a password, not like a token.

| Env name | Value |
|---|---|
| `MANAGEMENT_API_GATEWAY_URL` | gateway base URL |
| `BO_API_USER_ID` | numeric BO user id of the ApiUser |
| `BO_API_KEY` | that user's `SecurityCode` |
| `BO_PARTNER_ID` | partner the ApiUser belongs to |

The user must be type `ApiUser` and active; the gateway rejects anything else. Issued by a BO admin
via `POST /api/User/CreateApiUser` (BO JWT required), rotated via `POST /api/User/SaveApiKey`.
Never paste a key into code, docs, PRs, tickets, screenshots, or chat. `redact()` masks `apiKey`
and `securityCode` in bodies before they reach a report.

The `backofficeApi` fixture attaches the headers once, the same way `clientApi` does:

```typescript
// qa/src/fixtures/api.fixture.ts (excerpt)
backofficeApi: async ({ playwright }, use) => {
  const request = await playwright.request.newContext({
    baseURL: requireEnv("MANAGEMENT_API_GATEWAY_URL"),
    extraHTTPHeaders: {
      UserId: requireEnv("BO_API_USER_ID"),
      ApiKey: requireEnv("BO_API_KEY"),
      Accept: "application/json",
    },
  });
  await use(new BackofficeApi(request));
  await request.dispose();
},
```

### Reading a failure

| Status | Meaning |
|---|---|
| 200 | path and credentials work |
| 401 | header names or key wrong, or the user is not `ApiUser` / not active |
| 403 | auth succeeded; the ApiUser lacks the BO permission for that action |
| 404 | the downstream the Admin API path does not exist |

401 and 403 are **configuration errors, not flakes**. Never retry them, never mark them flaky, and
never widen an assertion to accept them.

### OpenAPI caveat

Admin Web API operations are published with `security: []` and `x-tech-auth-mode: "Anonymous"`.
That is wrong: an unauthenticated call answers `401` with an empty body (verified on qa,
2026-09-18). Do not trust the spec's auth metadata; trust the observed behavior recorded here.

### Partner scoping

The gateway derives partner, currency, user-type, and user-id claims from the API key. An ApiUser
therefore acts **as its own partner**. A key issued under one brand is not automatically usable to
create or read another brand's data — check the partner before reusing a key across brands.

## Never do

```typescript
// ❌ Credentials or tokens in a spec or client
headers: { "gate-auth": "dXNlcjpwYXNz" }

// ❌ Building request contexts in a test body
const request = await playwright.request.newContext({ baseURL: "<client-api-gateway-url>" });

// ❌ Legacy direct-the Admin API API key, or an admin-api host
headers: { "Api-UserId": "1", "Api-Key": "..." }
baseURL: "<internal-host>"

// ❌ The BO SPA host as an API base — it answers 200 text/html for every path
baseURL: "<internal-host>"

// ❌ Logging a login response without redaction
console.log(await response.text());
```
