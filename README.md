# Ihor's Claude Skills

Personal collection of [Claude Code](https://docs.claude.com/en/docs/agents-and-tools/claude-code) skills I actually use day-to-day.

## About me

I'm Ihor Solopii — Senior QA Engineer / QA Manager based in **Vienna, Austria**. 10+ years in software testing: 5 years mobile (iOS / Android), 4+ years web, 2+ years API and E2E automation.

- **Now** — Senior QA at **[Sdui](https://sdui.de/)** (German EdTech): Playwright E2E from scratch, Karate API automation, shift-left testing, test strategy.
- **Previously** — Senior QA / QA Manager at **Career Karma** (led a team of 10, built the Playwright automation strategy), QA Lead at **Bank Pivdenny** and **FUIB** (mobile banking, iOS/Android + microservices/SOAP/REST), and earlier QA roles at Innovecs, Digicode, Brainstack.

**Stack I actually use day-to-day:** Playwright (TypeScript), Karate (API), Detox (React Native), Postman, jMeter, GraphQL, TestRail / QASE, Jira / Notion / Confluence.

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
/plugin marketplace add Igorsolop0/claude-skills
/plugin install pw-test-review@ihor-claude-skills
/plugin install pw-pom-generator@ihor-claude-skills
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

The same pipeline is what produced `pw-test-review` — built from Khotemskyi's Lesson 2 ("Writing Tests"), validated with 4 fixture-based evals (3 broken tests + 1 clean test), benchmarked against a no-skill baseline.

## Project structure

```
claude-skills/
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

## Credits

`pw-test-review` is built on material from [Oleksandr Khotemskyi's Playwright course](https://www.youtube.com/@xotabu4) (Lesson 2 — "Writing Tests"). The anti-pattern catalog is curated against his lecture material plus production experience from EdTech, banking, and Web3. Course material is referenced, not redistributed.

## Side work — iGaming and Solana blockchain

Outside the day job I build and test **[Lorypten](https://github.com/ihor-solopii)** — a decentralized lottery dApp on Solana. iGaming-adjacent (lottery flows, position buying, payouts, RNG) but running fully on-chain via Anchor programs and a Next.js + Phantom-wallet frontend.

That side project is where the harder Playwright automation patterns in this repo get battle-tested:

- Phantom wallet popup automation via CDP-attached real Chrome (not Synpress)
- Multi-transaction flows with background auto-confirm (one user action → ALT + protocol + airdrop txs)
- KB-driven UI exploration (query a Lorypten knowledge base for expected behavior, diff against live UI, write a gap analysis, generate tests from it)
- Wallet-mode-agnostic specs that run in three modes from the same source: Synpress, CDP-attached Chrome, Docker headless

If a skill in this repo survives a Web3 flow with on-chain confirmation latency, browser-extension popups, and shared wallet state — it survives most things. That's the bar.
