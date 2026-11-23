import { Tag } from '@/config/tags';
import { type Body, expect, type Schemas, test, unique } from '@/fixtures';

const validPassword = 'Passw0rd!123';

test('201: registers an admin and returns token and user', { tag: [Tag.smoke, Tag.auth] }, async ({ api }) => {
  const data: Body<'/auth/register', 'post'> = {
    email: `${unique('user')}@example.com`,
    password: validPassword,
    name: unique('name'),
  };

  const response = await api.send('POST', '/auth/register', { data });

  expect(response.status()).toBe(201);
  const body: Schemas['AuthResponse'] = await response.json();
  expect(body).toMatchSchema('AuthResponse');
  expect(body.token).not.toBe('');
  expect(body.user.email).toBe(data.email);
  expect(body.user.name).toBe(data.name);
  expect(body.user.role).toBe('admin');
});

test('422: email is missing', { tag: [Tag.auth] }, async ({ api }) => {
  const response = await api.send('POST', '/auth/register', {
    data: { password: validPassword, name: unique('name') },
  });

  expect(response.status()).toBe(422);
  const body: Schemas['Error'] = await response.json();
  expect(body).toMatchSchema('Error');
  expect(body.code).toBe('VALIDATION_ERROR');
});

test('422: password is missing', { tag: [Tag.auth] }, async ({ api }) => {
  const response = await api.send('POST', '/auth/register', {
    data: { email: `${unique('user')}@example.com`, name: unique('name') },
  });

  expect(response.status()).toBe(422);
  const body: Schemas['Error'] = await response.json();
  expect(body).toMatchSchema('Error');
  expect(body.code).toBe('VALIDATION_ERROR');
});

test('422: email is not a valid address', { tag: [Tag.auth] }, async ({ api }) => {
  const data: Body<'/auth/register', 'post'> = { email: 'not-an-email', password: validPassword, name: unique('name') };

  const response = await api.send('POST', '/auth/register', { data });

  expect(response.status()).toBe(422);
  const body: Schemas['Error'] = await response.json();
  expect(body).toMatchSchema('Error');
  expect(body.code).toBe('VALIDATION_ERROR');
  expect(body.details?.map((detail) => detail.path)).toContain('/email');
});

test('422: password is shorter than 8 characters', { tag: [Tag.auth] }, async ({ api }) => {
  const data: Body<'/auth/register', 'post'> = {
    email: `${unique('user')}@example.com`,
    password: 'Short12',
    name: unique('name'),
  };

  const response = await api.send('POST', '/auth/register', { data });

  expect(response.status()).toBe(422);
  const body: Schemas['Error'] = await response.json();
  expect(body).toMatchSchema('Error');
  expect(body.code).toBe('VALIDATION_ERROR');
  expect(body.details?.map((detail) => detail.path)).toContain('/password');
});

test('409: email is already registered', { tag: [Tag.auth] }, async ({ api, registeredUser }) => {
  const response = await api.send('POST', '/auth/register', { data: registeredUser.credentials });

  expect(response.status()).toBe(409);
  const body: Schemas['Error'] = await response.json();
  expect(body).toMatchSchema('Error');
  expect(body.code).toBe('EMAIL_TAKEN');
});
