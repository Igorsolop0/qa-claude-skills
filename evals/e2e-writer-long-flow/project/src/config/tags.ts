/**
 * Every tag a test may carry: `tag: [Tag.smoke, Tag.auth]`, never a raw `'@…'` string. Add a new tag here
 * first. Regression is every test, so there is no regression tag: a run without `--grep` is the regression run.
 */
export const Tag = {
  smoke: '@smoke',
  auth: '@auth',
} as const;
