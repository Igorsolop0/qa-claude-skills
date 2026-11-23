import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import type { components } from '../types/api';
import apiSchemas from '../types/api-schemas.json';

/** Every schema named in the API description. Regenerate with `npm run types:api`. */
export type SchemaName = keyof components['schemas'];

// strict: false, because OpenAPI adds keywords plain JSON Schema does not know.
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(apiSchemas, 'api');

const compiled = new Map<string, ValidateFunction>();

function validator(schema: SchemaName | object, list: boolean): ValidateFunction {
  const item = typeof schema === 'string' ? { $ref: `api#/components/schemas/${schema}` } : schema;
  const key = `${list}:${JSON.stringify(item)}`;
  let validate = compiled.get(key);
  if (!validate) {
    validate = ajv.compile(list ? { type: 'array', items: item } : item);
    compiled.set(key, validate);
  }
  return validate;
}

function check(received: unknown, schema: SchemaName | object, list: boolean) {
  const validate = validator(schema, list);
  const pass = validate(received) === true;
  const name = typeof schema === 'string' ? schema : 'the schema';
  const problems = (validate.errors ?? [])
    .map((error) => `  ${error.instancePath || '(body)'} ${error.message ?? ''}`)
    .join('\n');

  return {
    pass,
    message: () =>
      pass
        ? `Expected the body not to match ${name}, but it does.`
        : `The body does not match ${name}${list ? '[]' : ''}:\n${problems}\n\nReceived: ${JSON.stringify(received, null, 2)}`,
  };
}

/** `expect(body).toMatchSchema('Ticket')` — a schema name from the API description, or a schema object. */
export function toMatchSchema(received: unknown, schema: SchemaName | object) {
  return check(received, schema, false);
}

/** `expect(body).toMatchArrayOf('Ticket')` — the body is a list and every item matches. */
export function toMatchArrayOf(received: unknown, schema: SchemaName | object) {
  return check(received, schema, true);
}
