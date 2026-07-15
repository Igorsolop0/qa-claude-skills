# Async waits, eventual consistency, backend-driven state

Read this file when: writing a spec that submits a form whose backend does async work (job
queue, cache warm-up, downstream microservice call), or asserting UI state that only appears
after a poll interval / websocket push / re-fetch.

---

## The two-wait problem

A form submit is only half the wait. After the request returns 200/201, the actual outcome
often depends on:

- A background job (email verification email lands, invoice PDF generates).
- A downstream service call (payment provider confirms, third-party KYC returns).
- A denormalized read model catching up (search index re-indexes, list view re-fetches).
- A WebSocket / SSE push that hasn't fired yet.

Asserting the outcome immediately after the URL settles is a race: it passes on a fast
environment and flakes on a slow one.

Separate the two waits explicitly:

1. **Submit wait** — request is accepted: `waitForResponse` on the create endpoint, or a
   visible post-submit state (toast, redirect).
2. **Outcome wait** — the effect (new row in a list, status badge flipping, email arriving)
   appears *after* acceptance. Wrap the outcome assertion so it retries until the backend
   catches up:

```ts
// after the form submit is accepted
await expect(async () => {
  await page.reload();                          // list view re-reads on load
  await expect(listPage.rowByName('New item')).toBeVisible();
}).toPass({ timeout: 30_000, intervals: [2_000, 5_000, 5_000] });
```

- Prefer `expect.poll` when polling a single value:
  ```ts
  await expect.poll(() => api.getInvoiceStatus(id), { timeout: 30_000 })
    .toBe('paid');
  ```
- Prefer `expect(...).toPass()` when you must retry a *block* (reload + assert).
- Do **not** solve this with `waitForTimeout` or by bumping a single
  `expect(...).toBeVisible({ timeout: 30_000 })` when the UI needs a *reload* to re-fetch
  state — the assertion will keep polling the stale DOM.
- Tune `intervals` to the backend's actual behavior — first probe ~2s, then back off. Don't
  set `intervals: [500, 500, 500]` and burn CPU.

## When to use `page.waitForResponse` vs `expect.poll` vs `toPass`

| Situation | Tool |
|---|---|
| Waiting for the request that fires when you click Submit to return | `page.waitForResponse` |
| Polling a value that will change (API, deriving from a page function) | `expect.poll` |
| Retrying a block that must re-navigate/reload to re-fetch | `expect(...).toPass()` |
| Waiting for a UI element to appear (no backend involved) | `expect(...).toBeVisible()` |

## Pre-flight: fail fast on missing preconditions

If a spec depends on a precondition that a fixture is supposed to set up (a logged-in user, a
seeded record), assert the precondition explicitly at the top of the spec — a clear
`Expected user to be logged in, header shows Login button` beats a locator-timeout 60s later.
