import type { JSONReport, JSONReportSpec, JSONReportSuite } from "@playwright/test/reporter";
import { redactText } from "./redact";
import { stripAnsi } from "./trace-summary";

/** One test in one project that did not pass on its first attempt. */
export interface Failure {
  title: string;
  /** Spec path relative to the Playwright config folder. */
  file: string;
  line: number;
  project: string;
  /** `failed`: no attempt passed. `flaky`: a retry passed after a failure. */
  outcome: "failed" | "flaky";
  tags: string[];
  /** Issue links from `issue` annotations, i.e. failures the suite already knows about. */
  issues: string[];
  attempts: Attempt[];
}

interface Attempt {
  status: string;
  error: string;
  /** Absolute path of this attempt's `trace.zip`, when Playwright kept one. */
  trace?: string;
}

function specs(suite: JSONReportSuite): JSONReportSpec[] {
  return [...suite.specs, ...(suite.suites ?? []).flatMap(specs)];
}

/** Failed and flaky tests from a Playwright JSON report, in report order. */
export function readFailures(report: JSONReport): Failure[] {
  const failures: Failure[] = [];
  for (const spec of report.suites.flatMap(specs)) {
    for (const test of spec.tests) {
      if (test.status !== "unexpected" && test.status !== "flaky") continue;
      failures.push({
        title: spec.title,
        file: spec.file,
        line: spec.line,
        project: test.projectName,
        outcome: test.status === "flaky" ? "flaky" : "failed",
        tags: spec.tags,
        issues: test.annotations.flatMap((a) => (a.type === "issue" && a.description ? [a.description] : [])),
        attempts: test.results.map((result) => {
          const trace = result.attachments.find((a) => a.name === "trace")?.path;
          return {
            status: result.status ?? "unknown",
            error: redactText(stripAnsi(result.errors.map((e) => e.message ?? "").join("\n"))),
            ...(trace ? { trace } : {}),
          };
        }),
      });
    }
  }
  return failures;
}
