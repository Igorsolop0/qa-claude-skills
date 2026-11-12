# Healing

Heal only `test-drift` and `flaky`. The goal is a test that asserts the **current intended**
behaviour as strictly as before, not a test that passes.

## Loop

1. **Reproduce.** Rerun the single test with the profile's run command, reporting off:
   `<run command> <spec> --project=<project> -g "<test id or title>"`.
   It passes on the first rerun, and the class was `test-drift`? Re-check the class.
2. **Inspect the live UI** where the test failed: the `error-context.md` snapshot, or a fresh
   look through a browser tool (delegated to a cheap worker) at the same viewport and session as
   the project.
3. **Patch** the smallest thing: the Page Object or component locator first, the spec second.
   Follow the project's conventions (`playwright-sdet-expert`: accessible locators, exact matches).
4. **Verify** with `--repeat-each=3`, plus the sibling projects that run the same spec when the
   fix touches a shared Page Object.
5. **Stop** after three patch attempts on one test. Report it as unresolved with the attempts.

## Allowed fixes by shape

| Shape | Fix |
| --- | --- |
| Element renamed or restructured (testid, role, accessible name) | Update the locator in the Page Object to the new accessible name or role. Never fall back to CSS or XPath chains |
| Element removed on purpose for this audience or viewport | Assert its absence (`toHaveCount(0)`) where the product rule says so, and move the remaining coverage to the project where it exists (for example a `*.desktop.spec.ts`) |
| Interaction differs per viewport (dialog vs sheet) | Use the interaction the product offers there (Escape, backdrop press, drag handle), or split the spec by project |
| Copy changed | Update the preset or message constant to the new approved copy. Keep the exact match |
| Assertion races a transient UI | Assert while the UI is guaranteed to be present (merge `toBeVisible` and `toHaveCount` into one first check), or pause the transient element through the product's own behaviour (hover pauses most toast libraries). Do not stretch timeouts past the UI's lifetime |
| Action races hydration or navigation | Wait on the state the next step needs (`toBeVisible`/`toBeEnabled` on the target, `waitForResponse` on the call) |
| Shared data between workers | Give the test its own data (fresh number, fresh player), or serialise it with a reason in a comment |

## Never

- Delete or weaken an assertion, widen exact text to a substring or regex, or lower an expected
  count, to pass.
- `force: true`, `waitForTimeout`, `networkidle`, `try/catch` around `expect`, `.catch(() => {})`.
- Switch a live test to mocks, or skip a project to make it green.
- `test.fixme()`/`test.skip()` without an issue link and the user's yes.
- Touch product code.

## Output per healed test

- The diff (local, uncommitted).
- One sentence: what changed in the product (PR link) or which race was fixed.
- The verification command and its result (`3 passed`).
