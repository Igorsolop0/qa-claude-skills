import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { redactBody, redactText } from "./redact";

/** What a failed test's trace says, reduced to the facts a triage needs. */
export interface TraceSummary {
  /** Titles from the outermost `test.step` down to the call that failed. */
  failedSteps: string[];
  /** The test's error as Playwright printed it, without terminal colours and with secrets masked. */
  error: string;
  /** `tests/...spec.ts:<line>` of the innermost spec frame, or `""` when the stack names none. */
  location: string;
  /** Locator of the failed call (or its nearest ancestor that has one), or `""`. */
  locator: string;
  /**
   * Backend calls (paths under `backendPrefix`) and any `5xx`, oldest first, without the paths `ignorePath`
   * drops (analytics beacons). Calls that got
   * a `4xx`/`5xx` carry their bodies; `-1` is a call that never got an answer (often the page closing).
   */
  backendCalls: BackendCall[];
}

interface BackendCall {
  /** UTC wall time `HH:MM:SS.mmm`, to line calls up across contexts and with backend logs. */
  at: string;
  method: string;
  path: string;
  status: number;
  ms: number;
  requestBody?: string;
  responseBody?: string;
}

interface TraceEvent {
  type: string;
  callId?: string;
  parentId?: string;
  title?: string;
  message?: string;
  params?: { locator?: string };
  error?: { message?: string };
  stack?: { file: string; line: number }[];
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequences start with ESC.
const ANSI = /\u001b\[[0-9;]*m/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI, "");
}

interface ResourceSnapshot {
  startedDateTime: string;
  time?: number;
  request: { method: string; url: string; postData?: { _file?: string; text?: string } };
  response: { status: number; content?: { _file?: string; _sha1?: string; text?: string } };
}

const BODY_LIMIT = 500;

/** Which network calls count as the product's backend. */
export interface TraceOptions {
  /** Path prefix of the backend the tests talk to; calls outside it are kept only when they answer `5xx`. */
  backendPrefix?: string;
  /**
   * Paths to drop entirely, such as fire-and-forget analytics: their failures never fail a test and
   * drown the real calls.
   */
  ignorePath?: RegExp;
}

function readEvents(path: string): TraceEvent[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as TraceEvent);
}

/**
 * The chain from the root step to the innermost failed call. Playwright marks every ancestor of a
 * failed call as failed too, so the innermost one is the failed call that is no other failed call's
 * parent.
 */
function failedChain(events: TraceEvent[]): TraceEvent[] {
  const calls = new Map<string, TraceEvent>();
  const failed = new Set<string>();
  for (const event of events) {
    if (event.type === "before" && event.callId) calls.set(event.callId, event);
    if (event.type === "after" && event.callId && event.error) failed.add(event.callId);
  }
  const failedParents = new Set([...failed].map((id) => calls.get(id)?.parentId));
  const innermost = [...failed].find((id) => !failedParents.has(id));
  const chain: TraceEvent[] = [];
  for (let call = innermost ? calls.get(innermost) : undefined; call; ) {
    chain.unshift(call);
    call = call.parentId ? calls.get(call.parentId) : undefined;
  }
  return chain;
}

function specLocation(stack: TraceEvent["stack"]): string {
  const frame = stack?.find((f) => /\.spec\.ts$/.test(f.file));
  if (!frame) return "";
  const index = frame.file.lastIndexOf("/tests/");
  return `${index >= 0 ? frame.file.slice(index + 1) : frame.file}:${frame.line}`;
}

function readBody(dir: string, file: string | undefined, inline: string | undefined): string | undefined {
  let body = inline || undefined;
  if (file) {
    try {
      body = readFileSync(join(dir, file.startsWith("resources/") ? file : `resources/${file}`), "utf8");
    } catch {
      return undefined;
    }
  }
  return body === undefined ? undefined : redactBody(body).slice(0, BODY_LIMIT);
}

function backendCalls(dir: string, files: string[], { backendPrefix = "/api/", ignorePath }: TraceOptions): BackendCall[] {
  const calls: (BackendCall & { started: string })[] = [];
  for (const file of files.filter((name) => name.endsWith(".network"))) {
    for (const event of readEvents(join(dir, file)) as unknown as { snapshot?: ResourceSnapshot }[]) {
      const snapshot = event.snapshot;
      if (!snapshot) continue;
      const { request, response } = snapshot;
      const url = new URL(request.url);
      if (ignorePath?.test(url.pathname)) continue;
      if (!url.pathname.startsWith(backendPrefix) && response.status < 500) continue;
      const call: BackendCall & { started: string } = {
        started: snapshot.startedDateTime,
        at: snapshot.startedDateTime.slice(11, 23),
        method: request.method,
        path: url.pathname,
        status: response.status,
        ms: Math.round(snapshot.time ?? 0),
      };
      if (response.status >= 400) {
        const requestBody = readBody(dir, request.postData?._file, request.postData?.text);
        const responseBody = readBody(dir, response.content?._file ?? response.content?._sha1, response.content?.text);
        if (requestBody !== undefined) call.requestBody = requestBody;
        if (responseBody !== undefined) call.responseBody = responseBody;
      }
      calls.push(call);
    }
  }
  return calls.sort((a, b) => a.started.localeCompare(b.started)).map(({ started: _started, ...call }) => call);
}

/** Summarise an unpacked Playwright trace directory (the contents of `trace.zip`). */
export function summarizeTrace(dir: string, options: TraceOptions = {}): TraceSummary {
  const files = readdirSync(dir);
  const testTrace = files.includes("test.trace") ? readEvents(join(dir, "test.trace")) : [];
  const error = testTrace.find((event) => event.type === "error");
  const chain = failedChain(testTrace);
  const innermostFirst = [...chain].reverse();
  return {
    failedSteps: chain.flatMap((call) => (call.title ? [call.title] : [])),
    error: redactText(stripAnsi(error?.message ?? "")),
    location: [error, ...innermostFirst].map((event) => specLocation(event?.stack)).find(Boolean) ?? "",
    locator: innermostFirst.find((call) => call.params?.locator)?.params?.locator ?? "",
    backendCalls: backendCalls(dir, files, options),
  };
}
