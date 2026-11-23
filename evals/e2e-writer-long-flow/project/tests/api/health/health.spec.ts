import { Tag } from '@/config/tags';
import { expect, test } from '@/fixtures';

test('service answers', { tag: [Tag.smoke] }, async ({ api }) => {
  const response = await api.send('GET', '/health');

  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ status: 'ok' });
});
