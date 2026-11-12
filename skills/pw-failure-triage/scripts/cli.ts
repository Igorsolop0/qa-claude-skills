/**
 * Collect the evidence for triaging a Playwright run: every failed or flaky test with its error,
 * failing step, locator, backend calls and signals, read from the JSON report and the kept traces.
 *
 *   bun <skill>/scripts/cli.ts [--report test-results/results.json] [--out test-results/triage] \
 *     [--backend-prefix /api/] [--ignore-path '^/(analytics|beacon)\b']
 *
 * Run it from the folder that holds `playwright.config.ts`. `--backend-prefix` is the path prefix of the
 * backend the tests call; `--ignore-path` is a regex for calls to drop (analytics beacons). Both come
 * from the project profile in `CLAUDE.md`.
 *
 * Writes `<out>/triage.json` and prints a Markdown digest. It reads files only; the
 * `pw-failure-triage` skill decides what each failure is and what to do about it.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { JSONReport } from "@playwright/test/reporter";
import { type Failure, readFailures } from "./failures";
import { signalsFor } from "./signals";
import { summarizeTrace, type TraceSummary } from "./trace-summary";

interface TriageEntry {
  id: number;
  failure: Failure;
  /** Trace of the first failed attempt, unpacked under `<out>/<id>/`; absent when none was kept. */
  trace?: TraceSummary & { dir: string };
  signals: string[];
}

const { values } = parseArgs({
  options: {
    report: { type: "string", default: "test-results/results.json" },
    out: { type: "string", default: "test-results/triage" },
    "backend-prefix": { type: "string", default: "/api/" },
    "ignore-path": { type: "string" },
  },
});
const traceOptions = {
  backendPrefix: values["backend-prefix"],
  ...(values["ignore-path"] ? { ignorePath: new RegExp(values["ignore-path"]) } : {}),
};
const reportPath = resolve(values.report);
const outDir = resolve(values.out);

// `<out>` is wiped before unpacking. It must not hold the report or the run's traces next to it.
const fromOut = relative(outDir, dirname(reportPath));
if (fromOut === "" || (!fromOut.startsWith("..") && !isAbsolute(fromOut))) {
  console.error(
    `--out ${outDir} contains the report folder ${dirname(reportPath)}; pick a folder below it, such as test-results/triage.`,
  );
  process.exit(1);
}

if (!existsSync(reportPath)) {
  console.error(`No Playwright JSON report at ${reportPath}. Run the suite first (the json reporter writes it).`);
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, "utf8")) as JSONReport;
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

function unpack(zip: string, dir: string): boolean {
  const result = Bun.spawnSync(["unzip", "-oq", zip, "-d", dir]);
  return result.exitCode === 0;
}

const entries: TriageEntry[] = readFailures(report).map((failure, index) => {
  const id = index + 1;
  const attempt = failure.attempts.find((a) => a.status !== "passed" && a.trace && existsSync(a.trace));
  if (!attempt?.trace) return { id, failure, signals: signalsFor(failure, emptySummary()) };
  const dir = join(outDir, String(id));
  if (!unpack(attempt.trace, dir)) return { id, failure, signals: signalsFor(failure, emptySummary()) };
  const summary = summarizeTrace(dir, traceOptions);
  return {
    id,
    failure,
    trace: { ...summary, dir: relative(process.cwd(), dir) },
    signals: signalsFor(failure, summary),
  };
});

function emptySummary(): TraceSummary {
  return { failedSteps: [], error: "", location: "", locator: "", backendCalls: [] };
}

writeFileSync(
  join(outDir, "triage.json"),
  JSON.stringify({ startTime: report.stats?.startTime, stats: report.stats, entries }, null, 2),
);

const failed = entries.filter((e) => e.failure.outcome === "failed").length;
console.log(
  `# Triage input: ${failed} failed, ${entries.length - failed} flaky (run started ${report.stats?.startTime ?? "?"})\n`,
);
for (const { id, failure, trace, signals } of entries) {
  const error = (trace?.error || failure.attempts[0]?.error || "").split("\n")[0];
  console.log(`## ${id}. ${failure.title} [${failure.project}] ${failure.outcome}`);
  console.log(`- spec: ${trace?.location || `${failure.file}:${failure.line}`}`);
  if (trace?.failedSteps.length) console.log(`- step: ${trace.failedSteps.join(" > ")}`);
  console.log(`- error: ${error}`);
  if (trace?.locator) console.log(`- locator: ${trace.locator}`);
  for (const signal of signals) console.log(`- signal: ${signal}`);
  if (trace) console.log(`- trace: ${trace.dir}`);
  console.log("");
}
console.log(`Full evidence: ${relative(process.cwd(), join(outDir, "triage.json"))}`);
