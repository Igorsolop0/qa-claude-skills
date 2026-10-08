# Interview

Each question lists its options, the default, what the answer changes, and the reason the default
is what it is. Reasons come from three real projects: an iGaming portal monorepo, an EdTech
monorepo with an API-only suite, and a school platform migrating from Selenium.

Skip a question when detection answered it; show the detected value in the plan instead.

## Round 1 — Where

### 1.1 Where should the tests live?
| Option | Meaning | Produces |
|---|---|---|
| In this repository (default when a product repo is open) | Tests sit next to the code they check and change in the same pull request | A test folder with its own `package.json` |
| In a separate repository | Tests have their own history and access rights; no link to product pull requests | The project is the repository root, `git init` there |

Why the default: all three projects keep tests in the product repository. A separate repository
fits when the QA has no write access to the product repo or tests cover several products.

Separate repository: if the open folder is empty, it becomes the repository. Otherwise create a
sibling folder and ask for its name. If the folder sits inside an unrelated git repository, say so
and ask before running `git init` (a repository inside a repository confuses both). Default:
do not run it; tell the user to move the folder out or run `git init` later.

### 1.2 Folder name
Only for "in this repository". Options: `qa/` (default), `e2e/`, `tests/`, other. If the name is
taken, propose the next one.

### 1.3 Where does the Playwright config go?
| Option | Meaning |
|---|---|
| Inside the test folder (default) | The test project is self-contained; commands run from that folder |
| Repository root | One config for the whole repo; only for a small single-package repo |

Why the default: in a monorepo, `npx playwright` from the root picks up the hoisted runner and
does not see the test project's config or its projects. In a monorepo do not offer the root.
Write "run commands from `<folder>`" into the README and `CLAUDE.md`. Claude Code must also be
started from that folder, or project skills are not found.

### 1.4 What do you want to test?
| Option | Produces |
|---|---|
| API and browser (default) | `tests/api/`, `tests/e2e/`, Chromium installed |
| API only | No browser install, no `page` fixtures, faster CI |
| Browser only | `tests/e2e/`, no type generation |

Why it matters: an API-only suite that installs browsers wastes minutes on every CI run.

## Round 2 — The API

Ask as one free-text message.

- **Base URL** of the test environment. More than one environment? Names and URLs.
  Produces `BASE_URL` (or `ENV` plus one `.env.<name>` per environment).
- **Swagger / OpenAPI**: link, file path, or "none". Produces `OPENAPI_SOURCE` and the
  `types:api` script. If the link needs VPN or login, ask for a downloaded file instead.
  People usually give the Swagger page, not the document. If the link returns HTML, try
  `/openapi.json`, `/docs/json`, `/swagger.json`, `/v3/api-docs`, `/swagger/v1/swagger.json` on
  the same host and under the base URL, then look for a `url:` in the page source, then ask.
- **Web app address**, only when browser tests were chosen. Produces `WEB_URL`. No web app yet:
  switch to API only and skip the browser install.
- **An endpoint that answers without login**, for the health test. If a description is available,
  propose one from it.

Then one choice question:

### 2.1 How does login work?
| Option | Produces |
|---|---|
| Login endpoint returns a token (default) | Setup logs in per role, token stored under `.auth/`, sent as a header |
| Session cookie | Setup logs in, `storageState` saved and reused |
| Static API key | Key read from env, no setup login |
| Company SSO / OAuth | Ask whether test users can log in with a password or a service token exists; if not, stop and name this as a blocker for the team |

The question tool takes four options. "No login" is not offered: take it only when the description
has no security scheme, or the user types it. Then there is no setup project.

If a description was given, read the security schemes and the login operation first and propose
the answer.

## Round 3 — Users and data

### 3.1 Which roles do the tests need?
Free text: for example `admin`, `user`, `guest`. For each role whose account already exists
(see 3.2) generate `<ROLE>_EMAIL` and `<ROLE>_PASSWORD` in `.env.example`. Do not ask for the values.

### 3.2 Where do test users come from?
Ask per role when the answers may differ.

| Option | Produces |
|---|---|
| The account already exists (default) | Setup only logs in |
| Tests register their own | Setup registers once per run and reuses the accounts in every test |
| Another role creates it through the API | The setup of that role creates the account once per run |
| Not sure / no account yet | Variables stay empty; tests for this role wait. Never assume the account exists |

Why "once per run": registration in every test hit rate limits on two projects and failed whole
runs.

### 3.3 Is there a limit on login or registration?
Options: no / yes / not sure (default: not sure). "Yes" or "not sure": setup caches sessions on
disk and the README says to ask the backend team for the limit.

### 3.4 May tests create and delete data in this environment?
| Option | Produces |
|---|---|
| Yes, it is a test environment (default) | Normal create and clean-up |
| Shared with other people | Tests touch only data they created; names carry a prefix |
| Close to production | Read-only tests by default; an explicit env switch is required to run anything that writes |

## Round 4 — Running

### 4.1 How do you want to slice runs?
| Option | Produces |
|---|---|
| By domain, with `@smoke` and `@regression` tags (default) | One project per folder in `tests/api/`; tags for intent |
| Tags only | One `api` project |
| Per brand, country or tenant too | A worker option plus one project per value that is configured in env |

Why the default: a project answers "which part of the product", a tag answers "why this run".
They combine: `--project=api-users --grep @smoke`. Smoke as a separate project duplicates test
selection and tends to stay in the config without a CI job.

Ask for the first domain name (for example `users`). Create only `health`; write the domain name
into `CLAUDE.md`. Its folder appears with its first spec.

### 4.2 CI
Detected provider is the default; nothing detected: ask which one (GitHub Actions, GitLab, Azure,
none yet). Ask whether the CI can reach the test environment: `localhost` or a VPN-only address
cannot run on hosted runners (default: decide from the base URL; `localhost` means no). Multi-select for triggers:
- Manual button with `project` and `grep` inputs (always on)
- Nightly
- On pull request (warn: red tests will block merges; start without it)

### 4.3 Browsers (only if browser tests were chosen)
Chromium only (default) / plus WebKit / plus mobile viewport. Each extra browser multiplies run
time; add later when a real need appears.

### 4.4 Reporting
HTML report (always) / plus JUnit for the CI system / plus a test management reporter. A reporter
that needs a key is enabled only when its env variable is set.
