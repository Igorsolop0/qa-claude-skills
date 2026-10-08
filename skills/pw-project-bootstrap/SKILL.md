---
name: pw-project-bootstrap
description: |
  Sets up a Playwright + TypeScript test project from zero by interviewing the QA engineer instead
  of waiting for a detailed prompt. Checks the machine, inspects the repository, asks a short series
  of questions (where the tests live, what is tested, Swagger link, auth, test users, how runs are
  sliced, CI), shows a plan, then generates a working project: config with per-domain projects,
  env handling, OpenAPI type generation, API client, auth setup, one green health test, CI workflow.
  Trigger: "set up Playwright", "bootstrap Playwright project", "start test automation",
  "create a Playwright project", "new API test project", "I have no automation yet".
  Not for: adding tests to an existing Playwright project (use `api-contract-writer` or
  `e2e-writer`).
argument-hint: optional-target-folder
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - WebFetch
  - Bash(git --version)
  - Bash(mkdir *)
  - Bash(node *)
  - Bash(npm *)
  - Bash(npx *)
  - Bash(pnpm *)
  - Bash(yarn *)
  - Bash(bun *)
  - Bash(git status*)
  - Bash(git rev-parse*)
  - Bash(git init*)
  - Bash(git config --get*)
  - Bash(git check-ignore*)
---

# Playwright Project Bootstrap

You set up a test project for a QA engineer who may never have done it before. They should not
need to write a prompt. You find out what you can from the machine and the repository, ask about
the rest, and build the project that fits their answers.

Work in six phases, in order. Do not generate any file before the plan in phase 4 is approved.

| Phase | What happens | Stops for the user |
|---|---|---|
| 1. Doctor | Check the machine | Only if something must be fixed |
| 2. Detect | Read the repository | No |
| 3. Interview | Ask what could not be detected | Yes, 3–4 short rounds |
| 4. Plan | Show the folder tree and every decision | Yes, wait for approval |
| 5. Generate | Write files, install, generate types | No |
| 6. Verify and hand off | Run the health test, print the command sheet | No |

Question wording, options and what each answer changes: [references/interview.md](references/interview.md).
File templates: [references/templates.md](references/templates.md).

## Phase 1 — Doctor

Run these checks before anything else and report them as one short list.

- Node: `node --version`. Require the current LTS or the one before it. Too old or missing: stop
  and give the install command for this OS.
- To read a URL (the API description, a health endpoint) use `node -e "fetch(...)"`: it reaches
  `localhost` and private hosts, which the web fetch tool does not.
- Git: `git --version`, and whether the current folder is inside a repository
  (`git rev-parse --show-toplevel`). Report the repository root: it may be an unrelated parent.
- Write access: can a file be created in the target folder (a temporary probe file is fine).
- Windows only: `git config --get core.longpaths`. If not `true`, tell the user to run
  `git config --global core.longpaths true`.
- Terminal: if the session runs inside an IDE-embedded terminal that is not VS Code, recommend a
  plain terminal (Windows Terminal, PowerShell, Terminal.app).

If the user cannot install software on this machine, say so plainly and stop. Do not work around
company restrictions.

## Phase 2 — Detect

Read, do not ask. Collect:

- Repository: root path, single package or monorepo (`workspaces`, `turbo.json`, `nx.json`,
  `pnpm-workspace.yaml`), package manager (lockfile).
- Existing tests: `playwright.config.*`, `cypress.config.*`, Selenium projects, a `qa/`, `e2e/` or
  `tests/` folder. **If a Playwright config already exists, stop**: this skill does not overwrite
  a project. Offer the writer skills instead.
- API description: `openapi.*`, `swagger.*`, `*.yaml` or `*.json` with an `openapi` or `swagger`
  key, or a docs route in the code.
- CI: `.github/workflows/`, `.gitlab-ci.yml`, `azure-pipelines.yml`, `Jenkinsfile`.
- Env conventions: `.env.example`, `.env.local`, how other packages load env.
- Language and formatter: `tsconfig.json`, ESLint, Biome, Prettier.
- What is particular about this product, for the project profile. In a product repository read,
  do not guess: the route list and how routes are grouped, the error handler (error body shape,
  status codes in use), validation, auth middleware and roles, rate limits, seed data, tests that
  already exist in any framework, and the two or three business rules a wrong release would break.
  With only an API description, take the same facts from it and from one real response.

Start the interview by telling the user what you found in two or three lines, for example:
"This is a pnpm monorepo with GitHub Actions and no test project yet. I found an OpenAPI file at
`docs/openapi.yaml`." Then name up to five particular things about this product and ask the user
to correct them: they know the product, you have only read it. With no codebase, do this right
after the API description is known.

## Phase 3 — Interview

Rules:

- **Ask only what detection did not answer.** A detected fact becomes the recommended option, not
  a question skipped silently: the user confirms it in the plan.
- Use `AskUserQuestion` for choices, up to four questions per round, recommended option first.
  Ask for free text (URLs, names) in a normal message, all items in one message.
