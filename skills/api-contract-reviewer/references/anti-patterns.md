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
expect(response.status, "failed to read the order").toBe(200);
expect(response.body).toMatchSchema(OrderSchema);
```

**Mechanism:** API clients usually send with `failOnStatusCode: false` and parse any JSON body,
including 4xx/5xx error bodies, so body-only assertions pass on the wrong status.

---

### C2 — Envelope API call without a business-code assertion

Applies when the project profile describes an envelope API: one that wraps every answer in an
object with its own result code, so a business failure can arrive as HTTP 200.

**Pattern:** A call to such an API is checked only for HTTP 200 (or only for its payload field).

```typescript
// ❌ Bad
expect(response.status).toBe(200);
expect(response.body?.data).toBeDefined();

// ✅ Fix — use the project's envelope helper and assert the result code
expect(response.status).toBe(200);
const envelope = asEnvelope<LoginResult>(response);
expect(envelope.code, `login failed: ${envelope.message}`).toBe("Success");
```

**Mechanism:** The envelope carries business failures inside a 200 response (and sometimes inside a
4xx with the same shape), so a status-only check passes on a rejected login, payment, or order.

---

### C3 — Credentials, tokens, or gate auth in code or reports

**Pattern:** Literal emails with passwords, gateway auth header values, Bearer tokens, or env values
in a spec, client, builder, or `testInfo.attach()` without redaction.

```typescript
// ❌ Bad
extraHTTPHeaders: { "x-gateway-auth": "dXNlcjpwYXNz" }
await test.info().attach("login", { body: response.rawBody });

// ✅ Fix — credentials only via fixtures from env names; redact before attaching
await test.info().attach("login", { body: redact(response.rawBody), contentType: "application/json" });
```

**Mechanism:** Literals end up in git history, and attachments end up in HTML reports and
test-management runs that people outside the team can open.

---

### C4 — Forbidden admin or back-office access

Applies when the project profile names routes or hosts that tests must not use.

**Pattern:** Any of: a direct admin-API host the profile forbids, an impersonation header (such as a
user-id header that makes the call act as that admin), hard-coded admin user ids, a browser admin
session token or cookie reused in API code, or an admin mutation pointed at an environment where
the profile does not allow it.

```typescript
// ❌ Bad
headers: { UserId: "1" }
baseURL: "<internal-admin-host>"
```

**Mechanism:** These bypass the authorization model the platform and security owners require: a
direct call can act as an arbitrary admin and change live configuration.

**Fix:** Go through the sanctioned gateway with the auth contract the profile records. If no contract
is recorded, the test must not exist yet: ask who owns that access first.

---

### C5 — Type cast instead of schema validation

**Pattern:** `response.body as Foo` or `response.body!` in a test that never calls `toMatchSchema()`.

```typescript
// ❌ Bad
const order = response.body as Order;
expect(order.total).toBeGreaterThan(0);

// ✅ Fix
expect(response.body).toMatchSchema(OrderSchema);
```

**Mechanism:** Type assertions do not run at runtime; a renamed or missing field becomes `undefined`
and comparisons like `toBeGreaterThan` or optional chaining can still pass or fail for the wrong reason.

---

## High

### H1 — No negative path

**Pattern:** A spec file has only happy-path tests.

**Mechanism:** The error contract (status, the error code, ProblemDetails `title`) goes unverified, so
regressions in validation and authorization ship unnoticed. Minimum per endpoint: one auth rejection
and one validation error.

---

### H2 — Error body read without the envelope helper

**Pattern:** `response.body?.title` or `(response.body as ProblemDetails).title` instead of the
project's helper (`asProblemDetails(response)`); envelope errors read without the envelope helper.

**Mechanism:** The helpers throw a clear "expected ProblemDetails, got …" when the body is empty or has
the other envelope; optional chaining turns that into `undefined` and a misleading mismatch message.

---

### H3 — Request context or client built in a test body

**Pattern:** `playwright.request.newContext(...)`, `new ClientApi(...)`, or header objects created
inside `test()`.

**Mechanism:** It bypasses the fixture that injects gateway auth, user tokens, and disposal, so tests
drift in auth setup, leak contexts, and tend to copy credentials into specs.

---

### H4 — Shared account or entity mutated by a test

**Pattern:** A test changes account state (profile, password, balance, entitlements) or edits an
admin entity using a worker-scoped account (`sharedUser`) or an entity created in `beforeAll`.

```typescript
// ❌ Bad — every other test in this worker now sees a user with an applied coupon
test("User can apply a coupon", async ({ api, sharedUser }) => { … });

