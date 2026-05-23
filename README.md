# Ihor's Claude Skills

Personal collection of Claude Code skills I actually use day-to-day.

## About me

I'm Ihor Solopii — Senior QA Engineer / QA Manager based in **Vienna, Austria**. 10+ years in software testing: 5 years mobile (iOS / Android), 4+ years web, 2+ years API and E2E automation.

- **Now** — Senior QA at **[Sdui](https://sdui.de/)** (German EdTech): Playwright E2E from scratch, Karate API automation, shift-left testing, test strategy.
- **Previously** — Senior QA / QA Manager at **Career Karma** (led a team of 10, built the Playwright automation strategy), QA Lead at **Bank Pivdenny** and **FUIB** (mobile banking, iOS/Android + microservices/SOAP/REST), and earlier QA roles at Innovecs, Digicode, Brainstack.

I build skills from real problems I hit at work, and I keep them honest with a gate-checklist (see [`docs/how-i-build-skills.md`](docs/how-i-build-skills.md)). If a candidate doesn't pass the gate, it doesn't ship here.

## Skills

### QA / Testing

| Skill | What it does |
|-------|--------------|
| [`pw-test-review`](skills/pw-test-review) | Behavioral review of Playwright tests — finds anti-patterns that cause flakes, false positives, and silent bugs. Context-aware priority bumps for iGaming/fintech. |
| [`pw-pom-generator`](skills/pw-pom-generator) | Scaffold a per-flow Playwright suite (Page Object + typed presets + spec) from locator/scenario notes. Framework- and auth-agnostic — wallet/login steps emitted as `SETUP_REQUIRED` placeholders, never as fake code. |

More coming as I work through Oleksandr Khotemskyi's Playwright course and my own day job. The methodology is documented so the pipeline doesn't depend on me remembering it.

## Install

### As a Claude Code marketplace (recommended)

```bash
/plugin marketplace add Igorsolop0/qa-claude-skills
/plugin install pw-test-review@qa-claude-skills
/plugin install pw-pom-generator@qa-claude-skills
```

After that each skill triggers automatically — `pw-test-review` when you ask Claude to review a Playwright test file, `pw-pom-generator` when you ask Claude to scaffold a Page Object / spec from a list of locators and scenarios.

### As a manual `.skill` zip

1. Download the skill folder you want (e.g. `skills/pw-test-review`).
2. Zip it: `cd skills && zip -r pw-test-review.skill pw-test-review`.
3. In Claude (desktop / claude.ai), upload the `.skill` file in the Skills settings.

### As a project-local skill

Drop the skill folder into your project's `.claude/skills/<skill-name>/` directory. Claude Code will pick it up the next time it starts in that project.

## How I build skills

Short version: transcript / real workflow → extract "nuggets" → run each candidate through a 5-point gate (Repeat-test, Tribal-knowledge, Triggers, Output, Maintenance) → only winners get a `SKILL.md`. Failed candidates are kept as drafts, not shipped.

Long version: [`docs/how-i-build-skills.md`](docs/how-i-build-skills.md).

The same pipeline is what produced `pw-test-review` — built from Khotemskyi's course material, validated with 4 fixture-based evals (3 broken tests + 1 clean test), benchmarked against a no-skill baseline.

## Project structure

```
qa-claude-skills/
├── .claude-plugin/
│   └── marketplace.json        ← makes this repo installable as a Claude Code marketplace
├── skills/
│   └── <skill-name>/
│       ├── SKILL.md            ← thin trigger + workflow (progressive disclosure)
│       ├── references/         ← loaded on demand, not at trigger time
│       └── evals/              ← fixtures + evals.json, so the skill is testable
└── docs/
    └── how-i-build-skills.md   ← methodology, gate-checklist, examples
```

## Contributing / feedback

This is a personal repo, but if you spot something wrong with a skill — open an issue, I'd rather know. PRs welcome for fixes, less so for new skills (the gate is mine to apply).

## License

MIT — see [LICENSE](LICENSE).
