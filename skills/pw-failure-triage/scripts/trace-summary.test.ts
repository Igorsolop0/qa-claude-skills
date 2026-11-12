import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { summarizeTrace } from "./trace-summary";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function jsonl(events: object[]): string {
  return events.map((event) => JSON.stringify(event)).join("\n");
}

/** A trace directory as Playwright unpacks it: `test.trace`, `<n>-trace.network`, `resources/`. */
function traceDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "triage-trace-"));
  dirs.push(dir);
  mkdirSync(join(dir, "resources"));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

const failingStepEvents = [
  { type: "context-options", testTimeout: 60000, annotations: [] },
  { type: "before", callId: "test.step@1", title: "Open phone registration", startTime: 10 },
  { type: "after", callId: "test.step@1" },
  { type: "before", callId: "test.step@2", title: "Request a registration code", startTime: 20 },
  { type: "before", callId: "pw:api@3", parentId: "test.step@2", title: "Click", startTime: 21 },
  { type: "after", callId: "pw:api@3" },
  {
    type: "before",
    callId: "expect@4",
    parentId: "test.step@2",
    title: "BFF should send a code to the number",
    startTime: 22,
  },
  {
    type: "after",
    callId: "expect@4",
    error: { message: "Error: BFF should send a code\n\n\u001b[2mexpect(\u001b[22mreceived).toBe(expected)" },
  },
  { type: "after", callId: "test.step@2", error: { message: "Error: BFF should send a code" } },
  {
    type: "error",
    message: "Error: BFF should send a code\n\nExpected: \u001b[32m200\u001b[39m\nReceived: \u001b[31m503\u001b[39m",
    stack: [{ file: "/repo/e2e/tests/auth/phone-registration.spec.ts", line: 60, column: 69 }],
  },
];

