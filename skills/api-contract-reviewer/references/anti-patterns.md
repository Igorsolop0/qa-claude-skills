# API Contract Reviewer — Anti-Pattern Catalog

Work through this list top-down. Capture file path and line number for each finding.

---

## Critical

### C1 — Missing status code assertion

**Pattern:** The body is asserted, `response.status` never is.

```typescript
// ❌ Bad — a 500 with a JSON error body still has a defined body
expect(response.body).toBeDefined();

// ✅ Fix — status first, then body
expect(response.status, "failed to read active bonus").toBe(200);
expect(response.body).toMatchSchema(ActiveBonusSchema);
```

**Mechanism:** The base client uses `failOnStatusCode: false` and parses any JSON body, including
4xx/5xx bodies, so body-only assertions pass on the wrong status.

---

### C2 — the legacy envelope service call without a `ResponseCode` assertion

**Pattern:** A `/legacy-api/...` response is checked only for HTTP 200 (or only its
`ResponseObject`).

```typescript
// ❌ Bad
expect(response.status).toBe(200);
expect(response.body?.ResponseObject).toBeDefined();

// ✅ Fix
expect(response.status).toBe(200);
const envelope = asDomainApiResponse<LoginResult>(response);
expect(envelope.ResponseCode, `login failed: ${envelope.Description}`).toBe("Success");
```

**Mechanism:** the legacy envelope service reports business failures inside a `DomainApiResponse` that can still arrive as
HTTP 200 (and sometimes as a 4xx with the same envelope), so a status-only check passes on a rejected
login, claim, or deposit.

---

### C3 — Credentials, tokens, or gate auth in code or reports

**Pattern:** Literal emails with passwords, `gate-auth` values, Bearer tokens, or env values in a
spec, client, builder, or `testInfo.attach()` without redaction.

```typescript
// ❌ Bad
extraHTTPHeaders: { "gate-auth": "dXNlcjpwYXNz" }
await test.info().attach("login", { body: response.rawBody });

// ✅ Fix — credentials only via fixtures from env names; redact before attaching
await test.info().attach("login", { body: redact(response.rawBody), contentType: "application/json" });
```

**Mechanism:** Literals end up in git history, and attachments end up in HTML reports and Testomat
runs that people outside the team can open.

---

### C4 — Prohibited Backoffice access

**Pattern:** Any of: an `admin-api.*` host, a `UserId` header, hard-coded BO user ids,
`BACKOFFICE_API_URL`, a browser BO JWT or cookie reused in API code, or a Backoffice mutation
pointed at an environment other than dev/qa.

```typescript
// ❌ Bad
headers: { UserId: "1" }
baseURL: "<internal-host>"
```

**Mechanism:** These bypass the Management API Gateway authorization model that platform and
security owners require; a direct call authorizes as an arbitrary admin and can change live
bonus configuration.

**Fix:** Route through `MANAGEMENT_API_GATEWAY_URL` with the confirmed auth contract. If no
contract is recorded in `api-contract-writer/references/auth-patterns.md`, the test must not exist yet.

---

### C5 — Type cast instead of schema validation

**Pattern:** `response.body as Foo` or `response.body!` in a test that never calls `toMatchSchema()`.

```typescript
// ❌ Bad
const bonus = response.body as ActiveBonus;
expect(bonus.amount).toBeGreaterThan(0);

// ✅ Fix
expect(response.body).toMatchSchema(ActiveBonusSchema);
```

**Mechanism:** Type assertions do not run at runtime; a renamed or missing field becomes `undefined`
and comparisons like `toBeGreaterThan` or optional chaining can still pass or fail for the wrong reason.

---

## High

### H1 — No negative path

**Pattern:** A spec file has only happy-path tests.

**Mechanism:** The error contract (status, `ResponseCode`, ProblemDetails `title`) goes unverified, so
regressions in validation and authorization ship unnoticed. Minimum per endpoint: one auth rejection
and one validation error.

---

### H2 — Error body read without the envelope helper

**Pattern:** `response.body?.title` or `(response.body as ProblemDetails).title` instead of
`asProblemDetails(response)`; the legacy envelope service errors read without `asDomainApiResponse(response)`.

**Mechanism:** The helpers throw a clear "expected ProblemDetails, got …" when the body is empty or has
the other envelope; optional chaining turns that into `undefined` and a misleading mismatch message.

