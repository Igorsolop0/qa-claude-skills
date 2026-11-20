# Layout guide

Where each kind of file goes, and why.

## Per-flow folder

Every flow gets its own folder under `tests/`:

```
tests/<slug>/
├── <slug>.spec.ts
├── <slug>.page.ts
├── <slug>.presets.ts
└── assets/              # optional — binary inputs (images, files)
```

Rationale: co-located files are easier to delete, rename, or hand off. A spec that lives next to its Page Object never imports from "somewhere far".

## Shared layers (only if the project already has them)

```
src/
├── config.ts                # baseUrl, timeouts, env-driven values
├── constants/               # cross-flow regexes, enums, copy
│   ├── urls.ts
│   └── durations.ts
└── helpers/                 # cross-flow helpers (auth, API seeding, logging)

tests/
├── fixtures/                # Playwright fixtures (custom test/expect)
└── components/              # UI primitives shared across flows
    ├── header.component.ts
    └── modal.component.ts
```

If these don't exist, **don't create them** for one flow. Inline the constants at the top of the spec. Promote to `src/constants/` only when a second flow needs the same thing — the rule of three applies.

## Module system

Detect from existing files before generating imports.

### ESM mode (`"type": "module"` in package.json)

- TypeScript imports of files inside the same project need a `.js` suffix on the specifier:
  ```ts
  import { config } from '../../src/config.js';  // .js, not .ts
  ```
- Imports within `tests/<flow>/` and between `tests/<flow>/` ↔ `tests/components/` ↔ `tests/fixtures/` do **not** need `.js` if the tsconfig `include` covers `tests/**/*.ts`.
- `tsconfig.json` needs `"moduleResolution": "Bundler"` (or `"NodeNext"`).

### CJS / classic mode

- No suffix on imports. Standard `import { x } from '../foo'`.

### Node 24 strip-only TS

If `package.json` shows Node 24+ with strip-only TypeScript (no `tsc`/`tsx`/`ts-node` in the test command — just `node --experimental-strip-types` or Playwright with native TS), avoid:

- `enum` — use `const` objects + `as const` instead
- `constructor(public readonly page: Page)` parameter properties — assign in the body
- Decorators
- Any other emit-required syntax

Detect this by checking the test runner command in `package.json` scripts. If unclear, ask the user.

## Decision tree: where does this go?

```
Is it a locator or action specific to ONE flow?
  └── tests/<slug>/<slug>.page.ts

Is it a UI primitive used in 2+ flows (header, modal, toast)?
  └── tests/components/<name>.component.ts

Is it test data?
  └── tests/<slug>/<slug>.presets.ts

Is it a regex / copy string used in 2+ flows?
  └── src/constants/<topic>.ts  (create folder if it makes sense for the project)

Is it a helper that talks to the app's API / auth / wallet?
  └── src/helpers/<topic>.ts

Anything else?
  └── inline it in the spec. Promote later if it repeats.
```