describe("summarizeTrace", () => {
  test("names the failing user step, the failing call, and the error without ANSI colours", () => {
    const dir = traceDir({ "test.trace": jsonl(failingStepEvents) });

    const summary = summarizeTrace(dir);

    expect(summary.failedSteps).toEqual(["Request a registration code", "BFF should send a code to the number"]);
    expect(summary.error).toBe("Error: BFF should send a code\n\nExpected: 200\nReceived: 503");
    expect(summary.location).toBe("tests/auth/phone-registration.spec.ts:60");
  });

  test("on a test timeout, points at the call that was still waiting and its locator", () => {
    const sidebar = "getByTestId('site-sidebar').getByTestId('sidebar-nav-item-profile-settings')";
    const dir = traceDir({
      "test.trace": jsonl([
        { type: "before", callId: "test.step@1", title: "Guest opens phone registration", startTime: 1 },
        {
          type: "before",
          callId: "pw:api@2",
          parentId: "test.step@1",
          title: "Click",
          params: { locator: sidebar },
          stack: [{ file: "/repo/e2e/tests/sidebar/sidebar-session-rows.desktop.spec.ts", line: 76 }],
        },
        { type: "after", callId: "pw:api@2", error: { message: "Error: locator.click: Test ended." } },
        { type: "after", callId: "test.step@1", error: { message: "Error: locator.click: Test ended." } },
        { type: "error", message: "Test timeout of 60000ms exceeded." },
      ]),
    });

    const summary = summarizeTrace(dir);

    expect(summary.error).toBe("Test timeout of 60000ms exceeded.");
    expect(summary.locator).toBe(sidebar);
    expect(summary.location).toBe("tests/sidebar/sidebar-session-rows.desktop.spec.ts:76");
  });

  test("masks secrets in the error message", () => {
    const dir = traceDir({
      "test.trace": jsonl([
        { type: "error", message: 'Error: refresh failed\n{"refreshToken":"KIZT3Hr3KRHS==","userName":"qa"}' },
      ]),
    });

    expect(summarizeTrace(dir).error).toBe('Error: refresh failed\n{"refreshToken":"***","userName":"qa"}');
  });

  test("masks secrets in a failed call's body that is not JSON", () => {
    const dir = traceDir({
      "test.trace": jsonl([]),
      "2-trace.network": jsonl([
        {
          type: "resource-snapshot",
          snapshot: {
            request: { method: "POST", url: "https://site.example.dev/api/auth/login", postData: { text: "x" } },
            response: { status: 502, content: { _file: "resources/gateway.html" } },
            startedDateTime: "2026-10-26T08:15:00.000Z",
            time: 30,
          },
        },
      ]),
      "resources/gateway.html": "<html><body>Bad gateway for password=Secret1!</body></html>",
    });

    expect(summarizeTrace(dir).backendCalls[0]?.responseBody).toBe(
      "<html><body>Bad gateway for password=***</body></html>",
    );
  });

  test("leaves out the ignored paths and calls the closing page aborted", () => {
    const site = "https://shop.example.dev";
    const resource = (path: string, status: number) => ({
      type: "resource-snapshot",
      snapshot: {
        request: { method: "POST", url: `${site}${path}`, postData: { text: '{"a":1}' } },
        response: { status, content: {} },
        startedDateTime: "2026-10-26T08:17:03.572Z",
        time: -1,
      },
    });
    const dir = traceDir({
      "test.trace": jsonl([]),
      "2-trace.network": jsonl([
        resource("/api/analytics", 202),
        resource("/beacon/v1/events", 503),
        resource("/api/games/favorites/status", -1),
      ]),
    });

    expect(summarizeTrace(dir, { ignorePath: /^\/(api\/analytics|beacon)\b/ }).backendCalls).toEqual([
      { at: "08:17:03.572", method: "POST", path: "/api/games/favorites/status", status: -1, ms: -1 },
    ]);
  });

  test("keeps only calls under the backend prefix, plus any 5xx", () => {
    const resource = (path: string, status: number) => ({
      type: "resource-snapshot",
      snapshot: {
        request: { method: "GET", url: `https://shop.example.dev${path}` },
        response: { status, content: {} },
        startedDateTime: "2026-10-26T08:17:03.572Z",
        time: 12,
      },
    });
    const dir = traceDir({
      "test.trace": jsonl([]),
      "2-trace.network": jsonl([resource("/v1/cart", 200), resource("/api/legacy", 200), resource("/cdn/app.js", 502)]),
    });

    expect(summarizeTrace(dir, { backendPrefix: "/v1/" }).backendCalls.map((call) => call.path)).toEqual([
      "/v1/cart",
      "/cdn/app.js",
    ]);
  });

  test("lists backend calls in time order, with the body of every failed one and no secrets", () => {
    const site = "https://shop.example.dev";
    const resource = (request: object, response: object, startedDateTime: string) => ({
      type: "resource-snapshot",
      snapshot: { request, response, startedDateTime, time: 217.7 },
    });
    const dir = traceDir({
      "test.trace": jsonl([]),
      "2-trace.network": jsonl([
        resource(
          { method: "POST", url: `${site}/api/auth/otp/request`, postData: { _file: "resources/req.json" } },
          { status: 503, content: { _file: "resources/res.json" } },
          "2026-10-26T08:15:52.062Z",
        ),
        resource(
          { method: "GET", url: `${site}/_astro/app.js` },
          { status: 200, content: {} },
          "2026-10-26T08:15:30.000Z",
        ),
        resource(
          { method: "GET", url: "https://accounts.google.com/gsi/status" },
          { status: 403, content: {} },
          "2026-10-26T08:15:38.000Z",
        ),
      ]),
      "1-trace.network": jsonl([
        resource(
          { method: "POST", url: `${site}/api/auth/register` },
          { status: 200, content: { _sha1: "ok.json" } },
          "2026-10-26T08:15:29.505Z",
        ),
      ]),
      "resources/req.json": JSON.stringify({ mobileNumber: "+520744923451", password: "Secret1!", code: "872105" }),
      "resources/res.json": JSON.stringify({ error: "Service Unavailable" }),
      "resources/ok.json": JSON.stringify({ refreshToken: "never-printed" }),
    });

    expect(summarizeTrace(dir).backendCalls).toEqual([
      { at: "08:15:29.505", method: "POST", path: "/api/auth/register", status: 200, ms: 218 },
      {
        at: "08:15:52.062",
        method: "POST",
        path: "/api/auth/otp/request",
        status: 503,
        ms: 218,
        requestBody: '{"mobileNumber":"+520744923451","password":"***","code":"***"}',
        responseBody: '{"error":"Service Unavailable"}',
      },
    ]);
  });
});
