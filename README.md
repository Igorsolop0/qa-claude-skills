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
| [`qa-shift-left`](skills/qa-shift-left) | Designs a test plan **before** implementation: Burger-method layer analysis, acceptance-criteria scoring, test-design technique selection, level assignment (unit / component / API contract / mock / live E2E) with a mandatory rationale per scenario, a live-spec budget, and structured verdicts (`ready_to_implement` / `needs_refinement` / `blocked`). |
| [`pw-project-bootstrap`](skills/pw-project-bootstrap) | Sets up a Playwright + TypeScript project from zero by **interviewing** the QA engineer instead of waiting for a prompt: checks the machine, reads the repository, asks 3–4 short rounds, shows a plan, then generates config with per-domain projects, env handling, types and run-time schemas from OpenAPI, API client, login setup per role, one green health test, CI workflow, and a `CLAUDE.md` with the project profile. |
| [`api-contract-writer`](skills/api-contract-writer) | Writes three to six honest API contract tests for one endpoint: reads the operation from the API description, probes the real endpoint, proposes the tests and waits, writes, runs, classifies every red test (test / product / description / environment), proves each test can fail, and records what it learned about the product. |
| [`e2e-writer`](skills/e2e-writer) | Writes one or two browser tests for one user scenario: follows the page-object structure the project already has (or sets up `PageHolder` → `Component` → `AppPage` + `Application`), looks at the real page before naming a locator, prepares data through the API, one logged-in app per role, runs three times, proves each test can fail. |
| [`api-contract-reviewer`](skills/api-contract-reviewer) | Behavioral review of Playwright API contract tests — finds false positives, silent contract drift, test coupling, secret leaks, and access through routes the project forbids. |
| [`pw-test-review`](skills/pw-test-review) | Behavioral review of Playwright tests — finds anti-patterns that cause flakes, false positives, and silent bugs (vacuous list loops, positional locators, strict-mode silencing, substring assertions on money). Context-aware priority bumps for money domains. |
| [`pw-pom-generator`](skills/pw-pom-generator) | Scaffold a Playwright suite (Page Object + typed presets + spec) from locator/scenario notes when the app cannot be opened yet. Follows the structure the project has. Unknown steps are emitted as `SETUP_REQUIRED` placeholders, never fake code. |
| [`playwright-sdet-expert`](skills/playwright-sdet-expert) | Full SDET-assistant persona for an existing Playwright/TypeScript repo — locator priority ladder, per-flow or registry POM layout (whichever the repo has), exact-match assertions, async/eventual-consistency waits, and a requirements-first workflow with gap analysis. |

### Universal skill, project-specific profile

No skill is a silver bullet. A skill written for one product does not port to the next one: the
envelope is different, the auth is different, the folders are different. So the skills here hold
only what is true for every project (how an agent should behave, the default architecture, the
naming, what makes a test honest), and everything particular to a product lives in **`CLAUDE.md`
inside the test folder**:

- **Setup**: decisions from the bootstrap interview (where tests live, roles, login, environment).
- **Project profile**: error shape, statuses in use, limits, endpoints that must not be called,
  business rules worth a test. Each line marked with where it came from.
- **Test conventions**: fixtures, file naming, data helpers, locator convention, page objects.

Every skill reads that file first, follows it where it conflicts with a default, and proposes new
lines for it at the end of a task. A structure that already exists in the project wins over the
default in the skill. Adapting is expected; the skill files themselves stay untouched.

Typical order on a new project: `pw-project-bootstrap` → `api-contract-writer` per endpoint →
`e2e-writer` per scenario → the two reviewers before a pull request.

## Install

### As a Claude Code marketplace (recommended)

```bash
/plugin marketplace add Igorsolop0/qa-claude-skills
/plugin install qa-shift-left@qa-claude-skills
/plugin install pw-project-bootstrap@qa-claude-skills
/plugin install api-contract-writer@qa-claude-skills
/plugin install e2e-writer@qa-claude-skills
/plugin install api-contract-reviewer@qa-claude-skills
/plugin install pw-test-review@qa-claude-skills
/plugin install pw-pom-generator@qa-claude-skills
/plugin install playwright-sdet-expert@qa-claude-skills
```

### As a project-local skill

Drop the skill folder into your project's `.claude/skills/<skill-name>/` directory. Claude Code
will pick it up the next time it starts in that project.

## How I build skills

Short version: transcript / real workflow → extract "nuggets" → run each candidate through a
5-point gate (Repeat-test, Tribal-knowledge, Triggers, Output, Maintenance) → only winners get a
`SKILL.md`. Failed candidates are kept as drafts, not shipped.

Long version: [`docs/how-i-build-skills.md`](docs/how-i-build-skills.md).
