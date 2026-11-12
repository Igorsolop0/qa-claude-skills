---
name: pw-test-review
description: Review Playwright tests (TypeScript/JavaScript) for known anti-patterns and reliability issues — networkidle abuse, missing await, nested describe, beforeAll with shared state, toContainText false positives, unchecked goto status, weak locators, force clicks, hardcoded sleeps, list-iteration false positives (`.all()`/`count()` without `toHaveCount`), positional and strict-mode locator ambiguity (`first`/`last`/`nth`), XPath-into-shadow-DOM. Use whenever a user asks to review a Playwright test file, snippet, PR diff, or code-smell-check a `.spec.ts` / `.test.ts` / `e2e` test, or asks "why is this test flaky", "is this test good", "anti-patterns in this playwright code", "code review playwright", or wants a second opinion on Playwright test quality. Trigger even if they don't explicitly say "review" — any time Playwright test code is shared with intent to evaluate it.
---

# pw-test-review

Behavioral review of Playwright tests — find anti-patterns that cause flakes, false positives, slow runs, or hidden bugs. Not a stylistic linter.

## When this skill applies

Trigger on requests like:

- "Review this playwright test"
- "Is this test good / flaky / OK?"
- "Why is this test flaky?"
- "Code smell in this PW spec"
- "PR review for playwright"
- A `.spec.ts` / `.test.ts` / `e2e` file shared without explicit instructions — assume review.

If the user shares a whole directory, scan all `.spec.ts` / `.test.ts` files; otherwise focus on what they share.

## Workflow

1. **Read the test code.** For each file the user supplies — open it, look at the actual contents. Don't review off vibes.
2. **Walk the anti-pattern catalog.** Read `references/anti-patterns.md` and check each item against the code. The catalog is organized by priority — work top-down, capture line numbers and code snippets as you go.
3. **Context-aware bumps.** If the user mentions money / iGaming / fintech / KYC / balances, raise the priority of `toContainText` and unchecked `response.status()` findings by one level. They cause silent bugs in those domains.
4. **Write the report.** Use the structure in `references/output-template.md`. Skip empty sections. Cite line numbers. One sentence per "why" — explain mechanism, not policy.
5. **Don't fabricate.** If a category has no findings, omit it. Better three sharp findings than ten wobbly ones. Always include a "What's good" section — tells the author what to keep.
6. **Mutation check.** Run § Mutation check only when the user asks for it or for a full review: it runs live tests, which may create real accounts or data on the environment. Otherwise end the report with one line that offers it and names those side effects. Static review says a test *looks* right; a mutation proves it can fail.

If the test folder has a `CLAUDE.md` project profile, read it first: the run command, the test id convention, the env that turns reporting off, and the fixtures that create data or set auth come from there.

## Money-domain context

When the code under review covers money, balances, payments, or any real-value domain, also check
these rules (cite them as findings only when they cause a real failure mode):

- **Always apply the money-domain priority bumps** from `references/anti-patterns.md`: balances,
  bonuses, and deposits are in scope even if the user doesn't say so.
- **Mock-stack leaks.** `?mocks=on`, `x-wiremock`, or `PLAYWRIGHT_USE_MOCKS` in a suite that reports
  to a test-management tool as "live" → High: the run silently tests mock data while reporting live.
- **Session/project routing.** Authenticated-only assertions in a file that the config routes to a
  guest/unauthenticated project → High: it runs without the session and fails or, worse, passes
  against guest chrome.
- **Traceability.** A multi-step case without `test.step`, or a missing/invented test-management
  `@T` id → Medium: the reporter can't show the failing step or match the case.
- **Live accounts.** Registering a new real account in a spec when a shared setup session would do
  → Medium: each run creates real backend accounts.
- **Perpetual-network apps.** Apps with long-lived connections (analytics, websockets) never reach
  `networkidle`; prefer `waitUntil: "domcontentloaded"` plus a wait on the element under test.

## Mutation check — prove the test can fail

A test that cannot fail proves nothing. Break the test on purpose and confirm it goes red.

**Safety rules**

- Dev or test environments only, never prod. Never mutate product code, env files, config, or fixtures that create data or set auth (storage state, account fixtures, data builders).
- Mutate the assertion that carries the intent wherever it lives. When it sits in a Page Object or helper, mutate that one line and run only the one spec under review. Name the helper in the report: the same edit would also break every other spec that imports it.
- One mutation at a time. Usually one per independent assertion or step, up to 4 per test, riskiest first.
- Never `git checkout`, `restore`, `stash`, or `reset` to revert: the tree often holds uncommitted work, sometimes another agent's. Use `scripts/mutate.ts` (below). It restores the original bytes and prints `RESTORED`. On `RESTORE-FAILED`, stop.
- Preconditions: the project exists (`<run command> <spec> --list --project=<project>`) and the baseline run is green. If the baseline is red, run it once more. If it is red twice, record the first failing line and skip that test.
- Live side effects: runs against a live environment may register real accounts or leave real data. Budget per test: 1 baseline plus the mutations, `--retries=0`, no whole-file runs, no re-runs for curiosity.

**What to mutate**

Prefer changing the input or the observable behaviour over rewriting the expected value. Changing `toEqual([])` to `toHaveLength(1)` always fails and only proves the line runs.

- Remove the assertion (`--new ''` on the `await expect…` call). If the test still passes, the assertion carries no weight. This is the strongest probe for guard and precondition checks.
- API: invalid payload, wrong id or token, wrong tenant, a flipped flag. Then the expected status, code, or field.
- UI: negated state (`toBeVisible` → `toBeHidden`, `"signed-in"` → `"guest"`), wrong URL or query parameter, a regex that cannot match, a wrong locator or test id.
- When the spec has no assertions of its own (everything is delegated to a helper), mutate the helper's assertions. Also mutate one spec-level input, such as the case slug or data id behind the title. If that input mutation survives, the test name is not tied to what the test checks.

