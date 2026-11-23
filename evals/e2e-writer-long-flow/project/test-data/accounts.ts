import { unique } from '@/utils/unique';

/** What the registration form and `POST /auth/register` take. */
export interface NewAccount {
  name: string;
  email: string;
  password: string;
}

/** A new account nobody has registered yet; `unique()` gives it the `qa-pw-` mark. */
export function newAccount(): NewAccount {
  const id = unique('account');
  return { name: unique('name'), email: `${id}@example.com`, password: `Pw-${id}` };
}
