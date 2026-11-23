/**
 * The one `test` and `expect` every spec imports: `import { expect, test } from '@/fixtures'`.
 * Each domain keeps its fixtures in its own `<domain>.fixture.ts`; this file only merges them. Playwright
 * sets a fixture up only when a test asks for it, so merging costs nothing for the tests that do not.
 */
import { expect as baseExpect, mergeTests } from '@playwright/test';
import { toMatchArrayOf, toMatchSchema } from '../matchers/to-match-schema';
import { test as apiTest } from './api.fixture';
import { test as appTest } from './app.fixture';
import { test as authTest } from './auth.fixture';

export const test = mergeTests(apiTest, authTest, appTest);

export const expect = baseExpect.extend({ toMatchSchema, toMatchArrayOf });

export { type AuthState, authFile, type Body, clientFor, type Role, readAuthState, type Schemas } from './api.fixture';
export { unique } from '../utils/unique';
