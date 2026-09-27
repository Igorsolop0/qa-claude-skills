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
| [`api-contract-writer`](skills/api-contract-writer) | Senior SDET assistant for Playwright API contract tests: clients, types, builders, Zod schemas, fixtures, specs. Envelope-aware assertions, status-before-body, exact error-code matching, secrets only in env. |
| [`api-contract-reviewer`](skills/api-contract-reviewer) | Behavioral review of Playwright API contract tests — finds false positives, silent contract drift, test coupling, secret leaks, and prohibited admin-access patterns. |
| [`pw-test-review`](skills/pw-test-review) | Behavioral review of Playwright tests — finds anti-patterns that cause flakes, false positives, and silent bugs (vacuous list loops, positional locators, strict-mode silencing, substring assertions on money). Context-aware priority bumps for money domains. |
| [`pw-pom-generator`](skills/pw-pom-generator) | Scaffold a per-flow Playwright suite (Page Object + typed presets + spec) from locator/scenario notes. Framework- and auth-agnostic — unknown steps are emitted as `SETUP_REQUIRED` placeholders, never fake code. |
| [`playwright-sdet-expert`](skills/playwright-sdet-expert) | Full SDET-assistant persona for an existing Playwright/TypeScript repo — locator priority ladder, per-flow POM layout, exact-match assertions, async/eventual-consistency waits, and a requirements-first workflow with gap analysis. |

## Install

### As a Claude Code marketplace (recommended)

```bash
/plugin marketplace add Igorsolop0/qa-claude-skills
/plugin install qa-shift-left@qa-claude-skills
/plugin install api-contract-writer@qa-claude-skills
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
