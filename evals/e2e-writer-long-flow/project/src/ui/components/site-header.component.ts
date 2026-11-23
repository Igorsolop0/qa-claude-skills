import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../step';

/** The bar on top of every page after login: logo, main menu, the signed-in user, `Log out`. */
export class SiteHeader {
  constructor(readonly page: Page) {}

  get root(): Locator {
    return this.page.getByRole('banner');
  }

  get logOutButton(): Locator {
    return this.root.getByRole('button', { name: 'Log out', exact: true });
  }

  /** The user's name: a plain `span` with no role or label, so it is found by its test id (finding reported). */
  get userName(): Locator {
    return this.root.getByTestId('current-user-name');
  }

  get userRole(): Locator {
    return this.root.getByTestId('current-user-role');
  }

  @step
  async expectSignedInAs(name: string, role: string): Promise<void> {
    await expect(this.logOutButton).toBeVisible();
    await expect(this.userName).toHaveText(name);
    await expect(this.userRole).toHaveText(role);
  }
}
