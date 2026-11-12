# Run routine

Live suites can run in the background of a QA engineer's agent session, so every red run goes to
`pw-failure-triage` before a human looks at it. The same three triggers move to a CI workflow when
the live suites run there; triage then reads the uploaded `test-results/` artefact instead.

## Triggers

| Trigger | Suite | Command (from the profile) |
| --- | --- | --- |
| Session start | Smoke | `<run command> --grep @smoke`, reporting off |
| A new successful deploy of `main` | Smoke | same |
| Twice a day (for example 09:00 and 15:00 local) | Regression | `<run command>` with reporting on |

Runs never overlap: `test-results/` is shared and wiped at the start of every run. Triage a run
before starting the next one.

Detecting a deploy with GitHub Actions:

```bash
gh run list --branch main --workflow "<deploy workflow>" --status success --limit 1 \
  --json headSha,updatedAt --jq '.[0] | "\(.headSha) \(.updatedAt)"'
```

A new `headSha` since the last smoke means a new build. Wait for the rollout (a couple of minutes
after `updatedAt` for an edge deploy) before running.

## Claude Code

Start the routine once per working session (it lives as long as the session):

```text
/loop 20m Check for a new successful deploy of main (pw-failure-triage references/routine.md).
If its headSha differs from the last one you smoked, run the smoke suite in the background. If it
is 09:00–09:20 or 15:00–15:20 local and regression has not run in this window, run the regression
suite instead. When a run ends red, run /pw-failure-triage on it and show me only the report table.
Never commit, push or file issues without my yes.
```

At session start, run the smoke suite once right away before starting the loop. Long runs go
through `run_in_background`, so the session stays usable; the loop wakes the agent when the run
exits.

## Editors without a scheduler

Use the same prompt by hand at the start of the day and after a merge, or run the suite from a
terminal and then ask the agent to "triage the run", pointing it at this skill's `SKILL.md`.

## What reaches the human

- A green run: one line (suite, build sha, duration).
- A red run: the triage table. Proposed diffs stay local until approved, and issue drafts wait
  for a yes.
- The same `infra` failure two runs in a row: escalate to the backend team with the evidence from
  [classification.md](classification.md).
