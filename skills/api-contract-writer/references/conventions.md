# API Contract Writer — Conventions

## Base client (created once, then stable)

`src/api/core/base.client.ts` wraps a Playwright `APIRequestContext`. Every domain client extends
it. Methods return `ApiResponse<T>`; the test decides what a status means.

```typescript
// qa/src/api/core/base.client.ts
import type { APIRequestContext } from "@playwright/test";

export interface ApiResponse<T> {
  status: number;
  statusText: string;       // reason phrase ("OK", "Bad Gateway"); empty on HTTP/2
  headers: Record<string, string>;
  body: T | null;          // parsed JSON, or null when the body is empty / not JSON
  rawBody: string;
}

type RequestOptions = {
  params?: Record<string, string | number | boolean>;
  data?: unknown;
  headers?: Record<string, string>;
};

export abstract class BaseClient {
  constructor(protected readonly request: APIRequestContext) {}

  protected get<T>(path: string, options: RequestOptions = {}) {
    return this.send<T>("GET", path, options);
  }
  protected post<T>(path: string, options: RequestOptions = {}) {
    return this.send<T>("POST", path, options);
  }
  protected put<T>(path: string, options: RequestOptions = {}) {
    return this.send<T>("PUT", path, options);
  }
  protected patch<T>(path: string, options: RequestOptions = {}) {
    return this.send<T>("PATCH", path, options);
  }
  protected delete<T>(path: string, options: RequestOptions = {}) {
    return this.send<T>("DELETE", path, options);
  }

  private async send<T>(method: string, path: string, options: RequestOptions): Promise<ApiResponse<T>> {
    const response = await this.request.fetch(path, { method, failOnStatusCode: false, ...options });
    const rawBody = await response.text();
    let body: T | null = null;
    try {
      body = rawBody ? (JSON.parse(rawBody) as T) : null;
    } catch {
      body = null;
    }
    return {
      status: response.status(),
      statusText: response.statusText(),
      headers: response.headers(),
      body,
      rawBody,
    };
  }
}
```

Do not add retries, logging of headers, or status checks here. Those belong to tests and fixtures.

## Client URL grammar (Client API Gateway)

Paths are relative to `CLIENT_API_GATEWAY_URL`. `partnerId` comes from `CLIENT_PARTNER_ID` (8).

| Service | Path template | Envelope |
|---|---|---|
| the legacy envelope service v3 / v4 | `/legacy-api/{partnerId}/api/v{N}{path}` (secure routes: `/secure/legacy-api/...`) | `DomainApiResponse` |
| the games service | `/gd/api/v1/partners/{partnerId}{path}` | bare JSON / ProblemDetails |
| the claim service | `/ccb/api/v1/{partnerId}{path}` | bare JSON / ProblemDetails |
| the availability service | `/cab/api/v1/{partnerId}{path}` | bare JSON / ProblemDetails |

Source of truth: `packages/bff/README.md` § URL grammar and `packages/bff/src/generated/service-prefixes.ts`.
If a live call disagrees with this table, trust the spec and the live response, then tell the user
the table is stale.

Every call to this gateway also carries `gate-auth` (see `references/auth-patterns.md`). The fixture
sets it through `extraHTTPHeaders`; clients never read credentials.

## Domain client template — Client

```typescript
// qa/src/api/client/ccb/bonus.client.ts
import { BaseClient } from "../../core/base.client";
import type { ActiveBonusResponse, ActivateBonusRequest } from "./bonus.types";

export class CcbBonusClient extends BaseClient {
  constructor(
    request: ConstructorParameters<typeof BaseClient>[0],
    private readonly partnerId: string,
  ) {
    super(request);
  }

  getActiveBonus(clientId: number) {
    return this.get<ActiveBonusResponse>(
      `/ccb/api/v1/${this.partnerId}/client-claiming-bonus/clients/${clientId}/active-bonus`,
    );
  }

  activateBonus(clientId: number, data: ActivateBonusRequest) {
    return this.post<unknown>(`/ccb/api/v1/${this.partnerId}/client-claiming-bonus/clients/${clientId}/activate`, {
      data,
    });
  }
}
```

