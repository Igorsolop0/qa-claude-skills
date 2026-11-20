# Ihor's Claude Skills

Personal collection of Claude Code skills I actually use day-to-day — QA engineering, test
automation, and AI-assisted test design.

## About me

I'm Ihor Solopii — Senior QA Engineer / QA Lead based in **Vienna, Austria**. 10+ years in software
testing: 5 years mobile (iOS / Android), 4+ years web, 2+ years API and E2E automation. Currently
building risk-based test strategy, Playwright automation, and AI-assisted QA workflows where agents
apply real test-design methodology (not random test-case generation).

I build skills from real problems I hit at work, and I keep them honest with a gate-checklist
(see [`docs/how-i-build-skills.md`](docs/how-i-build-skills.md)). If a candidate doesn't pass the
gate, it doesn't ship here.

## Skills

### QA / Testing

| Skill | What it does |
|-------|--------------|
| [`qa-shift-left`](skills/qa-shift-left) | Designs a test plan **before** implementation: Burger-method layer analysis, acceptance-criteria scoring, test-design technique selection, level assignment (unit / component / API contract / mocked E2E / live E2E) with a mandatory rationale per scenario, a live-spec budget, and structured verdicts (`ready_to_implement` / `needs_refinement` / `blocked`). |
| [`pw-project-bootstrap`](skills/pw-project-bootstrap) | Sets up a Playwright + TypeScript project from zero by **interviewing** the QA engineer instead of waiting for a prompt: checks the machine, reads the repository, asks 3–4 short rounds, shows a plan, then generates config with per-domain projects, env handling, types and run-time schemas from OpenAPI, API client, fixtures merged into one `test`, `@/` imports, tag constants, ESLint with architecture rules, login setup per role, one green health test, a CI workflow (type check, lint, tests), and an `AGENTS.md` with the project profile and the skill routing. |
| [`api-contract-writer`](skills/api-contract-writer) | Writes three to six honest API contract tests for one endpoint: reads the operation from the API description, probes the real endpoint, proposes the tests and waits, writes, lints, runs, classifies every red test (test / product / description / environment), proves each test can fail, and records what it learned about the product. |
| [`e2e-writer`](skills/e2e-writer) | Writes one or two browser tests for one user scenario and the page objects they need: an `App` container of page objects handed out by fixtures (`app` for a visitor, `<role>App` for a fresh account, `shared<Role>App` for read-only tests), page objects with locators, user-intent methods, `expect*` checks and `@step` reporting. Looks at the real page before naming a locator, prepares data in fixtures, runs three times, proves each test can fail. |
| [`api-contract-reviewer`](skills/api-contract-reviewer) | Behavioral review of Playwright API contract tests — finds false positives, silent contract drift, test coupling, secret leaks, and access through routes the project forbids. |
| [`pw-test-review`](skills/pw-test-review) | Behavioral review of Playwright tests — finds anti-patterns that cause flakes, false positives, and silent bugs (vacuous list loops, positional locators, strict-mode silencing, substring assertions on money, expected values computed the way the app computes them), plus breaks of the project structure. On request, a **mutation check** breaks one assertion at a time and proves the test goes red; a Bun runner restores the file byte-for-byte. Context-aware priority bumps for money domains. |
| [`pw-failure-triage`](skills/pw-failure-triage) | Triages a red Playwright run: collects evidence from the JSON report and traces, classifies each failure as `infra`, `test-drift`, `product-bug` or `flaky` against the commits deployed since the last green run, heals only what is the test's fault (verified with `--repeat-each=3`), and drafts issues for product bugs. Never turns a regression into a green run. |

`pw-pom-generator` is parked in [`drafts/`](drafts) until it follows the same structure.

### Which skill for which job

