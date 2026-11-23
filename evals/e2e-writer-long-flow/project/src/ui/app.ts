import type { Page } from '@playwright/test';
import { SiteHeader } from './components/site-header.component';
import { RegisterPage } from './pages/register.page';
import { TicketsPage } from './pages/tickets.page';

/**
 * The page objects of one browser page. A container only: it holds no steps or checks of its own, and
 * every member is the page object class in camelCase (`RegisterPage` is `app.registerPage`). Members are
 * created on first use and reused for the rest of the test. A new page object gets its getter here.
 *
 * Specs take it from the `app` fixture; `createApp` is for fixtures.
 */
export class App {
  readonly #members = new Map<string, unknown>();

  constructor(readonly page: Page) {}

  get registerPage(): RegisterPage {
    return this.#member('registerPage', () => new RegisterPage(this.page));
  }

  get siteHeader(): SiteHeader {
    return this.#member('siteHeader', () => new SiteHeader(this.page));
  }

  get ticketsPage(): TicketsPage {
    return this.#member('ticketsPage', () => new TicketsPage(this.page));
  }

  #member<T>(name: string, create: () => T): T {
    if (!this.#members.has(name)) this.#members.set(name, create());
    return this.#members.get(name) as T;
  }
}

/** The page objects of `page`. Fixtures only: specs take `app`, `<role>App` or `shared<Role>App`. */
export function createApp(page: Page): App {
  return new App(page);
}
