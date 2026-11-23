/** Address of a page in the web app. Absolute, so the API `baseURL` of the project stays untouched. */
export function webUrl(path = ''): string {
  const base = (process.env.WEB_URL || process.env.BASE_URL || '').replace(/\/*$/, '/');
  if (!base || base === '/') throw new Error('Missing in .env: BASE_URL (and WEB_URL when the web app has another address).');
  return new URL(path.replace(/^\//, ''), base).toString();
}
