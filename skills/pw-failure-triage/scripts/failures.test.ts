import { describe, expect, test } from "bun:test";
import type { JSONReport } from "@playwright/test/reporter";
import { readFailures } from "./failures";

function report(tests: object[]): JSONReport {
  return {
    config: { rootDir: "/repo/qa" },
    suites: [
      {
        title: "tests/auth/phone-registration.spec.ts",
        file: "tests/auth/phone-registration.spec.ts",
        specs: [
          {
            title: "Registering again with a confirmed phone number @T0a1b2c3d",
            file: "tests/auth/phone-registration.spec.ts",
            line: 104,
            tags: ["@regression", "@auth"],
            tests,
          },
        ],
        suites: [],
      },
    ],
  } as unknown as JSONReport;
}

function attempt(status: string, retry: number, message?: string) {
  return {
    status,
    retry,
    errors: message ? [{ message }] : [],
    attachments: message ? [{ name: "trace", path: `/repo/e2e/test-results/case-retry${retry}/trace.zip` }] : [],
  };
}

describe("readFailures", () => {
  test("returns failed and flaky tests with every attempt, skipping the ones that passed", () => {
    const failures = readFailures(
      report([
        {
          projectName: "web",
          status: "unexpected",
          annotations: [{ type: "issue", description: "https://github.com/acme/shop/issues/42" }],
          results: [attempt("failed", 0, '\u001b[31mError: expected 200, got {"accessToken":"eyJx"}\u001b[39m')],
        },
        {
          projectName: "web-webkit",
          status: "flaky",
          annotations: [],
          results: [attempt("timedOut", 0, "Test timeout of 60000ms exceeded."), attempt("passed", 1)],
        },
        { projectName: "web-android", status: "expected", annotations: [], results: [attempt("passed", 0)] },
      ]),
    );

    expect(failures).toEqual([
      {
        title: "Registering again with a confirmed phone number @T0a1b2c3d",
        file: "tests/auth/phone-registration.spec.ts",
        line: 104,
        project: "web",
        outcome: "failed",
        tags: ["@regression", "@auth"],
        issues: ["https://github.com/acme/shop/issues/42"],
        attempts: [
          {
            status: "failed",
            error: 'Error: expected 200, got {"accessToken":"***"}',
            trace: "/repo/e2e/test-results/case-retry0/trace.zip",
          },
        ],
      },
      {
        title: "Registering again with a confirmed phone number @T0a1b2c3d",
        file: "tests/auth/phone-registration.spec.ts",
        line: 104,
        project: "web-webkit",
        outcome: "flaky",
        tags: ["@regression", "@auth"],
        issues: [],
        attempts: [
          {
            status: "timedOut",
            error: "Test timeout of 60000ms exceeded.",
            trace: "/repo/e2e/test-results/case-retry0/trace.zip",
          },
          { status: "passed", error: "" },
        ],
      },
    ]);
  });
});