---

### H3 — Request context or client built in a test body

**Pattern:** `playwright.request.newContext(...)`, `new ClientApi(...)`, or header objects created
inside `test()`.

**Mechanism:** It bypasses the fixture that injects `gate-auth`, player tokens, and disposal, so tests
drift in auth setup, leak contexts, and tend to copy credentials into specs.

---

### H4 — Shared player or entity mutated by a test

**Pattern:** A test claims a bonus, changes profile/password, deposits, or edits a Backoffice entity
using a worker-scoped player (`clientPlayer`) or an entity created in `beforeAll`.

```typescript
// ❌ Bad — every other test in this worker now sees a player with an active bonus
test("Player can claim bonus", async ({ clientApi, clientPlayer }) => { … });

// ✅ Fix — mutation gets its own player
test("Player can claim bonus", async ({ clientApi, freshClientPlayer }) => { … });
```

**Mechanism:** Worker-scoped state is shared by every test in the worker, so a mutation changes the
preconditions of unrelated tests and makes results depend on execution order.

---

### H5 — IDs created in `beforeAll` used across tests

**Pattern:** `let bonusId` assigned in `beforeAll` from a create call and used by several tests.

**Mechanism:** If creation partially fails, later tests run with `undefined` and fail with misleading
messages; parallel retries re-run `beforeAll` per worker and create duplicates. Create per test or in a
fixture with teardown.

---

### H6 — Unprefixed or static test data on a shared environment

**Pattern:** Names/emails like `"Test Bonus"` or `test@test.com`, or random values without the `qa-pw-`
prefix, sent to dev or qa.

**Mechanism:** Static values collide on the second run, and unprefixed leftovers cannot be found or
told apart from real configuration while there is no automated cleanup.

---

## Medium

### M1 — Builder bypassed for payloads with > 3 fields

**Mechanism:** Inline payloads duplicate field names across specs, so one contract change means
editing every call site instead of one Builder default.

---

### M2 — Partial error assertion

**Pattern:** `toContain` / `toMatch` / `toContainEqual` on an error code or message.

```typescript
// ❌ Bad
expect(asProblemDetails(response).title).toContain("bonus");

// ✅ Fix
expect(asProblemDetails(response).title).toBe("bonus_not_available");
```

**Mechanism:** Substring checks pass for a different error (`bonus_expired` contains `bonus`), hiding
a changed rejection reason. Exact match intentionally couples the test to the current contract;
update it in the same change as a policy change.

---

### M3 — No teardown for created entities

**Pattern:** A create call inside `test()` with cleanup after assertions (or no cleanup).

**Mechanism:** A failing assertion skips the cleanup, and the leftover changes list/search results for
later tests. There is no agreed bulk cleanup yet, so use `try/finally` or fixture teardown when the API
offers a delete, and otherwise make the leftover inert (inactive, prefixed).

---

### M4 — `test.fixme` / `test.skip` without a tracker reference

**Mechanism:** Silenced tests without a ticket are forgotten and never re-enabled. Do not demand a
specific prefix: the ticket prefix convention is not decided yet.

---

### M5 — Wrong target or environment baked into code

**Pattern:** Absolute URLs, `partnerId` literals other than via config, or environment names inside
clients/specs.

**Mechanism:** The same suite must run against the configured `CLIENT_API_GATEWAY_URL` /
`MANAGEMENT_API_GATEWAY_URL`; a literal silently points one test at another environment.

---

### M6 — Missing traceability

**Pattern:** A spec that implements an existing Testomat case lacks its `@T` id, or has an invented one;
a case from an OpenSpec change lacks its `local_id`.

**Mechanism:** Without the id, the Testomat reporter creates an unmatched test instead of updating the
case, so run history and coverage split.

---

## Low

### L1 — Expensive setup in test scope

**Mechanism:** Registering a player per test when the tests only read multiplies live account creation
and run time. Flag only when the setup clearly creates real accounts or entities.

---

### L2 — Optional chaining on body without a prior schema check

**Mechanism:** `response.body?.items` returns `undefined` silently and produces a confusing type
mismatch instead of "body missing". Check the schema first.

---

### L3 — Diagnostic attach after an assertion that can throw

**Mechanism:** `expect()` throws synchronously, so the attach below it never runs and the failure
report has no response body.
