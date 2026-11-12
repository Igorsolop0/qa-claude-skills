import { describe, expect, test } from "bun:test";
import type { Failure } from "./failures";
import { signalsFor } from "./signals";
import type { TraceSummary } from "./trace-summary";

const failure: Failure = {
  title: "Guest registers @T1",
  file: "tests/auth/registration.spec.ts",
  line: 10,
  project: "web",
  outcome: "failed",
  tags: [],
  issues: [],
  attempts: [{ status: "failed", error: "Error: expected 200" }],
};

const summary: TraceSummary = { failedSteps: [], error: "", location: "", locator: "", backendCalls: [] };

describe("signalsFor", () => {
  test("flags a 5xx from the backend, a known issue, and a retry that passed", () => {
    expect(
      signalsFor(
        {
          ...failure,
          outcome: "flaky",
          issues: ["https://github.com/acme/shop/issues/42"],
        },
        {
          ...summary,
          backendCalls: [
            { at: "08:15:48.697", method: "POST", path: "/api/auth/register", status: 503, ms: 452 },
            { at: "08:15:49.000", method: "GET", path: "/api/auth/me", status: 200, ms: 20 },
          ],
        },
      ),
    ).toEqual([
      "retry-passed",
      "known-issue: https://github.com/acme/shop/issues/42",
      "backend-5xx: POST /api/auth/register 503",
    ]);
  });

  test("flags a locator that never resolved: a timeout, or an element not found", () => {
    const locator = "getByRole('button', { name: 'Cerrar' })";
    expect(signalsFor(failure, { ...summary, error: "Test timeout of 60000ms exceeded.", locator })).toEqual([
      `locator-not-found: ${locator}`,
    ]);
    expect(
      signalsFor(failure, {
        ...summary,
        error: "Error: expect(locator).toBeVisible() failed\nelement(s) not found",
        locator,
      }),
    ).toEqual([`locator-not-found: ${locator}`]);
    expect(signalsFor(failure, { ...summary, error: "Error: expected 200", locator })).toEqual([]);
  });
});
