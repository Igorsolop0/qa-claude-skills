---
type: llm
weight: 2
---

PASS if the reply does all of these:
- treats the request as several tests, not one: it proposes first a short test for one action the
  rest of the flow stands on (registration, or ticket creation when registration is already covered
  by the existing `tests/e2e/auth/register.spec.ts`);
- proposes tests for that one action now, and lists the remaining actions (opening the ticket,
  changing its status, seeing it closed in the list) as later rounds, outside the proposal table;
- gives a short reason, such as "a long test that fails does not show where it broke";
- stops and asks for the user's approval before writing.

FAIL if the first proposed test walks the whole flow from registration to the closed ticket, or if
the reply says it has written test files.