- Every question has a default. "Not sure" means the default, and you say which one you took.
- One sentence per option on what it means for the user later. No jargon without explanation.
- **Never ask for a password, token or API key, and never accept one in chat.** Ask for role
  names; you create the variable names and the user fills `.env` alone. If a secret is pasted
  anyway, do not write it to any file other than `.env`, and tell the user to rotate it.
- Three or four rounds. If an answer makes a later question pointless, skip it.

Rounds (details in the reference):

1. **Where.** Same repository or a separate one; folder name; config next to the tests or in the
   repository root; API only, API and browser, or browser only.
2. **The API.** Base URL per environment; Swagger/OpenAPI link, file, or none; how login works; one
   endpoint that answers without login (for the health test); the web app address when browser
   tests were chosen. As soon as the description is known, read it and detect again: login type,
   roles, limits and a health endpoint often answer the next questions. If it has an operation
   that creates users, propose "another role creates it" for roles without an account. Note
   operations that wipe data or users and write them into `CLAUDE.md` as not to be called by tests.
3. **Users and data.** Which roles the tests need; do tests register their own users or use
   existing ones; is there a limit on login or registration; is the environment shared with other
   people, and may tests create and delete data there.
4. **Running.** How runs are sliced (by domain is the default; smoke and regression are tags); CI
   provider and triggers (manual button, nightly, on pull request); browsers; extra reporters.

## Phase 4 — Plan

Print, then stop and wait:

1. The folder tree that will be created.
2. A decision table: question, answer, what it produces.
3. Every existing file that will be changed (root `package.json`, `.gitignore`, workspace file,
   CI folder), with the exact change.
4. The list of environment variables the user must fill, without values.
5. Anything left open, with the assumption taken.

Change the plan as many times as the user asks. Generate only after an explicit yes.

## Phase 5 — Generate

Follow [references/templates.md](references/templates.md). Order matters:

1. Folder, `package.json`, `tsconfig.json` (strict), `.gitignore` entries, install the pinned
   dev dependencies from the templates. Install browsers only when browser tests were chosen; an
   API-only project installs none.
2. `.env.example` with every variable and a comment. Create `.env` and write the non-secret values
   into it yourself (base URL, API description link). Credentials stay empty for the user. Confirm
   with `git check-ignore` that `.env` is ignored.
3. `playwright.config.ts`: a `setup` project, one `api-<domain>` project per folder under
   `tests/api/` (derived from the folders, never listed by hand), browser projects if chosen.
   A project whose required variables are missing fails with a message that names them.
4. Type generation: `scripts/generate-api-types.mjs` and the `types:api` script. It writes the types
   and `api-schemas.json` for the run-time schema check. Run it once if a Swagger link or file was
   given. Swagger 2.0 is converted to OpenAPI 3 first. No description
   available: skip, and note in the README that schemas will be written from real responses.
5. API layer from the templates, names unchanged: base client with `failOnStatusCode: false`,
   `toMatchSchema` / `toMatchArrayOf` matchers, fixtures.
6. Auth setup from the template: one login per role in the `setup` project, state saved under `.auth/` (ignored by
   git). Users are created or logged in once per run, never per test.
7. One health test in `tests/api/health/`, tagged `@smoke`.
8. CI workflow for the detected provider, triggers as chosen. A manual trigger with `project` and
   `grep` inputs is always included.
9. `README.md` and `CLAUDE.md` inside the test folder. `CLAUDE.md` holds the decisions from the
   interview, the project profile and the test conventions. The skills are universal; everything
   project-specific lives in this file, and later skills read it instead of asking again.

Do not create empty folders, empty domain projects, placeholder specs, or extra documentation
files. Record the first domain name in `CLAUDE.md`; its folder appears with its first spec.

## Phase 6 — Verify and hand off

- Run the type check and `npx playwright test --list`.
- Run the health test first (`npx playwright test tests/api/health`); it needs no account. Green is the definition of done.
  Red: read the report, fix what is yours, and say clearly when the cause is access, VPN or data.
- Ask the user to add emails and passwords to `.env`. Tell them how to open it: it is a hidden
  file, so `code .env` or the editor's file tree, not Finder or Explorer. Then run the setup project.
- A role without an account is not a failure of the bootstrap. Name the role, say which tests will
  wait for it, and offer the way out the API allows (ask the team for an account, or let the setup
  of another role create it).
- Print the command sheet: run everything, run one domain, run smoke, open the report,
  regenerate types.
- Name the next step: "call `api-contract-writer` with an endpoint", then `e2e-writer` with a scenario
  when browser tests were chosen.

## Hard rules

- No file is written before the plan is approved.
- No secret in chat, code, README, or a committed file.
- Never overwrite an existing Playwright project or delete existing tests.
- A separate repository is created locally with `git init` only. Creating a remote or pushing is
  the user's step.
- Do not add a `pull_request` trigger that blocks merges unless the user chose it.
- If the environment is shared or close to production, generate no test that deletes or mutates
  data it did not create, and write that rule into `CLAUDE.md`.
