import { randomUUID } from 'node:crypto';

/** Marks what tests create, so leftovers on a shared environment can be found and filtered. */
export const TEST_DATA_PREFIX = 'qa-pw';

/** A value that does not repeat between runs and parallel workers: `unique('ticket')` → `qa-pw-ticket-…`. */
export function unique(name: string): string {
  return `${TEST_DATA_PREFIX}-${name}-${Date.now().toString(36)}-${randomUUID().slice(0, 4)}`;
}
