---
name: pw-pom-generator
description: Generate a Playwright POM-style test suite (Page Object + typed presets + spec) from flow notes — locators, scenarios, and optional gap analysis. Use when the user wants to scaffold Playwright tests, create a page object for a flow, generate POM files, write a spec from exploration notes, or wire typed test-data presets. Framework- and auth-agnostic — wallet/auth/login steps are emitted as clearly marked placeholders the user fills in. Triggers on phrases like "scaffold Playwright tests", "generate POM", "create page object", "write spec from notes", "Playwright test boilerplate for <flow>".
---

# pw-pom-generator

Scaffold a **per-flow** Playwright suite that follows the Page Object Model + typed presets pattern. The skill emits three files (Page Object, presets, spec) plus optional constants, all consistent with each other and ready to run after the user fills in placeholders for auth/setup.

## When to trigger

Trigger when the user asks to:

- "Scaffold Playwright tests for `<flow>`"
- "Generate a POM / page object for this page"
- "Create page object + presets + spec"
- "Write a Playwright spec from these exploration notes"
- Any time they hand you a list of locators / scenarios and want runnable scaffold code

Do **not** trigger for:

- Reviewing existing tests (use `pw-test-review` instead)
- Running tests / debugging failures
- Setting up a new Playwright project from scratch (no `playwright.config.ts` here — assume one exists)

## Inputs to collect

Ask once, then proceed. Don't drag the user through a form.

1. **Flow slug** — kebab-case (`buy-position`, `checkout`, `login`). Becomes the folder name and file prefix.
2. **Locators** — list of things to interact with on the page. Any format the user gives you is fine (bullet list, paste from exploration doc, JSON). Each locator needs at least a human name (`submit button`) and a recognizable identifier (role+name, label, placeholder, text, or as a last resort CSS).
3. **Scenarios** — minimum one happy path. Negative / gap-coverage / validation cases are optional but recommended.
4. **Project conventions** (if not obvious from a quick scan): fixture path (`tests/fixtures/*.ts`), module system (ESM with `.js` suffix on TS imports, or plain CJS/no-suffix), TypeScript or JS.
5. **Auth/setup hooks** (optional) — if the flow needs login, wallet connect, API seeding, etc. Capture *where* they happen (before the form, mid-flow) so placeholders land in the right spot.

If the user has an exploration report or notes doc, accept it as-is. Don't require a specific schema.

## Output layout

```
tests/<slug>/
├── <slug>.page.ts        # Page Object — locators + high-level actions
├── <slug>.presets.ts     # Typed test data presets
└── <slug>.spec.ts        # Test cases — no raw selectors
```

If the project already has a `tests/components/` or `tests/fixtures/` folder, compose shared components (header, modal, toast) from there instead of redefining them in the POM. See [`references/layout-guide.md`](references/layout-guide.md) for the full convention (shared `src/`, constants split, ESM `.js` suffix gotcha).

## Workflow

### Step 1 — Classify each input

Before writing files, sort the user's notes into buckets:

| Belongs in...                          | What goes there                                                                 |
|----------------------------------------|---------------------------------------------------------------------------------|
| `tests/<slug>/<slug>.page.ts`          | Flow-specific locators + high-level actions; composes shared components         |
| `tests/<slug>/<slug>.presets.ts`       | Strongly-typed test-data fixtures (named consts: `minimumPreset`, `fullPreset`) |
| `tests/<slug>/<slug>.spec.ts`          | Test cases. **No raw selectors.**                                               |
| `src/constants/<slug>.ts` (if exists)  | URL regexes, copy regexes (button labels, success headings), enum-like maps     |
| `tests/components/`                    | UI primitives shared with other flows (header, tx modal, toasts, sidebar)       |

If a constant or component already exists, **reuse it**. Do not duplicate.

### Step 2 — Write the Page Object

See [`references/page-object-template.md`](references/page-object-template.md).

Key rules:

