# Optional layers

The default suite is deliberately flat: one base client, role fixtures, specs that call
`client.send(method, path)`. That is enough for the first dozens of tests and it is what a
person who does not write code can still read.

The layers below are for a suite that has outgrown it. Add one only when its trigger is true,
or when the project already has it. **A layer that exists in the project wins over the default
here**; record its shape in `CLAUDE.md` under "Test conventions" so the next spec repeats it.

| Layer | Add it when | Not before |
|---|---|---|
| Domain clients + facade | the same path is typed in a third spec, or paths carry a prefix that will change | the first spec of a domain |
| Builders | a request body has more than three fields, or is built in a second spec | bodies of one to three fields |
| Envelope helpers | the product wraps answers in an envelope, or errors are not plain status + code | a product with plain JSON |
| Diagnostic attachments | red runs are read in CI by people who cannot rerun | local-only suites |
| Hand-written schemas | there is no API description, or it is wrong for this endpoint | a description that is accurate |

## Domain clients and a facade

```ts
// src/api/tickets.client.ts
export class TicketsClient extends BaseClient {
  get(id: number) {
    return this.send('GET', `tickets/${id}`);
  }
  create(data: Body<'/tickets', 'post'>) {
    return this.send('POST', 'tickets', { data });
  }
}

// src/api/api.ts — one property per domain client; this is what a role fixture returns
export class Api {
  readonly tickets: TicketsClient;

  constructor(request: APIRequestContext, token?: string) {
    this.tickets = new TicketsClient(request, token);
  }
}
```

- A client sends requests and returns the response. No assertions, no retries, no status checks,
  no logging of headers: the test owns every status code.
- Paths are copied from the API description, never from the product's source.
- A client never reads credentials. Auth is attached where the request context is built
  (the fixture or the base client), once.
- A path prefix that may change (`/v2`, a tenant id, a gateway route) lives in one constant.

## Builders

```ts
// src/data/create-ticket.builder.ts
export class CreateTicketBuilder {
  private body: Body<'/tickets', 'post'>;

  constructor(projectId: number) {
    // The default is a valid body. Unique, prefixed names keep runs apart and leftovers findable.
    this.body = { projectId, title: unique('ticket'), priority: 'medium' };
  }

  withPriority(priority: Schemas['Ticket']['priority']): this {
    this.body.priority = priority;
    return this;
  }

  build(): Body<'/tickets', 'post'> {
    return structuredClone(this.body);
  }
}
```

- The default constructor produces a body the API accepts.
- `with*` returns `this`; `build()` returns a copy.
- Named after the operation: `CreateTicketBuilder`.
- Values with business meaning (role, status, currency, amount) are explicit, never random.
- On a shared environment prefer inactive or draft defaults, so a leftover never reaches a real user.

## Envelopes: know the shape before asserting

Some products answer every call, failures included, in a wrapper:

```json
{ "ResponseCode": "InvalidPassword", "Description": "...", "ResponseObject": null }
```

A business failure can then arrive as **HTTP 200**. A test that asserts only the status is green
while the product refuses the request.

- Find out in the probe (step 3) which shape each service uses, and record it in the profile:
  "service X: envelope, success code `Success`; service Y: plain JSON, errors are RFC 7807 with
  the machine code in `title`".
- Assert both: the HTTP status, then the exact success or error code inside the envelope.
- One helper per shape that throws when the body is not that shape
  (`asEnvelope(response)`, `asProblemDetails(response)`), so an HTML page or an empty body fails
  loudly instead of reading `undefined`.
- Assert the one success value the endpoint returns, not a list of acceptable ones.

A related false pass: a host that answers **200 with an HTML page** for every path (a single-page
app, a login gate in front of the API). Check the content type in the probe. If you see it,
write it into the profile as "not an API base".

## Diagnostic attachments

`expect()` throws; an attachment placed after it never runs. Attach first, redact first.

```ts
const response = await adminApi.send('GET', `tickets/${ticket.id}`);
await test.info().attach('GET ticket', { body: redact(await response.text()), contentType: 'application/json' });

expect(response.status()).toBe(200);
```

`redact()` masks values of keys such as `token`, `accessToken`, `refreshToken`, `password`,
`apiKey`, `authorization`. Never attach request headers.

## When the API description is wrong or missing

- **Endpoint absent from the description:** say so. Write the schema by hand from one real
  response, mark it "observed, not documented", and ask the user to confirm it.
- **Type present but wrong** (a field that is never null marked nullable, a missing field):
  narrow the generated type instead of rewriting it, comment what the description gets wrong,
  and report it as a description defect.

```ts
type Ticket = Omit<Schemas['Ticket'], 'assigneeId'> & { assigneeId: number };   // description says nullable; it never is
```

- A project that already validates with a schema library (Zod and similar) keeps it. Use
  `unknown` for fields not asserted yet, never `any`; a string instead of an enum for values
  that change without notice.

## Access rules

Where the product has more than one way in (a public gateway, an internal host, an admin
surface), the profile states which one tests may use. Never switch to another host, another
auth scheme or a browser session to get past a 401 or 403: those are configuration errors, not
flakes. Do not retry them and do not widen an assertion to accept them. Report what is missing.

## File naming for these layers

`<subject>.<role>.ts`, kebab-case inside a segment: `tickets.client.ts`,
`create-ticket.builder.ts`, `ticket.schema.ts`, `<verb>-<resource>.spec.ts`. A client is not a
`controller`: a controller receives requests, these send them. No `*.page.ts` or
`*.component.ts` for API code.