// ✅ Fix — the mutation gets its own account
test("User can apply a coupon", async ({ api, freshUser }) => { … });
```

**Mechanism:** Worker-scoped state is shared by every test in the worker, so a mutation changes the
preconditions of unrelated tests and makes results depend on execution order.

---

### H5 — IDs created in `beforeAll` used across tests

**Pattern:** `let orderId` assigned in `beforeAll` from a create call and used by several tests.

**Mechanism:** If creation partially fails, later tests run with `undefined` and fail with misleading
messages; parallel retries re-run `beforeAll` per worker and create duplicates. Create per test or in a
fixture with teardown.

---

### H6 — Unprefixed or static test data on a shared environment

**Pattern:** Names/emails like `"Test Item"` or `test@test.com`, or random values without the suite's
test-data prefix (for example `qa-`), sent to a shared environment.

**Mechanism:** Static values collide on the second run, and unprefixed leftovers cannot be found or
told apart from real configuration while there is no automated cleanup.

---

## Medium

### M1 — Builder bypassed for a payload that several specs repeat

**Mechanism:** Inline payloads duplicate field names across specs, so one contract change means
editing every call site instead of one Builder default. Flag it when the same body (more than three
fields) appears in a second spec; one inline payload in one spec is fine, which is what
`api-contract-writer` writes.

---

### M2 — Partial error assertion

**Pattern:** `toContain` / `toMatch` / `toContainEqual` on an error code or message.

```typescript
// ❌ Bad
expect(asProblemDetails(response).title).toContain("coupon");

// ✅ Fix
expect(asProblemDetails(response).title).toBe("coupon_not_available");
```

**Mechanism:** Substring checks pass for a different error (`coupon_expired` contains `coupon`), hiding
a changed rejection reason. Exact match intentionally couples the test to the current contract;
update it in the same change as a policy change.

---

### M3 — No teardown for created entities

**Pattern:** A create call inside `test()` with cleanup after assertions (or no cleanup).

**Mechanism:** A failing assertion skips the cleanup, and the leftover changes list/search results for
later tests. Use `try/finally` or fixture teardown when the API offers a delete, and otherwise make the
leftover inert (inactive, prefixed) so a later cleanup can find it.

---

### M4 — `test.fixme` / `test.skip` without a tracker reference

**Mechanism:** Silenced tests without a ticket are forgotten and never re-enabled. Do not demand a
specific ticket format unless the project profile defines one.

---

### M5 — Wrong target or environment baked into code

**Pattern:** Absolute URLs, tenant or partner id literals other than via config, or environment names
inside clients/specs.

**Mechanism:** The same suite must run against whatever base URLs the config supplies; a literal
silently points one test at another environment.

---

### M6 — Missing traceability

Applies when the project links tests to cases in a test-management tool or a spec (an id in the
title, a tag, or an annotation).

**Pattern:** A spec that implements an existing case lacks its id, or carries an invented one.

**Mechanism:** Without the id, the reporter creates an unmatched test instead of updating the case,
so run history and coverage split.

---

## Low

### L1 — Expensive setup in test scope

**Mechanism:** Creating an account per test when the tests only read multiplies live account creation
and run time. Flag only when the setup clearly creates real accounts or entities.

---

### L2 — Optional chaining on body without a prior schema check

**Mechanism:** `response.body?.items` returns `undefined` silently and produces a confusing type
mismatch instead of "body missing". Check the schema first.

---

### L3 — Diagnostic attach after an assertion that can throw

**Mechanism:** `expect()` throws synchronously, so the attach below it never runs and the failure
report has no response body.
