#!/usr/bin/env bun
/// <reference types="bun-types" />
/**
 * Single-line mutation runner for the pw-test-review mutation check.
 *
 * bun <skill-dir>/scripts/mutate.ts \
 *   --file <path to mutate> --line <n> --old '<text>' --new '<text>' \
 *   --spec <spec to run> --project <project> --grep '<tag or unique title>' --out <run id> \
 *   [--cmd 'npx playwright test'] [--env NAME=VALUE]... [--protect <path prefix>]...
 *
 * Run from the folder that holds `playwright.config.ts`, with a shell-tool timeout longer than the
 * project's test timeout plus setup. Paths are relative to that folder. `--file` may be the spec or a
 * Page Object/helper; never `.claude/`, `.env*`, `node_modules/`, `.git/`, or a `--protect` prefix (pass
 * the fixtures that create data or set auth, and the config). `--spec` is always the one spec to run,
 * and `--grep` (taken literally) must select exactly one test in `--project`. `--new ''` deletes
 * `--old`. `--cmd` is the project's Playwright command; `--env` turns reporting off for the run
 * (for example `--env TESTOMATIO=`).
 *
 * Before mutating, the original bytes are saved to `test-results/mut-<id>/original.<name>` and the
 * mutated bytes to `mutated.<name>` next to it, so a hard-killed run can be restored safely by hand.
 * The file is restored in a `finally` block and on SIGINT/SIGTERM/SIGHUP, and only when it still
 * holds the mutated bytes, so a concurrent edit is never overwritten. Never git checkout.
 *
 * Prints one `RESULT:` line — PASSED (candidate survivor), FAILED (read the error: clean or weak
 * kill), SKIPPED, or INVALID (the run cannot prove that the target test ran) — then RESTORED or RESTORE-FAILED.
 * Exit codes: 0 result printed, 2 NOOP or refused (selection, reused --out, leftover mutation),
 * 3 restore failed, 64 usage.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values: a } = parseArgs({
  options: {
    file: { type: "string" },
    line: { type: "string" },
    old: { type: "string" },
    new: { type: "string" },
    spec: { type: "string" },
    project: { type: "string" },
    grep: { type: "string" },
    out: { type: "string" },
    cmd: { type: "string", default: "npx playwright test" },
    env: { type: "string", multiple: true, default: [] },
    protect: { type: "string", multiple: true, default: [] },
  },
});

function usage(message: string): never {
  console.error(message);
  process.exit(64);
}

for (const key of ["file", "line", "old", "new", "spec", "project", "grep", "out"] as const) {
  if (a[key] === undefined) usage(`missing --${key}`);
}
const filePath = a.file as string;
const specPath = a.spec as string;
const project = a.project as string;
const grepText = a.grep as string;
const command = (a.cmd as string).split(/\s+/).filter(Boolean);
const protectedPrefixes = (a.protect as string[]).map((prefix) => normalize(prefix).replace(/\/$/, ""));
const runId = a.out as string;
const oldText = a.old as string;
const newText = a.new as string;
const lineNumber = Number(a.line);

const PROTECTED_PARTS = new Set([".claude", "node_modules", ".git"]);

/** A path in the test folder that the mutation check may touch: test code, not fixtures, config or secrets. */
function checkMutablePath(path: string): string | null {
  const normal = normalize(path);
  if (isAbsolute(path) || normal.startsWith("..") || normal.split("/").includes("..")) {
    return "must be relative to the test folder";
  }
  if (normal.split("/").some((part) => PROTECTED_PARTS.has(part) || part.startsWith(".env"))) return "is a protected path";
  if (protectedPrefixes.some((prefix) => normal === prefix || normal.startsWith(`${prefix}/`))) {
    return "is protected by --protect";
  }
  if (!/\.(ts|tsx|js|mjs)$/.test(normal)) return "must be a source file";
  return null;
}

