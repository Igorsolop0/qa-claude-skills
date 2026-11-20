# Presets template

```typescript
// tests/<slug>/<slug>.presets.ts

export type <Flow>Preset = {
  title: string;
  amount: string;
  category: 'standard' | 'premium';
  // ... mirror the fields the user gave you, with the narrowest type that's correct
};

export const minimumPreset: <Flow>Preset = {
  title: 'E2E Minimum',
  amount: '0.01',
  category: 'standard',
};

export const fullPreset: <Flow>Preset = {
  title: 'E2E Full',
  amount: '100.00',
  category: 'premium',
};
```

## Rules

- **Named exports, one preset per scenario.** No default exports, no arrays-of-presets — named consts are greppable and import-completion-friendly.
- **Narrowest type that's correct.** If a field is one of three values, use a union (`'a' | 'b' | 'c'`), not `string`. The type catches typos at edit time.
- **Numbers as strings when they're form input.** A form field receives `"0.01"`, not `0.01` — keep the type honest.
- **Mark coupling constraints with `// TODO:` comments.** If "field B is only valid when field A is X", encode it as a comment on the relevant preset field, not a runtime guard:
  ```typescript
  // TODO: requires category === 'premium' (UI hides this field otherwise)
  premiumDiscount: '10%',
  ```
- **Use a faker library only with a clear prefix.** If the project uses `faker`, prefix faker-generated strings so they're recognizable in test reports:
  ```typescript
  title: `E2E-${faker.string.alphanumeric(6)}`,
  ```
  Pure random data (no prefix) makes failed tests impossible to triage in shared dashboards.

## What does NOT go in presets

- Functions / dynamic values that depend on test state — put those in fixtures or computed inside the spec
- Locators (goes in the Page Object)
- Assertions / expected values (inline in the spec, or extract to `src/constants/` if reused across flows)
