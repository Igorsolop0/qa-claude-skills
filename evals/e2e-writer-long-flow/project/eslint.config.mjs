// Playwright rules and the architecture rules of this project. What each rule protects: AGENTS.md.
import { defineConfig } from 'eslint/config';
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

/** Specs get page objects from the `app` fixtures and `test`/`expect` from `@/fixtures`. */
const SPEC_IMPORTS = {
  paths: [
    {
      name: '@playwright/test',
      importNames: ['test', 'expect'],
      allowTypeImports: true,
      message: 'Import `test` and `expect` from `@/fixtures`.',
    },
    {
      name: '@/ui/app',
      importNames: ['createApp', 'App'],
      allowTypeImports: true,
      message: '`createApp` is for fixtures only: take `app`, `<role>App` or `shared<Role>App` from the test arguments.',
    },
  ],
  patterns: [
    {
      group: ['@/ui/pages/*', '@/ui/components/*'],
      allowTypeImports: true,
      // The copy a page object checks (`REGISTER_COPY`) is data a spec may assert against.
      allowImportNamePattern: '_COPY$',
      message: 'Take the page object from the `app` fixture; do not construct it in a spec.',
    },
    {
      group: ['@/fixtures/*'],
      importNames: ['test', 'expect'],
      allowTypeImports: true,
      message: 'Import `test` and `expect` from `@/fixtures`, not from one fixture file.',
    },
    { group: ['**/src/**', '**/src'], message: 'Import from `@/…` (tsconfig alias), not a relative src path.' },
    { group: ['**/test-data/**', '**/test-data'], message: 'Import from `@test-data/…`, not a relative path.' },
  ],
};

/** A spec acts through page object methods, never on a locator. */
const LOCATOR_ACTION = {
  selector:
    'CallExpression[callee.property.name=/^(click|dblclick|fill|press|pressSequentially|tap|check|uncheck|selectOption|setInputFiles|hover|type|clear)$/]',
  message: 'Act through a page object method, not on a locator in the spec.',
};

/** Every public async method of a page object is a `@step`, so the report reads as user actions. */
const UNSTEPPED_METHOD = {
  selector:
    'ClassBody > MethodDefinition[kind="method"][static=false][value.async=true][key.type="Identifier"][accessibility!="private"][decorators.length=0]',
  message: 'Put `@step` on a public async page object method (a read polled by `expect.poll` may opt out).',
};

/** Rules that would otherwise stay warnings: a warning does not stop `npm run lint` or CI. */
const STRICT = {
  'playwright/no-wait-for-timeout': 'error',
  'playwright/no-force-option': 'error',
  'playwright/no-conditional-in-test': 'error',
  'playwright/no-conditional-expect': 'error',
  'playwright/no-networkidle': 'error',
  'playwright/prefer-web-first-assertions': 'error',
};

export default defineConfig(
  {
    ignores: ['.auth/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'src/types/**'],
  },
  {
    // The throwaway spec for looking at a page (`e2e-writer`) is not a test and is deleted after use.
    ignores: ['tests/**/_look.spec.ts'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      // Type information, so a call to an async page object method without `await` is an error.
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: { '@typescript-eslint/no-floating-promises': 'error' },
  },
  {
    files: ['tests/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      ...STRICT,
      // `expect*` page object methods count as assertions.
      'playwright/expect-expect': ['error', { assertFunctionPatterns: ['^expect[A-Z]'] }],
      // Tags come from the `Tag` constants, which this rule cannot read.
      'playwright/valid-test-tags': 'off',
      // Blank lines are formatting, not behaviour.
      'playwright/consistent-spacing-between-blocks': 'off',
      '@typescript-eslint/no-restricted-imports': ['error', SPEC_IMPORTS],
    },
  },
  {
    // A setup test asserts inside its helpers (`useCreatedAccount`), which the rule cannot see.
    files: ['tests/_setup/**'],
    rules: { 'playwright/expect-expect': 'off' },
  },
  {
    files: ['tests/e2e/**/*.spec.ts'],
    rules: { 'no-restricted-syntax': ['error', LOCATOR_ACTION] },
  },
  {
    // Page objects get the same Playwright rules (a missing `await`, `waitForTimeout`, `{ force: true }`).
    files: ['src/ui/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      ...STRICT,
      // A page object is not a test: it holds `expect*` methods and no `test()`.
      'playwright/expect-expect': 'off',
      'playwright/no-standalone-expect': 'off',
      'playwright/no-conditional-in-test': 'off',
      'playwright/no-conditional-expect': 'off',
      'no-restricted-syntax': ['error', UNSTEPPED_METHOD],
    },
  },
);
