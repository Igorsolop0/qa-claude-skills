# Page Object template

Use this shape. Adapt names to the flow.

```typescript
import type { Page, Locator } from '@playwright/test';
// Compose shared components only if the project has them:
// import { HeaderComponent } from '../components/header.component';
// import { ModalComponent } from '../components/modal.component';
import type { <Flow>Preset } from './<slug>.presets';

export class <Flow>Page {
  readonly page: Page;
  // readonly header: HeaderComponent;
  // readonly modal: ModalComponent;

  constructor(page: Page) {
    this.page = page;
    // this.header = new HeaderComponent(page);
    // this.modal = new ModalComponent(page);
  }

  // ── Locators (one getter per element from the user's notes) ─────────
  // Prefer getByRole → getByLabel → getByPlaceholder → getByText({exact}) → getByTestId → CSS

  get titleInput(): Locator {
    return this.page.getByLabel('Title');
  }

  get submitButton(): Locator {
    return this.page.getByRole('button', { name: /^(Submit|Create)$/ });
  }

  get successHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Success', exact: true });
  }

  // ── Navigation ───────────────────────────────────────────────────────

  async goto(baseUrl: string): Promise<void> {
    await this.page.goto(new URL('/<flow-path>', baseUrl).toString());
  }

  // ── High-level actions ───────────────────────────────────────────────

  async fillFromPreset(preset: <Flow>Preset): Promise<void> {
    await this.titleInput.fill(preset.title);
    // ... one line per field, mapped from preset
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}
```

## Rules

- **Constructor body assigns fields.** No `constructor(public readonly page)` — that syntax is unsupported under Node 24 strip-only TS.
- **One getter per locator.** Don't inline `page.getByRole(...)` in actions — getters make the locator catalog scannable and replaceable.
- **Anchor regex options on exact intent.** `name: /^Submit$/` is safer than `name: 'Submit'` if the page also has a "Submit and continue" button. But don't over-anchor — `name: 'Submit'` is fine when the text is unique.
- **No `page.locator('div.foo > span')`-style CSS chains.** If CSS is unavoidable, anchor on a stable attribute (`[name="title"]`, `[data-testid="submit"]`), never on layout classes or `nth-child`.
- **Actions can read state.** A `submit()` method that asserts the button is enabled before clicking is fine. But put **assertions about flow outcomes** in the spec, not the POM — the spec is what fails informatively.

## Composing shared components

If the project has `tests/components/`, compose them as readonly fields:

```typescript
export class <Flow>Page {
  readonly page: Page;
  readonly header: HeaderComponent;

  constructor(page: Page) {
    this.page = page;
    this.header = new HeaderComponent(page);
  }
}
```

In the spec, access via `flow.header.loginButton.click()`. Do **not** re-define the header's locators inside `<Flow>Page` — that duplicates and drifts.

## What does NOT go in the Page Object

- Test data (goes in `.presets.ts`)
- Assertions about flow outcomes (go in the spec)
- API calls / auth setup (goes in fixtures or `src/helpers/`)
- Hard-coded URLs (accept `baseUrl` as a parameter to `goto`)
