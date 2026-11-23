import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { parse } from 'yaml';

dotenv.config({ quiet: true });

const source = process.env.OPENAPI_SOURCE;
if (!source) {
  console.error('OPENAPI_SOURCE is not set. Put the Swagger/OpenAPI link or file path in .env.');
  process.exit(1);
}

// 1. Types for the editor and the type check.
execFileSync('npx', ['openapi-typescript', source, '-o', 'src/types/api.d.ts'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

// 2. The same schemas as data, for `toMatchSchema` at run time.
let text;
if (/^https?:\/\//.test(source)) {
  const response = await fetch(source);
  if (!response.ok) {
    console.error(`Could not read ${source}: ${response.status}`);
    process.exit(1);
  }
  text = await response.text();
} else {
  text = fs.readFileSync(source, 'utf8');
}
const schemas = parse(text).components?.schemas ?? {};
fs.writeFileSync(
  'src/types/api-schemas.json',
  `${JSON.stringify({ components: { schemas } }, null, 2)}\n`,
);
console.log(`${Object.keys(schemas).length} schemas → src/types/api-schemas.json`);
