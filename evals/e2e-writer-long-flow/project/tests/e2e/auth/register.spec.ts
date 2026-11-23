import { Tag } from '@/config/tags';
import { test } from '@/fixtures';
import { REGISTER_COPY } from '@/ui/pages/register.page';
import { newAccount } from '@test-data/accounts';

test('Visitor creates a workspace and lands on the ticket list, signed in', { tag: [Tag.smoke, Tag.auth] }, async ({ app }) => {
  const account = newAccount();

  await test.step('Visitor opens the registration page', async () => {
    await app.registerPage.open();
  });

  await test.step('Visitor fills in name, email and password and creates the workspace', async () => {
    await app.registerPage.createWorkspace(account);
  });

  await test.step('The ticket list opens with the visitor signed in as admin', async () => {
    await app.ticketsPage.expectOpen();
    await app.siteHeader.expectSignedInAs(account.name, 'admin');
  });
});

test('Visitor cannot create a workspace with an email that is already registered', { tag: [Tag.auth] }, async ({ app, registeredUser }) => {
  await test.step('Visitor opens the registration page', async () => {
    await app.registerPage.open();
  });

  await test.step('Visitor submits the form with an email that is already registered', async () => {
    await app.registerPage.createWorkspace({ ...newAccount(), email: registeredUser.credentials.email });
  });

  await test.step('The form shows the error and stays on the registration page', async () => {
    await app.registerPage.expectFormError(REGISTER_COPY.takenEmail);
  });
});