const fileProblem = checkMutablePath(filePath);
if (fileProblem) usage(`--file ${fileProblem}: ${filePath}`);
if (checkMutablePath(specPath) || !/\.(spec|test)\.(ts|js|mjs)$/.test(normalize(specPath))) {
  usage(`--spec must be one *.spec.ts or *.test.ts file: ${specPath}`);
}
if (!/^[a-z0-9][a-z0-9-]{0,40}$/i.test(runId)) usage("--out must be a short id of letters, digits and dashes");
if (grepText.trim() === "") usage("--grep must not be empty");
if (command.length === 0) usage("--cmd must not be empty");
if (!/^[\w.:-]+$/.test(project)) usage(`--project is not a project name: ${project}`);
const extraEnv: Record<string, string> = {};
for (const pair of a.env as string[]) {
  const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s.exec(pair);
  if (!match) usage(`--env must be NAME=VALUE: ${pair}`);
  extraEnv[match[1] as string] = match[2] as string;
}
if (!Number.isInteger(lineNumber) || lineNumber < 1) usage("--line must be a positive integer");
if (oldText === "") usage("--old must not be empty");
if (!existsSync(filePath)) usage(`--file not found: ${filePath}`);
// Bun.file and Bun.write follow symlinks, so the guards must hold for the real path, not only the argument.
const targetPath = relative(process.cwd(), realpathSync(filePath));
const realProblem = checkMutablePath(targetPath);
if (realProblem) usage(`--file resolves to ${targetPath}, which ${realProblem}`);

const runDir = join("test-results", `mut-${runId}`);
const reportFile = resolve(runDir, "report.json");
const logFile = join(runDir, "run.log");
const backupFile = join(runDir, `original.${basename(filePath)}`);
const mutatedFile = join(runDir, `mutated.${basename(filePath)}`);
const targetFile = join(runDir, "target");

// One run per target file, whatever --out says: without it, a second run could read the first run's
// mutation as its "original" and later "restore" that mutation. The lock is a file created with `wx`
// (fails if it exists) and is removed on exit, unless the restore failed. A hard kill leaves it behind.
const lockDir = join("test-results", "mutate-locks");
const lockFile = join(lockDir, `${createHash("sha256").update(targetPath).digest("hex").slice(0, 16)}.lock`);
mkdirSync(lockDir, { recursive: true });
try {
  writeFileSync(lockFile, `${targetPath}\n${runDir}\npid ${process.pid}\n`, { flag: "wx" });
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  console.log(`REFUSED: another run holds ${lockFile} for ${targetPath}:\n${readFileSync(lockFile, "utf8").trim()}`);
  console.log("If that run is gone (hard kill), restore the file as SKILL.md says, then delete the lock.");
  process.exit(2);
}
let keepLock = false;
process.on("exit", () => {
  if (!keepLock) rmSync(lockFile, { force: true });
});

// A run left mutated by a hard kill: same target path, and the file still holds that run's mutation.
// Reading it now as the "original" would make the restore write the mutation back and call it done.
const current = await Bun.file(filePath).bytes();
const leftovers = existsSync("test-results") ? readdirSync("test-results").filter((dir) => dir.startsWith("mut-")) : [];
for (const dir of leftovers) {
  const meta = join("test-results", dir, "target");
  const copy = join("test-results", dir, `mutated.${basename(filePath)}`);
  if (!existsSync(meta) || !existsSync(copy) || readFileSync(meta, "utf8") !== targetPath) continue;
  if (Buffer.from(current).equals(readFileSync(copy))) {
    console.log(`REFUSED: ${filePath} still holds the mutation of ${dir}; restore it from that run's original first`);
    process.exit(2);
  }
}

// Atomic and not recursive: an existing run directory fails, so a reused --out never overwrites a backup.
mkdirSync("test-results", { recursive: true });
try {
  mkdirSync(runDir);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  console.log(`REFUSED: ${runDir} already exists; pick a new --out (it holds that run's backup)`);
  process.exit(2);
}
await Bun.write(targetFile, targetPath);

const env = { ...process.env, ...extraEnv };
// Playwright reads -g as a regex; escape it so --grep matches its text literally.
const grep = grepText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Refuse unless --grep selects exactly one test of this project (setup projects are listed separately).
const listed = Bun.spawnSync([...command, specPath, "-g", grep, `--project=${project}`, "--list"], {
  env,
  stdout: "pipe",
  stderr: "pipe",
});
const listedTests = listed.stdout
  .toString()
  .split("\n")
  .filter((row) => row.includes(`[${project}] `));
