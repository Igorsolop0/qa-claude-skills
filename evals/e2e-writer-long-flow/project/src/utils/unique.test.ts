import { expect, test } from '@playwright/test';
import { unique } from './unique';

test('unique marks the value as test data, keeps the name and never repeats', () => {
  const values = new Set(Array.from({ length: 50 }, () => unique('ticket')));

  expect(values.size).toBe(50);
  for (const value of values) expect(value).toMatch(/^qa-pw-ticket-[a-z0-9]+-[a-f0-9]{4}$/);
});
