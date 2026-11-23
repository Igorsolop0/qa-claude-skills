import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../step';

/** `#/tickets`: the ticket list, the first page after login or registration. */
export class TicketsPage {
  static readonly path = '#/tickets';

  constructor(readonly page: Page) {}

  get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Tickets', exact: true });
  }

  /** The list is on screen: after a step that lands here (registration, login). */
  @step
  async expectOpen(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${TicketsPage.path}$`));
    await expect(this.heading).toBeVisible();
  }
}
