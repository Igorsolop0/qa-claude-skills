import { expect, type Locator, type Page } from '@playwright/test';
import type { NewAccount } from '@test-data/accounts';
import { webUrl } from '../../config/urls';
import { step } from '../step';

/** Copy the registration page shows. A spec may import it to assert against. */
export const REGISTER_COPY = {
  takenEmail: 'This email is already registered',
} as const;

/** `#/register`: a visitor creates a workspace and becomes its admin. */
export class RegisterPage {
  static readonly path = '#/register';

  constructor(readonly page: Page) {}

  get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Create a workspace', exact: true });
  }

  get nameInput(): Locator {
    return this.page.getByLabel('Your name', { exact: true });
  }

  get emailInput(): Locator {
    return this.page.getByLabel('Email', { exact: true });
  }

  get passwordInput(): Locator {
    return this.page.getByLabel('Password (8 characters or more)', { exact: true });
  }

  get createWorkspaceButton(): Locator {
    return this.page.getByRole('button', { name: 'Create workspace', exact: true });
  }

  /** The form error under the fields (`role="alert"`). */
  get formError(): Locator {
    return this.page.getByRole('alert');
  }

  /** Opens the page, checks the server answered, waits for the heading. */
  @step
  async open(): Promise<void> {
    const response = await this.page.goto(webUrl(RegisterPage.path));
    // `null` means only the part after `#` changed: no new document was loaded, so there is no status to check.
    expect(response === null || response.ok(), `${RegisterPage.path} answered ${response?.status()}`).toBe(true);
    await expect(this.heading).toBeVisible();
  }

  /** Fills in name, email and password and presses `Create workspace`. */
  @step
  async createWorkspace(account: NewAccount): Promise<void> {
    await this.nameInput.fill(account.name);
    await this.emailInput.fill(account.email);
    await this.passwordInput.fill(account.password);
    await this.createWorkspaceButton.click();
  }

  /** The form refused: the error is shown and the visitor is still on the registration page. */
  @step
  async expectFormError(message: string): Promise<void> {
    await expect(this.formError).toHaveText(message);
    await expect(this.heading).toBeVisible();
  }
}