The exact endpoint paths above are illustrative. Always copy the path from `openapi-v1.json`.

## Domain client template — Backoffice

```typescript
// qa/src/api/backoffice/template-bonus.client.ts
import { BaseClient } from "../core/base.client";
import type { TemplateBonus, CreateTemplateBonusRequest } from "./template-bonus.types";

export class TemplateBonusClient extends BaseClient {
  getAll(partnerId: number) {
    return this.get<TemplateBonus[]>(`/admin/api/TemplateBonus/GetAll/${partnerId}`);
  }

  create(partnerId: number, data: CreateTemplateBonusRequest) {
    return this.post<TemplateBonus>(`/admin/api/TemplateBonus/Create/${partnerId}`, { data });
  }
}
```

The gateway exposes Admin Web API under both `/admin/api/...` and `/apikey/admin/...`. Which prefix
automation must use depends on the pending auth contract. Keep the prefix in **one** place (a
constant in `backoffice.api.ts`) so switching is a one-line change.

## Facades

```typescript
// qa/src/api/client/client.api.ts
import type { APIRequestContext } from "@playwright/test";
import { CcbBonusClient } from "./ccb/bonus.client";

export class ClientApi {
  readonly ccbBonus: CcbBonusClient;

  constructor(request: APIRequestContext, partnerId: string) {
    this.ccbBonus = new CcbBonusClient(request, partnerId);
  }
}
```

Add one readonly property per domain client. `BackofficeApi` follows the same shape.

## Types file template

Prefer types generated from the contract. Define custom interfaces only when the endpoint is
absent from the spec or the generated type is too loose, and say so in a comment.

```typescript
// qa/src/api/client/ccb/bonus.types.ts
import type { components } from "../../../../.schema/client-gateway";

export type ActiveBonusResponse = components["schemas"]["Tech.Bonus.Sdk.Response.ClientBonusResponse"];
```

`packages/bff/src/api-types/*` shows which schema names the storefront already relies on. Use it to
find names, but import types from `qa/.schema/`, not from `@the platform/bff`: contract tests must not
depend on the BFF's own type aliases.

## Envelope helpers

```typescript
// qa/src/api/core/envelopes.ts
import type { ApiResponse } from "./base.client";

/** the legacy envelope service DomainApiResponse. `ResponseCode` null, "0", "OK" or "Success" means success. */
export interface DomainApiResponse<T> {
  ResponseCode: string | number | null;
  NewResponseCode?: string | null;
  Description?: string | null;
  InterruptionCode?: string | null;
  ResponseObject: T | null;
  TraceId?: string | null;
}

/** RFC 7807 ProblemDetails used by the newer services. `title` is the machine code. */
export interface ProblemDetails {
  type?: string;
  title: string;
  status?: number;
  detail?: string | null;
  traceId?: string;
}

export function asDomainApiResponse<T>(response: ApiResponse<unknown>): DomainApiResponse<T> {
  if (response.body === null || typeof response.body !== "object" || !("ResponseCode" in response.body)) {
    throw new Error(`Expected a the legacy envelope service DomainApiResponse, got: ${response.rawBody.slice(0, 200)}`);
  }
  return response.body as DomainApiResponse<T>;
}

export function asProblemDetails(response: ApiResponse<unknown>): ProblemDetails {
  if (response.body === null || typeof response.body !== "object" || !("title" in response.body)) {
    throw new Error(`Expected ProblemDetails, got HTTP ${response.status}: ${response.rawBody.slice(0, 200)}`);
  }
  return response.body as ProblemDetails;
}
```

Confirm field names against the spec before creating this file: the legacy envelope's keys are
PascalCase on the wire (`packages/bff/src/http/request.ts`).

## Spec gaps — augmentation patterns

When a generated type exists but is wrong, augment it instead of rewriting it:

```typescript
// 1. Wrong nullability — Omit + intersection
type BonusCard = Omit<components["schemas"]["BonusDto"], "id" | "name"> & { id: number; name: string };

// 2. Field missing from the schema — intersection
type ClientBonus = components["schemas"]["ClientBonusResponse"] & { wagerProgress: number };

// 3. Wrapper type wrong — Omit + NonNullable
type BonusList = Omit<NonNullable<components["schemas"]["BonusListResponse"]>, "items"> & { items: BonusCard[] };
```

