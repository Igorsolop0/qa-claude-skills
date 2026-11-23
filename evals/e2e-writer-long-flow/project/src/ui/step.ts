import { test } from '@playwright/test';

/** `openSignInFromHeader` → `open sign in from header`. */
function words(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
}

/**
 * Reports a page object method as a step named after the class and the method
 * (`RegisterPage: register`), so the report and the trace read as user actions.
 * The title never holds the arguments: they can be passwords. `box` points a failure at the line in
 * the spec that called the method. For async methods only; a getter or a locator factory stays plain.
 */
export function step<This extends object, Args extends unknown[], Result>(
  method: (this: This, ...args: Args) => Promise<Result>,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Promise<Result>>,
): (this: This, ...args: Args) => Promise<Result> {
  const name = words(String(context.name));
  return function (this: This, ...args: Args): Promise<Result> {
    return test.step(`${this.constructor.name}: ${name}`, () => method.call(this, ...args), { box: true });
  };
}
