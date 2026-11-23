import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { APIRequestContext, APIResponse } from '@playwright/test';
import { BaseClient } from '@/api/base-client';
import { type AuthState, authFile, expect, type Role, readAuthState, test as setup, unique } from '@/fixtures';

// ---- Adapt this block to the API description. Nothing below it is project-specific. ----
const LOGIN_PATH = '/auth/login';
/** Any cheap request that needs a token; used to check a saved session. */
const SESSION_CHECK_PATH = '/me';
const loginBody = (email: string, password: string) => ({ email, password });
const tokenFrom = (body: { token: string }): string => body.token;
// -----------------------------------------------------------------------------------------

// Roles can depend on each other, so the order matters.
setup.describe.configure({ mode: 'serial' });

function save(role: Role, state: AuthState): void {
  fs.mkdirSync(path.dirname(authFile(role)), { recursive: true });
  fs.writeFileSync(authFile(role), JSON.stringify(state, null, 2));
}

/** A saved token is reused while the API still accepts it: this keeps runs under the login limit. */
async function sessionWorks(request: APIRequestContext, state: AuthState | undefined): Promise<boolean> {
  if (!state?.token) return false;
  const response = await new BaseClient(request, state.token).send('GET', SESSION_CHECK_PATH);
  return response.status() === 200;
}

async function logIn(request: APIRequestContext, email: string, password: string): Promise<APIResponse> {
  const response = await new BaseClient(request).send('POST', LOGIN_PATH, { data: loginBody(email, password) });
  if (response.status() === 429) {
    const wait = response.headers()['retry-after'] ?? 'a few';
    throw new Error(`Login limit reached for ${email} (429). Wait ${wait} seconds and run again.`);
  }
  return response;
}

/**
 * A role without an account: it is created through the API once, and later runs reuse it. `creator` is
 * the role whose token makes the call; leave it out when anyone may register.
 */
async function useCreatedAccount(
  request: APIRequestContext,
  role: Role,
  create: (client: BaseClient, email: string, password: string) => Promise<APIResponse>,
  creator?: Role,
): Promise<void> {
  const saved = readAuthState(role);
  if (await sessionWorks(request, saved)) return;

  // The account from an earlier run may still exist: try its saved credentials first.
  if (saved?.email && saved.password) {
    const again = await logIn(request, saved.email, saved.password);
    if (again.status() === 200) {
      save(role, { ...saved, token: tokenFrom(await again.json()) });
      return;
    }
  }

  const creatorToken = creator ? readAuthState(creator)?.token : undefined;
  if (creator) {
    expect(creatorToken, `"${role}" is created by "${creator}": the ${creator} login must pass first`).toBeTruthy();
  }

  // `unique()` marks the account with `qa-pw-`, so it can be found on a shared environment.
  const email = `${unique(role)}@example.test`;
  const password = randomUUID();
  const created = await create(new BaseClient(request, creatorToken), email, password);
  expect(created.ok(), `Creating the ${role} account answered ${created.status()}: ${await created.text()}`).toBe(true);

  const response = await logIn(request, email, password);
  expect(response.status(), `${LOGIN_PATH} did not accept the ${role} account that was just created`).toBe(200);
  save(role, { token: tokenFrom(await response.json()), email, password });
}

// ---- One line per role, from the interview. ----

// Anyone may register, and registration creates an admin with a private workspace.
setup('admin: registers itself', async ({ request }) => {
  await useCreatedAccount(request, 'admin', (client, email, password) =>
    client.send('POST', '/auth/register', { data: { email, password, name: 'QA admin (autotests)' } }),
  );
});
