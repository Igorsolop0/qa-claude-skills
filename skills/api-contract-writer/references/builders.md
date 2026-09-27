# API Contract Writer — Builders & Zod Schemas

## When to use a Builder vs inline object

| Payload fields | Approach |
|---|---|
| ≤ 3 fields | Inline object in the client call or test |
| > 3 fields | Builder in `test-data/<target>/<domain>/<name>.builder.ts` |
| Used in multiple spec files | Always a Builder |

## Builder template

```typescript
// qa/test-data/backoffice/template-bonus/create-template-bonus.builder.ts
import type { CreateTemplateBonusRequest } from "../../../src/api/backoffice/template-bonus.types";

export const QA_PREFIX = "qa-pw-";

export class CreateTemplateBonusBuilder {
  private payload: CreateTemplateBonusRequest;

  constructor() {
    // Default: a valid payload that passes backend validation.
    // Unique, prefixed values keep parallel runs apart and make leftovers findable.
    this.payload = {
      name: `${QA_PREFIX}${crypto.randomUUID()}`,
      isActive: false,
      // …remaining required fields, copied from the contract
    } as CreateTemplateBonusRequest;
  }

  withName(name: string): this {
    this.payload.name = name;
    return this;
  }

  withIsActive(isActive: boolean): this {
    this.payload.isActive = isActive;
    return this;
  }

  build(): CreateTemplateBonusRequest {
    return structuredClone(this.payload);
  }
}
```

Field names above are illustrative. Copy real names and required fields from the contract.

**Rules**
- The default constructor produces a **valid** payload.
- Unique values use `crypto.randomUUID()` with the `qa-pw-` prefix. Never static names like `"Test Bonus"`.
- Prefer inactive/disabled defaults for Backoffice entities so a leftover never reaches real players.
- `with*` methods return `this`. `build()` returns a copy.
- Name the Builder after the operation: `CreateTemplateBonusBuilder`, `RegisterPlayerBuilder`.
- Money, currency, and partner fields are explicit values, never random.

## Zod schema template — bare JSON (the newer services)

```typescript
// qa/test-data/client/bonus/schemas/active-bonus.schema.ts
import { z } from "zod";

const IsoDateTime = z.iso.datetime({ offset: true });

export const ActiveBonusSchema = z.object({
  bonusId: z.number().int(),
  name: z.string(),
  status: z.string(),             // z.enum([...]) only when the contract is stable
  expiresAt: IsoDateTime.nullable(),
  wager: z.unknown(),             // not asserted yet
});

export type ActiveBonus = z.infer<typeof ActiveBonusSchema>;
```

## Zod schema template — the legacy envelope service envelope

```typescript
import { z } from "zod";

export function domainApiResponse<T extends z.ZodTypeAny>(responseObject: T) {
  return z.object({
    ResponseCode: z.union([z.string(), z.number()]).nullable(),
    Description: z.string().nullable().optional(),
    InterruptionCode: z.string().nullable().optional(),
    ResponseObject: responseObject,
  });
}

export const LoginEnvelopeSchema = domainApiResponse(
  z.object({ /* ResponseObject fields from the contract */ }),
);
```

Put `domainApiResponse()` in `test-data/client/common/schemas/domain-api-response.schema.ts` once
and reuse it.

## Zod schema — ProblemDetails

```typescript
export const ProblemDetailsSchema = z.object({
  type: z.string().optional(),
  title: z.string(),
  status: z.number().int().optional(),
  detail: z.string().nullable().optional(),
});
```

**Rules for schemas**
- Use `z.unknown()` for fields you do not assert yet; never `z.any()`.
- Use `z.string()` instead of `z.enum([...])` for values that can change without notice.
- Date formats come from the live response: check one before choosing a validator.
- Export the top-level schema and any narrowed picks you need.
- Zod 4 API: `z.iso.datetime()`, `z.uuid()`, `z.email()`.

## Using `toMatchSchema`

`src/api/core/schema.matcher.ts` extends Playwright `expect`; `src/fixtures/api.fixture.ts`
re-exports that `expect`. Import both `test` and `expect` from the fixture file.

```typescript
// qa/src/api/core/schema.matcher.ts
import { expect as baseExpect } from "@playwright/test";
import { type ZodType, z } from "zod";

export const expect = baseExpect.extend({
  toMatchSchema(received: unknown, schema: ZodType) {
    const result = schema.safeParse(received);
    return {
      pass: result.success,
      name: "toMatchSchema",
      message: () =>
        result.success
          ? "Expected the body not to match the schema"
          : `Schema mismatch:\n${z.prettifyError(result.error)}`,
    };
  },
});
```

```typescript
expect(response.status, "failed to create template bonus").toBe(200);
expect(response.body).toMatchSchema(TemplateBonusSchema);
```
