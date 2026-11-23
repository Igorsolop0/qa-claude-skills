import fs from 'node:fs';
import path from 'node:path';
import { test as base, type APIRequestContext } from '@playwright/test';
import { BaseClient } from '../api/base-client';
import type { components, paths } from '../types/api';

/** Body types from the API description: `const ticket: Schemas['Ticket'] = await response.json()`. */
export type Schemas = components['schemas'];

/**
 * Request body of an operation, checked against the API description:
 * `const data: Body<'/tickets', 'post'> = { projectId, title }`.
 */
export type Body<Path extends keyof paths, Method extends keyof paths[Path]> = paths[Path][Method] extends {
  requestBody?: { content: { 'application/json': infer Json } };
}
  ? Json
  : never;

export type Role = 'admin';

/** What the auth setup stores per role. `password` only for accounts the setup created. */
export type AuthState = { token: string; email?: string; password?: string };

export const authFile = (role: Role): string => path.join(__dirname, '../../.auth', `${role}.json`);

export function readAuthState(role: Role): AuthState | undefined {
  const file = authFile(role);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as AuthState) : undefined;
}

/**
 * A client for a role; without a role, a client with no token.
 * Fixtures below cover tests. Use this directly in `beforeAll` / `afterAll`, where only `request` exists.
 */
export function clientFor(request: APIRequestContext, role?: Role): BaseClient {
  if (!role) return new BaseClient(request);
  const token = readAuthState(role)?.token;
  if (!token) {
    throw new Error(
      `No saved login for "${role}" (.auth/${role}.json). Run \`npx playwright test --project=setup\` and read its message.`,
    );
  }
  return new BaseClient(request, token);
}

type ApiFixtures = {
  /** No token: endpoints without login and 401 checks. */
  api: BaseClient;
  adminApi: BaseClient;
};

export const test = base.extend<ApiFixtures>({
  api: async ({ request }, use) => use(clientFor(request)),
  adminApi: async ({ request }, use) => use(clientFor(request, 'admin')),
});
