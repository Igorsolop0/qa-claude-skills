---
name: api-contract-writer
description: |
  Writes a small, honest set of API contract tests for one endpoint in a Playwright project that
  was set up by `pw-project-bootstrap`. Works on any product: the rules here are general, and
  everything particular to the product is read from, and written back to, the project's
  `CLAUDE.md`. Reads the operation from the API description, probes the real endpoint, proposes
  three to six tests with a reason for each, writes them, runs them, proves they can fail, and
  records what it learned about the product.
  Trigger: "write API tests for POST /tickets", "contract test for this endpoint", "cover the
  users endpoints", "add API tests".
  Not for: setting up the project (use `pw-project-bootstrap`), browser tests.
argument-hint: METHOD /path  (for example: GET /tickets/{id})
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - Bash(npx playwright test*)
  - Bash(npm run *)
  - Bash(npx tsc*)
  - Bash(node -e *)
---

# API Contract Writer

You write contract tests for one endpoint at a time. The user is a QA engineer who knows what
should be tested and may not write code. Your tests must be few, readable, and able to fail.

This skill knows nothing about the product. What is particular about it lives in `CLAUDE.md` in
the test folder (sections "Project profile" and "Test conventions"). Read it before anything else,
follow it when it conflicts with a default here, and add to it at the end. Never edit this skill
to fit a project.

Rules for what makes a test honest: [references/honest-tests.md](references/honest-tests.md).
Layers for a suite that has outgrown the flat default (domain clients, builders, envelopes,
attachments), and when each is worth adding: [references/optional-layers.md](references/optional-layers.md).

## Step 1 — Read the project

- `CLAUDE.md`: profile, conventions, roles, endpoints that must not be called.
- `src/fixtures/index.ts`: the names you may use (`test`, `expect`, `Schemas`, `Body`, `unique`,
  `clientFor`, `api`, `<role>Api`).
- Two existing specs in `tests/api/`, if any: copy their style, naming and data handling.

No `CLAUDE.md` or no fixtures: stop and say the project needs `pw-project-bootstrap` first.

## Step 2 — Read the operation

From `src/types/api.d.ts`, `src/types/api-schemas.json` and, for limits on request fields, the
description itself at `OPENAPI_SOURCE` (not from memory, not from a similar endpoint), collect:

- parameters and request body: required fields, limits, enums;
- every documented response: status and schema name;
- security: is a token needed, do roles differ;
- what the description says in words: business rules hide in `description`.

No description for this endpoint: say so and go to step 3 with the probe as the only source.

## Step 3 — Probe the real endpoint

Send one valid request with the role that should succeed (`node -e` with `fetch`, token from
`.auth/<role>.json`; never print the token). You may also send one request per refusal you plan
to test, to see its status and error body. For an operation that writes, create only data you
will delete, and only if the profile allows writing in this environment.

Compare the real answer with the description. A difference is a **finding**, not a detail to work
around: status differs, a required field is missing, a type differs, an undocumented field
appears. Report findings in step 4. Do not shape the test to match a wrong answer.

An error code or message that you saw but the description does not state is **observed, not
documented**. List such values in step 4 under their own heading and ask the user to confirm that
they are intended; they become part of the contract only then, and go into `CLAUDE.md`.

## Step 4 — Propose the tests and wait

Budget: **three to six tests per endpoint.** Choose in this order and stop when the budget is full:

1. The successful call: status, schema, and the values that prove this request was handled (the id
   asked for, the fields sent).
2. For an operation that writes: read the data back with a second request, as its own test. A 200
   does not prove it was stored, and a separate test shows exactly what broke.
3. The business rules the endpoint carries, from the description or the profile (who may do it,
   which moves are allowed). These are the reason the endpoint exists.
4. Generic refusals, each asserting the exact status and error code, most likely to break first:
   no token (401), unknown id (404), invalid input (400/422). Drop from the end of this list when
   the budget is full, and say which you dropped.

Do not add: one test per invalid field, the same refusal for every role, tests of the framework,
tests of another endpoint's behaviour. Three precise tests beat fifteen similar ones: every extra
test is one more to maintain when the API changes.

Show the user a table and stop:

| # | Test | Why it earns its place | Tag |
|---|---|---|---|

Under it: what you deliberately left out and why, findings from the probe, and anything you
could not determine. Change the list as the user asks. Write only after a clear yes.

## Step 5 — Write

- File: `tests/api/<domain>/<verb>-<resource>.spec.ts`; the domain is the first path segment unless
  the profile says otherwise. A new folder becomes a new Playwright project by itself.
- Test titles start with the expected status: `'404: unknown id'`.
- Tags: the successful call gets `@smoke`; everything gets `@regression`.
- Order inside a test: status, then schema, then values.
- An assertion after a second request carries a message that names it, so a red run explains
  itself: `expect(body.priority, 'GET after PATCH: priority was not stored').toBe(data.priority)`.
- Type every body: `const body: Schemas['Ticket'] = await response.json()`; request bodies with
  `Body<'/tickets', 'post'>`.
- Data: each spec creates what it needs and deletes it, using `clientFor(request, role)` in
  `beforeAll` / `afterAll`. Names through `unique()`. Never depend on data from another spec or on
  seed data that anyone can edit. Never call an endpoint the profile lists as not to be called.
- The same helper needed in a second spec moves to `src/data/<resource>.ts`. Not before. Then rerun
  the spec you moved it out of and update the convention line in `CLAUDE.md`.
- A value that must fit a pattern (`unique()` does not fit `^[A-Z]{2,6}$`) gets a small generator in
  `src/data/`; record it in `CLAUDE.md`.
- No new dependency, no change to generated files, the config or the fixtures. If the fixtures
  lack something, say so and ask.

## Step 6 — Run and classify every red test

Run the type check and the new spec. For each failure decide which it is and say it in these words:

- **Test defect:** your mistake. Fix the test.
- **Product defect:** the API breaks its own description or a stated rule. Leave the assertion as
  it is. Do not loosen it, skip it, or wrap it in a condition. Report it with the request, the
  expected and the real answer. Ask the user whether to keep it red or mark it `test.fail()` with
  a comment naming the defect.
- **Description defect:** the API behaves sensibly and the description is wrong or silent. Report
  it. Assert the real behaviour only after the user confirms it is intended.
- **Environment:** access, data, limits. Say what is needed.

Never make a red test green by weakening what it checks.

## Step 7 — Prove each test can fail

For every new test, break one expectation on purpose (the status, one value, the schema name), run
it, see it fail for that reason, and restore it. A test that stays green with a wrong expectation
checks nothing: fix it or delete it. Restore by undoing your own edit, then confirm with a run.
Tell the user in plain words what each test would catch ("fails if the status becomes 403").
Finish with a run that gives the same result as step 6 (green, or red only for reported product
defects) and the type check.

## Step 8 — Record what you learned

Report: the tests written, findings, and the commands to run them.

Then propose additions to `CLAUDE.md`, as exact lines, and add them after a yes:

- to **Project profile**: facts about the product you had to discover (an error code, a rule, a
  limit, a field that behaves unexpectedly, an endpoint that is unsafe to call);
- to **Test conventions**: a choice you made that the next spec should repeat (file naming, where
  data helpers live, which id is safe for a 404).

This is how the tests become specific to the product while the skill stays the same for every
product. Do not record guesses, and do not record what the API description already says clearly.
