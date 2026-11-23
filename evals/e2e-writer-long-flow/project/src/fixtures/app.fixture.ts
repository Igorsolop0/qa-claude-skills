import { type App, createApp } from '../ui/app';
import { test as apiTest } from './api.fixture';

type AppFixtures = {
  /** The page objects on the test's `page`, as a visitor who is not signed in. */
  app: App;
};

export const test = apiTest.extend<AppFixtures>({
  app: async ({ page }, use) => {
    await use(createApp(page));
  },
});
