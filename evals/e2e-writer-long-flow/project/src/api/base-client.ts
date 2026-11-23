import type { APIRequestContext, APIResponse } from '@playwright/test';

type RequestOptions = Parameters<APIRequestContext['fetch']>[1];

export class BaseClient {
  constructor(
    protected readonly request: APIRequestContext,
    private readonly token?: string,
  ) {}

  send(method: string, url: string, options: RequestOptions = {}): Promise<APIResponse> {
    // A leading slash would drop the path part of BASE_URL.
    return this.request.fetch(url.replace(/^\//, ''), {
      ...options,
      method,
      failOnStatusCode: false,
      headers: {
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...options.headers,
      },
    });
  }
}