**Run**

From the folder that holds `playwright.config.ts`, one mutation per call (needs Bun):

```bash
bun <skill-dir>/scripts/mutate.ts --file <file to mutate> --line <n> \
  --old '<exact text>' --new '<replacement>' --spec <spec> --project <project> \
  --grep '<test tag or unique title>' --out <run id> \
  --cmd 'npx playwright test' --env <REPORTER_TOKEN>= --protect <fixtures dir> --protect <config dir>
```

- **Timeout.** Give the shell tool a timeout longer than the project's test timeout plus setup (for a 240 s test timeout, use 600 s). A tool timeout or Ctrl+C sends a signal; the script then restores the file and prints `RESTORED (after SIGINT)`, but a hard kill (`SIGKILL`) cannot be caught. After a hard kill, compare the file with the printed `MUTATED` copy (`cmp <file> <MUTATED path>`). Copy `BACKUP` over the file only when they are byte-identical; if they differ, someone else changed the file, so do not overwrite it: stop and report `RESTORE-FAILED`.
- **Selection.** `--grep` is taken literally (regex characters are escaped): a test-management tag in the title, a Playwright tag, or a unique title. The script lists the spec first and refuses (`NOOP`) unless it selects exactly one test in `--project`, so a mutation in a shared helper cannot be "killed" by a sibling test.
- **Guards.** `--file` must be a relative source file; `.claude/`, `.env*`, `node_modules/`, `.git/` and every `--protect` prefix are refused. `--out` is a short id (letters, digits, dashes), new for every run: an existing `test-results/mut-<id>/` is refused, so a rerun never overwrites an earlier backup. The script also refuses (`REFUSED`) when the file still holds the mutation of an earlier hard-killed run; restore that run first. `--file` is checked by its real path too, so a symlink out of the folder is refused. Only one run per file at a time: a run holds `test-results/mutate-locks/<hash>.lock` until it restores the file, and a second run on the same file is refused. A hard kill or `RESTORE-FAILED` leaves the lock; delete it only after the file is restored. `--old` must occur exactly once on the line, overlapping matches included; `--new` is inserted literally.
- **Run.** It saves the original to `test-results/mut-<run id>/original.<name>`, runs `--cmd` with the `--env` overrides, `--retries=0`, `--trace=off` and `--reporter=list,json`, and restores the file only while it still holds the mutation, so a concurrent edit is never overwritten. The full output is in `test-results/mut-<run id>/run.log`; the script prints the target test's own result and error from the JSON report.
- **Baseline.** Run the same `<run command> <spec> -g '<grep>' --project=<project> --retries=0 --trace=off` by hand without a mutation. Projects with a setup dependency run setup first; the test count in that output includes it.

**Classify** — start from the script's `RESULT:` line, then read the printed error and its location, never just the exit code:

- **Clean kill**: the test failed on the mutated line or on the assertion that the mutation targets.
- **Weak kill**: `RESULT: FAILED`, but the target test failed outside the mutated assertion, for example on a different error code, a timeout in another step, or in one of its own fixtures or a network call. The test started, so this is not Invalid; it is not a kill either. Redo it with a mutation that isolates one assertion.
- **Survived**: the test passed.
- **NOOP**: the mutation did not apply, or `--grep` did not select exactly one test. This proves nothing.
- **Invalid**: `RESULT: INVALID`. The run cannot prove that the target test executed: the mutation broke the syntax (`--new ''` can do that), a setup project failed, or there is no readable report. A missing or broken report can hide a real kill, so when `run.log` shows the target test failing, read that error and classify it as a clean or weak kill instead. Any failure after the target test started is a clean or weak kill, never Invalid. This proves nothing; pick another mutation.
- **Skipped**: `RESULT: SKIPPED`. The test skipped itself, so no assertion ran. This is not a survivor; fix the precondition or choose a project where it runs.
- **Equivalent**: the mutation cannot change any observable outcome. Examples: a predicate in a negative-evidence watcher (a check that something did *not* happen), or swallowing the last check with `.catch(() => {})` when an earlier assertion already covers that state.

**After the check**

Delete only your own `test-results/mut-<run id>/` (it also holds the backup and the log). Traces from failed runs can contain bearer tokens, and other runs may own the rest of `test-results/`. Confirm that `git diff` for the files you mutated is unchanged from before the check.

**Report**

| Test | Mutation (file:line, before → after) | Result | Note |
|---|---|---|---|

Report a survivor as a High finding only when it is not equivalent and no earlier assertion on the same state covers it. Otherwise give it a lower severity, or a note when it is equivalent. Name the cause (missing read-back, early return, skip on missing data, swallowed catch, retries/soft asserts, asserting a value the test produced itself, `toBeTruthy`, title not bound to the data) and give a fix. Finish with counts for clean kills, weak kills, survivors, noop/invalid/skipped/equivalent mutations, and skipped red baselines.

## Philosophy

The user is a senior QA engineer. They value root-cause reasoning over rules. For every finding, the "why" should explain the **mechanism** by which the pattern causes a problem — not "the docs say so", not "best practice". If you can't justify a finding by mechanism, drop it.

This is a **behavioral** review. Don't nitpick formatting, variable naming, semicolons, import order, or stylistic preferences — that's what ESLint and Prettier are for. Focus on patterns that cause real flakes, false positives, slow runs, or hidden bugs.

## References

- `references/anti-patterns.md` — full catalog of patterns to flag, grouped Critical → Low, with mechanism and fix for each.
- `references/output-template.md` — exact output structure.
- `scripts/mutate.ts` — the single-line mutation runner for § Mutation check.

Open both at the start of every review.