if (listed.exitCode !== 0 || listedTests.length !== 1) {
  console.log(`NOOP: --grep selects ${listedTests.length} tests in ${project}, expected exactly 1`);
  console.log(listed.stderr.toString().split("\n").slice(-5).join("\n"));
  process.exit(2);
}

const original = await Bun.file(filePath).bytes();
const lines = new TextDecoder().decode(original).split("\n");
const target = lines[lineNumber - 1];
const first = target === undefined ? -1 : target.indexOf(oldText);
if (target === undefined || first === -1 || target.indexOf(oldText, first + 1) !== -1) {
  console.log(`NOOP: line ${lineNumber} does not contain --old exactly once: ${JSON.stringify(target?.trim())}`);
  process.exit(2);
}
// Slice, not String.replace: `$&`, `$$` and friends in --new must stay literal.
lines[lineNumber - 1] = target.slice(0, first) + newText + target.slice(first + oldText.length);
const mutated = new TextEncoder().encode(lines.join("\n"));
console.log(`BEFORE ${lineNumber}: ${target.trim()}`);
console.log(`AFTER  ${lineNumber}: ${lines[lineNumber - 1].trim()}`);

await Bun.write(backupFile, original);
await Bun.write(mutatedFile, mutated);
console.log(`BACKUP ${backupFile}`);
console.log(`MUTATED ${mutatedFile}`);

const sameBytes = (left: Uint8Array, right: Uint8Array) => Buffer.from(left).equals(Buffer.from(right));
let restored = false;
let restoring: Promise<boolean> | undefined;
/** One restore per run: a signal handler and `finally` share the same promise instead of racing. */
const restore = (): Promise<boolean> => {
  // A failed restore keeps the lock: the file may still be mutated, so no new run may start on it.
  restoring ??= restoreOnce().then((ok) => {
    if (!ok) keepLock = true;
    return ok;
  });
  return restoring;
};

/** Writes the original back only if the file still holds our mutation. Returns false on any doubt. */
async function restoreOnce(): Promise<boolean> {
  try {
    const current = await Bun.file(filePath).bytes();
    if (sameBytes(current, original)) {
      restored = true;
    } else if (sameBytes(current, mutated)) {
      await Bun.write(filePath, original);
      restored = sameBytes(await Bun.file(filePath).bytes(), original);
    } else {
      console.log(`RESTORE-FAILED: ${filePath} changed during the run; not overwriting it`);
      return false;
    }
  } catch (error) {
    console.log(`RESTORE-FAILED: ${(error as Error).message}`);
    return false;
  }
  if (!restored) console.log("RESTORE-FAILED: the written bytes do not match the original");
  // Restored: the mutated copy is no longer a hard-kill leftover, so later runs must not match it.
  if (restored) rmSync(mutatedFile, { force: true });
  return restored;
}

let child: { kill(signal?: NodeJS.Signals): void } | undefined;
for (const [signal, code] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
  ["SIGHUP", 129],
] as const) {
  process.on(signal, async () => {
    child?.kill(signal);
    const ok = await restore();
    console.log(ok ? `RESTORED (after ${signal})` : `RESTORE-FAILED — the original is in ${backupFile}`);
    process.exit(ok ? code : 3);
  });
}

interface JsonResult {
  status: string;
  errors?: { message?: string; location?: { file: string; line: number } }[];
}
interface JsonSpec {
  title: string;
  tags?: string[];
  tests: { projectName: string; results: JsonResult[] }[];
}
interface JsonSuite {
  specs?: JsonSpec[];
  suites?: JsonSuite[];
}

interface JsonReport {
  suites?: JsonSuite[];
  errors?: { message?: string }[];
}