Always comment what the spec gets wrong and report the gap so the backend team can fix the annotation.

## Diagnostic attachments — attach before assert, redact first

```typescript
const response = await clientApi.ccbBonus.getActiveBonus(player.clientId);

await test.info().attach("GET active-bonus response", {
  body: redact(response.rawBody),
  contentType: "application/json",
});

expect(response.status, "active-bonus should be readable by its owner").toBe(200);
```

`redact()` masks `accessToken`, `refreshToken`, `token`, and `authorization` values (same keys the
BFF redacts in `sanitizeBodyPreview`). Never attach request headers.

## Spec template — Client

```typescript
// qa/tests/Client/API/bonus/active-bonus.spec.ts
import { expect, test } from "../../../../src/fixtures/api.fixture";
import { asProblemDetails } from "../../../../src/api/core/envelopes";
import { ActiveBonusSchema } from "../../../../test-data/client/bonus/schemas/active-bonus.schema";

test("Player without a bonus gets an empty active-bonus @Txxxxxxxx", async ({ clientApi, clientPlayer }) => {
  const response = await clientApi.ccbBonus.getActiveBonus(clientPlayer.clientId);

  expect(response.status, "active-bonus should answer 200 for a fresh player").toBe(200);
  expect(response.body).toMatchSchema(ActiveBonusSchema);
});

test("Unknown client gets a ProblemDetails code", async ({ clientApi }) => {
  const response = await clientApi.ccbBonus.getActiveBonus(0);

  expect(response.status, "unknown client should be rejected").toBe(404);
  expect(asProblemDetails(response).title).toBe("client_not_found");
});
```

`@Txxxxxxxx` stands for the real Testomat id; leave it out until Testomat assigns one. The status
and code values above are placeholders: take them from the spec or a recorded live response.

## Spec template — the legacy envelope service envelope

```typescript
test("Registered player can log in", async ({ clientApi, freshPlayerCredentials }) => {
  const response = await clientApi.auth.login(freshPlayerCredentials);

  expect(response.status, `login failed: ${response.rawBody.slice(0, 200)}`).toBe(200);
  const envelope = asDomainApiResponse<LoginResult>(response);
  expect(envelope.ResponseCode, `login failed: ${envelope.Description}`).toBe("Success");
  expect(envelope.ResponseObject).toMatchSchema(LoginResultSchema);
});
```

Assert the success `ResponseCode` value the live endpoint actually returns (`null`, `"0"`, `"OK"`,
or `"Success"`), not a range of them. `isWwaSuccessCode()` is for fixtures and preconditions only.
Reference spec: `qa/tests/Client/API/auth/register.spec.ts`.

**Api-gate without `gate-auth`** does not answer 401/403: qa returns HTTP 200 with the HTML page
`<title>API Gate — Login</title>`. Assert that page (and `body === null`) instead of a status.

## Fixture selection guide

| Need | Fixture | Scope |
|---|---|---|
| Unauthenticated / gate-auth-only Client call | `clientApi` | test |
| Client call as a logged-in player who is only read | `clientPlayer` + `clientApi.withPlayer(player)` | worker |
| Test mutates the player's own account, balance, or bonuses | `freshClientPlayer` (registers a new player) | test |
| Backoffice call | `backofficeApi` | test (blocked until auth is confirmed) |

Worker-scoped players are shared by every test in the worker. A test that changes that player's
state (claims a bonus, changes password, deposits) leaks into other tests. Use a fresh player for
any mutation.

## File naming

```
<domain>.client.ts        ← kebab-case, single suffix (template-bonus.client.ts)
<domain>.types.ts
<name>.builder.ts         ← named after the operation (create-template-bonus.builder.ts)
<name>.schema.ts
<name>.spec.ts
```

Do not create `*.page.ts`, `*.locators.ts`, or `*.component.ts` for API code — those are UI patterns.
