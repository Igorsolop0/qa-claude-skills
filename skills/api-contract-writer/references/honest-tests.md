# Honest tests

A test is honest when it fails if the product is wrong. Each rule below comes from a test that
was green while the product was broken.

## Assertions

| Do | Not | Why |
|---|---|---|
| `expect(response.status()).toBe(201)` | `expect(response.ok()).toBeTruthy()` | `ok()` accepts 200 where 201 is promised |
| `expect(body.code).toBe('NOT_FOUND')` | `expect(body.message).toContain('not')` | Messages change; codes are the contract |
| `expect(body).toMatchSchema('Ticket')` | `expect(body.id).toBeDefined()` | Catches a wrong type, a missing field, a bad date |
| `expect(body.items).toHaveLength(2)` after `limit=2` | `expect(body.items.length).toBeLessThanOrEqual(...)` on unknown data | Exact when you control the data |
| Read back with a second request after a write | Trust the body of the write response | The response can echo what was sent without storing it |

## Never

- **A condition around an assertion.** `if (response.status() === 200) { expect(...) }` passes
  when the status is 500.
- **`try` / `catch` around a request or an assertion.**
- **A loop of assertions over a list that may be empty.** Assert the length first.
- **An expected value copied from the real response.** Expected values come from what the test
  sent or from the description.
- **`test.skip`, `test.fixme` or a loosened assertion to get a green run.**
- **A fixed wait.** For background work, poll with `expect.poll` or `expect(...).toPass()` until
  the documented final state.
- **Retries to hide an unstable test.** Find the cause: shared data, order, a limit.

## Data

- Create what the test needs; delete what it created; touch nothing else.
- Names through `unique()`: parallel workers and repeated runs must not collide.
- `beforeAll` runs once per worker, not once per file. Data created there may exist several
  times; tests must not count on being alone.
- An id for "not found": a value far outside the real range, or an id that was just deleted.
  Record the choice in `CLAUDE.md`.
- Foreign data: create it with another account when the product separates accounts. If only one
  account exists, say the test is not possible yet instead of faking it.

## Refusals

- 401: the client without a token (`api`), not a wrong token, unless the description distinguishes.
- 403 against 404 for another account's data: assert what the description says. If it is silent,
  ask; both are defensible, and the test fixes the choice.
- Validation: one representative invalid input per endpoint, chosen for risk (a missing required
  field, or a value outside an enum). Field-by-field validation belongs to unit tests.

## Reading a schema failure

`/id must be integer` names the field and the rule. The line above the received body is the
cause. Report that line to the user, not the stack trace.