/** The JSON report, or undefined when it is missing, truncated, or not the shape Playwright writes. */
async function readReport(): Promise<JsonReport | undefined> {
  if (!existsSync(reportFile)) return undefined;
  let parsed: unknown;
  try {
    parsed = await Bun.file(reportFile).json();
  } catch {
    return undefined; // Truncated or empty JSON: the caller reports INVALID.
  }
  if (!isRecord(parsed)) return undefined;
  const { suites, errors } = parsed;
  if (!optionalArrayOf(suites, isSuite) || !optionalArrayOf(errors, isRecord)) return undefined;
  return { suites, errors: errors as JsonReport["errors"] };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** True when `value` is absent, or an array whose every element passes `check`. */
function optionalArrayOf<T>(value: unknown, check: (item: unknown) => item is T): value is T[] | undefined {
  return value === undefined || (Array.isArray(value) && value.every(check));
}

function isResult(value: unknown): value is JsonResult {
  return isRecord(value) && typeof value.status === "string" && optionalArrayOf(value.errors, isRecord);
}

function isSpec(value: unknown): value is JsonSpec {
  if (!isRecord(value) || typeof value.title !== "string" || !Array.isArray(value.tests)) return false;
  return value.tests.every(
    (test) => isRecord(test) && typeof test.projectName === "string" && Array.isArray(test.results) && test.results.every(isResult),
  );
}

/** Checks the whole tree, so `findTarget()` never meets a `null` suite or a spec without `tests`. */
function isSuite(value: unknown): value is JsonSuite {
  return isRecord(value) && optionalArrayOf(value.specs, isSpec) && optionalArrayOf(value.suites, isSuite);
}

function findTarget(suites: JsonSuite[] = []): JsonResult | undefined {
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) {
      if (!spec.title.includes(grepText) && !(spec.tags ?? []).some((tag) => `@${tag}` === grepText || tag === grepText)) {
        continue;
      }
      const run = spec.tests.find((test) => test.projectName === project);
      if (run) return run.results.at(-1);
    }
    const nested = findTarget(suite.suites);
    if (nested) return nested;
  }
  return undefined;
}

/** First lines of a Playwright error message, without ANSI colours. */
const excerpt = (message = "", count = 20) =>
  message
    .replace(/\u001b\[[0-9;]*m/g, "")
    .split("\n")
    .slice(0, count)
    .join("\n");

let exitCode = 0;
try {
  // A report left by an earlier run with the same --out must never be read as this run's result.
  rmSync(reportFile, { force: true });
  await Bun.write(filePath, mutated);
  const run = Bun.spawn(
    [
      ...command,
      specPath,
      "-g",
      grep,
      "--retries=0",
      `--project=${project}`,
      "--trace=off",
      "--reporter=list,json",
      `--output=${join(runDir, "pw")}`,
    ],
    { env: { ...env, PLAYWRIGHT_JSON_OUTPUT_FILE: reportFile }, stdout: "pipe", stderr: "pipe" },
  );
  child = run;
  const [stdout, stderr] = await Promise.all([new Response(run.stdout).text(), new Response(run.stderr).text()]);
  await run.exited;
  await Bun.write(logFile, `${stdout}\n--- stderr ---\n${stderr}`);

  const report = await readReport();
  const result = findTarget(report?.suites);
  if (!report || (report.errors?.length ?? 0) > 0 || !result) {
    console.log(
      "RESULT: INVALID (cannot prove the target test ran: compile error, setup failure, no match, or no readable report)",
    );
    for (const error of report?.errors ?? []) console.log(excerpt(error.message, 15));
  } else if (result.status === "passed") {
    console.log("RESULT: PASSED (candidate survivor)");
  } else if (result.status === "skipped") {
    console.log("RESULT: SKIPPED (no assertion ran; proves nothing)");
  } else {
    console.log(`RESULT: FAILED (${result.status}) — clean kill only if the error is the mutated assertion`);
    for (const error of result.errors ?? []) {
      const at = error.location ? `${error.location.file}:${error.location.line}` : "unknown location";
      console.log(`ERROR at ${at}\n${excerpt(error.message)}`);
    }
  }
  console.log(`LOG ${logFile}`);
} finally {
  const ok = await restore();
  console.log(ok ? "RESTORED" : `RESTORE-FAILED — the original is in ${backupFile}`);
  if (!ok) exitCode = 3;
}
process.exit(exitCode);