- Constructor takes `Page`, assigns fields **in the body** (avoid `constructor(public readonly page)` — fails on Node 24 strip-only TS)
- One getter per locator, camelCase names
- Locator priority: `getByRole` → `getByLabel` → `getByPlaceholder` → `getByText({ exact: true })` → `getByTestId` → CSS (anchored on `[name]` / `[data-*]`, never `nth(i)`)
- High-level actions compose multiple locators (`fillFromPreset(preset)`, `expand(section)`, `submit()`)
- `goto()` method for the entry URL — accept `baseUrl` as a parameter, don't hard-code it

### Step 3 — Write the presets

See [`references/presets-template.md`](references/presets-template.md).

- Define a `<Flow>Preset` type that mirrors the form/inputs the user described
- Export at least one named const (`minimumPreset`); add more if the user gave multiple scenarios
- If two preset fields are coupled (e.g. "Field B only valid when Field A is X"), encode the constraint with a `// TODO:` comment, not a runtime check

### Step 4 — Write the spec

See [`references/spec-template.md`](references/spec-template.md).

- Default fixture import is `@playwright/test` unless the project has a custom fixture (`tests/fixtures/*.ts`) — if so, ask the user which one and use it
- Auth / wallet / login steps are marked with `// SETUP_REQUIRED: <what>` placeholders the user fills in. **Never** emit fake auth code (mock tokens, hardcoded sessions, `localStorage.setItem` hacks) — placeholders are honest, fakes break in CI
- Use web-first assertions: `expect(...).toBeVisible()`, `.toHaveText()`, `.toBeEnabled()`, `.toHaveURL()`
- **No** `page.waitForTimeout(...)`, `networkidle` (for non-navigation waits), `force: true` clicks, or `toContainText` on numeric values (false-positive risk — `"1"` contains `""`)
- Pull timeouts from config / constants if the project has them; otherwise rely on Playwright's defaults
- Don't add browser teardown — fixtures own that

### Step 5 — Optional: constants file

If the user's notes contain repeated regexes (URL patterns, success-modal headings, button label variants), extract them to `src/constants/<slug>.ts` (or wherever the project keeps constants). If no such folder exists, inline them at the top of the spec as `const` declarations.

### Step 6 — Suggest the npm script

Tell the user (do **not** silently edit `package.json`) to add:

```json
"test:<slug>": "playwright test tests/<slug>"
```

If the project uses `dotenv` or another loader (visible from existing scripts), match that pattern.

### Step 7 — Print a summary

```
✓ tests/<slug>/<slug>.spec.ts    — X tests across Y describe blocks
✓ tests/<slug>/<slug>.page.ts    — Z locators, N actions[, composes <ComponentA>, <ComponentB>]
✓ tests/<slug>/<slug>.presets.ts — M presets exported
✓ src/constants/<slug>.ts        — K constants (if new; otherwise list reused)

Coverage breakdown:
  - Happy path: ...
  - Validation: ...
  - Gap / negative: ...

SETUP_REQUIRED markers: N (lines: ...)
Suggested npm script: "test:<slug>": "playwright test tests/<slug>"
```

Stop after this. Do not execute the tests — the user runs them.

## Hard rules

- **No raw selectors in spec files.** Always go through the Page Object or a shared component.
- **No `test.skip` to hide unimplemented setup.** Use `test.fixme()` with a comment explaining what's missing.
- **No teardown that closes the browser** — fixtures own lifecycle.
- **No `expect(...).toContainText('1')`** — substring on numeric strings false-positives (`"10"` contains `"1"`). Use `toHaveText` or anchored regex.
- **No comments explaining the obvious.** Names should carry the meaning.

## References (load on demand)

- [`references/layout-guide.md`](references/layout-guide.md) — project layout conventions, ESM `.js` suffix gotcha, shared `src/` vs `tests/components/` decision tree
- [`references/page-object-template.md`](references/page-object-template.md) — full POM template with composition example
- [`references/presets-template.md`](references/presets-template.md) — typed presets template
- [`references/spec-template.md`](references/spec-template.md) — spec template with `SETUP_REQUIRED` placeholder pattern
