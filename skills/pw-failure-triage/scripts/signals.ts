import type { Failure } from "./failures";
import type { TraceSummary } from "./trace-summary";

const LOCATOR_NOT_FOUND = /^Test timeout of \d+ms exceeded|element\(s\) not found|resolved to 0 elements/m;

/**
 * Mechanical facts that point at a failure class. They are evidence for the triage, not its
 * verdict: a 5xx during a test that failed on a locator can still be a test that drifted.
 */
export function signalsFor(failure: Failure, summary: TraceSummary): string[] {
  const signals: string[] = [];
  if (failure.outcome === "flaky") signals.push("retry-passed");
  for (const issue of failure.issues) signals.push(`known-issue: ${issue}`);
  for (const call of summary.backendCalls) {
    if (call.status >= 500) signals.push(`backend-5xx: ${call.method} ${call.path} ${call.status}`);
  }
  if (summary.locator && LOCATOR_NOT_FOUND.test(summary.error)) {
    signals.push(`locator-not-found: ${summary.locator}`);
  }
  return signals;
}
