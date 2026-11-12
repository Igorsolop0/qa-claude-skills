# Classification

One class per failure, decided by evidence you can quote. Work through the questions in order;
the first one that holds decides.

## 1. Did the product or environment answer wrongly before the test could judge anything? → `infra`

Evidence:

- A `backend-5xx` signal on the call the failing step waits on, with a body such as
  `{"error":"Service Unavailable"}` (no error envelope). When the product has a backend-for-frontend,
  find out (and write into the profile) how it reports an upstream failure versus its own: a passed-
  through status text usually means the upstream answered that status, while the BFF's own errors
  carry codes.
- The same endpoint answered `200` shortly before in the same run (other tests, other contexts).
- `429` with `Retry-After`, gateway HTML instead of JSON, DNS/TLS errors, expired seeded data.
- No commit in the deployed range touches the code path.

Not `infra`: a `5xx` on an unrelated call (analytics, a widget) while the test failed on a
locator. Decide by the call the failing step depends on.

Action: rerun once, reporting off. A repeat goes to the backend with UTC timestamps, the
endpoint, the request body (redacted) and the `cf-ray`/request id from `*.network` headers.

## 2. Does the product now do something else, on purpose? → `test-drift`

Evidence:

- `locator-not-found`, or an assertion on copy, count or URL that changed.
- A merged PR in the range (or `git log -S '<test id or text>'`) that changes this UI, with a
  description, a spec or a component test showing the new behaviour is intended.
- The same flow still works for the user, through another element or path.
- The test's assumptions do not hold for its project (viewport, guest vs player, brand), and the
  product never promised them there (e.g. a close button that exists only in the desktop dialog,
  tested on the 390px mobile project).

Action: heal. Cite the PR, or the product rule that the test misread.

## 3. Is the product wrong? → `product-bug`

Evidence:

- A `known-issue` signal (an `issue` annotation on the test): link it, do not heal.
- The behaviour contradicts the spec, the test case, the design or a sibling product, and
  no PR in the range declares the change intended.
- A regression: the last green run passed on the same test code, the test has not changed since
  (`git log <last-green>.. -- <spec>` is empty), and a product commit in the range touches the path.

Action: draft an issue in the project's format (steps, expected, actual, evidence, suspected
commit). Leave the test red.

## 4. Does it pass on rerun, and is there a race in the test? → `flaky`

Evidence:

- `retry-passed`, or `--repeat-each` gives mixed results with no code change.
- Timing gaps in `test.trace`: an assertion starting after a transient UI (a toast with a 4 s
  auto-dismiss) is gone; actions racing hydration; shared accounts or data between workers.
- The product behaves correctly every time; only the observation is late or out of order.

Action: heal the race. If the race is in the product (an event fired twice, a UI that flashes
the wrong state), it is a `product-bug`.

## Tie-breakers

- `5xx` on the awaited call plus a locator failure: classify by what failed first in time.
- A drifted test that also hits a known bug: two findings, one per step; heal only the drifted
  step.
- No trace kept and no rerun possible: report `unclassified` with the missing evidence. Do not guess.

## Worked example: a Monday-morning run

A weekend of about 60 merged refactor PRs, then 7 failures on a mobile-viewport storefront suite.
None of the failures came from the weekend merges.

| Test | Decisive evidence | Class |
| --- | --- | --- |
| Registering again with the same phone | `POST /api/auth/otp/request` → `503 {"error":"Service Unavailable"}`; the same endpoint answered `200` 23 s earlier; no auth commits in the range | `infra` |
| Email registration | `POST /api/auth/register` → `503` in the same 4-second window | `infra` |
| Desktop sidebar session rows | `locator-not-found` on a profile-settings row in a guest step; a PR merged *before* the last green run hides that row for guests on purpose, and the spec landed the same week | `test-drift` |
| Search explicit query | waits for a close button in the search dialog; on the 390px project the modal renders as a bottom sheet without a close button (unchanged behaviour) | `test-drift` |
| Provider picker cancel | same cause, the close button of the provider sheet | `test-drift` |
| Sidebar level promo | `known-issue` annotation: a label cached in `sessionStorage` survives logout | `product-bug` |
| Welcome toast | the toast rendered and `toBeVisible` passed; `toHaveCount(1)` started 2.8 s later, after the 4 s auto-dismiss | `flaky` |

Two traps in this run: a `500` on an unrelated recommendations call during the search tests was not
the cause, and the toast's `locator-not-found` signal pointed at a product bug while the trace showed
a race in the test.
