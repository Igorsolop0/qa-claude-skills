import { test as base } from '@playwright/test';
import type { BaseClient } from '../api/base-client';
import { unique } from '../utils/unique';
import type { Body, Schemas } from './api.fixture';

type RegisterBody = Body<'/auth/register', 'post'>;

type AuthFixtures = {
  /**
   * An account registered through the API before the test. It is not deleted afterwards: tests may not call
   * `DELETE /users/{id}`, and each registration lives in its own private workspace.
   */
  registeredUser: { credentials: RegisterBody; user: Schemas['User'] };
};

export const test = base.extend<AuthFixtures & { api: BaseClient }>({
  registeredUser: async ({ api }, use) => {
    const credentials: RegisterBody = {
      email: `${unique('user')}@example.com`,
      password: 'Passw0rd!123',
      name: unique('name'),
    };
    const response = await api.send('POST', '/auth/register', { data: credentials });
    if (response.status() !== 201) {
      throw new Error(`registeredUser fixture: expected 201, got ${response.status()}: ${await response.text()}`);
    }
    const { user }: Schemas['AuthResponse'] = await response.json();
    await use({ credentials, user });
  },
});