| Job | Skill |
|---|---|
| A new test project, from zero | `pw-project-bootstrap` |
| Tests for one API endpoint | `api-contract-writer` |
| A browser test for one scenario, with its page objects | `e2e-writer` |
| Review API tests before a pull request | `api-contract-reviewer` |
| Review browser tests, prove they can fail | `pw-test-review` |
| A red run: what broke and whose fault it is | `pw-failure-triage` |
| A test plan for a feature before it is built | `qa-shift-left` |

The bootstrap writes the same table into the project's `AGENTS.md`.

### The structure the skills build

```
AGENTS.md, CLAUDE.md (@AGENTS.md)   rules, product profile, skill routing
eslint.config.mjs                   the rules below, enforced by `npm run lint` and CI
src/api/                            HTTP clients
src/config/tags.ts                  Tag.smoke, Tag.<domain>: no raw tags, no @regression
src/fixtures/<domain>.fixture.ts    fixtures per domain, merged in index.ts into the one `test`
src/ui/app.ts                       App: one getter per page object (app.registerPage)
src/ui/pages/, src/ui/components/   page objects: locators, user-intent methods, expect* checks, @step
src/utils/                          pure functions with *.test.ts next to them
test-data/                          input data builders
tests/                              specs only: they import from @/fixtures and call page objects
```

### Universal skill, project-specific profile

No skill is a silver bullet. A skill written for one product does not port to the next one: the
envelope is different, the auth is different, the folders are different. So the skills here hold
only what is true for every project (how an agent should behave, the default architecture, the
naming, what makes a test honest), and everything particular to a product lives in **`AGENTS.md`
inside the test folder** (Claude Code reads it through a one-line `CLAUDE.md`; Cursor and Codex read
it directly):

- **Setup**: decisions from the bootstrap interview (where tests live, roles, login, environment).
- **Project profile**: error shape, statuses in use, limits, endpoints that must not be called,
  business rules worth a test. Each line marked with where it came from.
- **Test conventions**: fixtures, file naming, data helpers, locator convention, page objects.
- **Skills**: which skill does which job.

Every skill reads that file first, follows it where it conflicts with a default, and proposes new
lines for it at the end of a task. A structure that already exists in the project wins over the
default in the skill. Adapting is expected; the skill files themselves stay untouched.

Typical order on a new project: `pw-project-bootstrap` → `api-contract-writer` per endpoint →
`e2e-writer` per scenario → the two reviewers before a pull request → `pw-failure-triage` on every red run.

## Install

### As a Claude Code plugin (recommended)

One plugin holds every skill:

```bash
/plugin marketplace add Igorsolop0/qa-claude-skills
/plugin install qa-skills@qa-claude-skills
```

Inside a session, `/plugin install` first asks for the scope (choose **user** for every folder).
Then run `/reload-plugins` or restart Claude Code. The skills show as `/qa-skills:pw-project-bootstrap`,
`/qa-skills:e2e-writer` and so on; you can also just describe the job ("set up a Playwright project")
and Claude picks the skill. Update later: `claude plugin marketplace update qa-claude-skills`, then
`claude plugin update qa-skills@qa-claude-skills`, then `/reload-plugins` or a restart. The update compares version
numbers, so every change to the skills bumps the version in `.claude-plugin/plugin.json` and
`.claude-plugin/marketplace.json`.

The same from a terminal, without opening Claude Code:

```bash
claude plugin marketplace add Igorsolop0/qa-claude-skills
claude plugin install qa-skills@qa-claude-skills
```

### As project-local skills

```bash
git clone https://github.com/Igorsolop0/qa-claude-skills.git
mkdir -p .claude/skills && cp -R qa-claude-skills/skills/* .claude/skills/
```

Run it from the test project's folder. Claude Code picks the skills up the next time it starts there.

## How I build skills

Short version: transcript / real workflow → extract "nuggets" → run each candidate through a
5-point gate (Repeat-test, Tribal-knowledge, Triggers, Output, Maintenance) → only winners get a
`SKILL.md`. Failed candidates are kept as drafts, not shipped.

Long version: [`docs/how-i-build-skills.md`](docs/how-i-build-skills.md).
