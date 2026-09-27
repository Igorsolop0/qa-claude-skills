# Test Design Techniques

Layer 3 of the Burger method. Pick the techniques that fit the feature shape and say what slice each
one cuts. A technique named without its concrete slice is decoration — delete it.

## Specification-based (black box)

### Equivalence partitioning

Split each input into classes where every member is expected to behave the same, then test one
representative per class — valid and invalid.

- Use when: an input has rule buckets (amount, status, role, locale, category).
- the platform example: bonus amount → `below minimum`, `within range`, `above maximum`, `non-numeric`.
- Pitfall: partitions that overlap. If two classes can both apply, you have a decision table, not a partition.

### Boundary value analysis

Test the edges of each partition: the limit itself, one step below, one step above.

- Use when: ranges, limits, timers, counters, page sizes, string lengths, expiry.
- the platform example: password `5 / 6 / 20 / 21` characters against the storefront rule of 6–20;
  bonus countdown at `T-1s`, `T`, `T+1s`; slider with `0 / 1 / max` cards.
- Pitfall: testing only the middle of a range proves nearly nothing; the defect lives at the edge.

### Decision table

Enumerate condition combinations and the expected rule for each. Collapse rows that cannot occur.

- Use when: two or more conditions combine (profile × feature flag × brand, verified × balance × bonus state).
- the platform example: bonus button state from `has active bonus` × `is verified` × `balance > 0`.
- Output it as an actual table in the plan. Each surviving row is one scenario or one unit-test case.

### State transition

Model states and the events that move between them; test valid transitions, then the invalid ones.

- Use when: a status field drives behavior — session (guest → registering → player → logged out),
  bonus (available → claimed → active → expired / cancelled), deposit, verification.
- the platform example: cancel an already-cancelled bonus; claim an expired one; log out mid-flow.
- Pitfall: forgetting the invalid transitions — that is where most of the defects are.

### Pairwise / combinatorial

When the full matrix explodes (viewport × locale × brand × profile), cover all pairs instead of all
combinations.

- Use when: three or more independent dimensions with several values each.
- the platform example: `{xs, xl} × {es, en} × {guest, player}` — pick a pair-covering subset instead of eight full runs.
- Say explicitly that pairwise was applied, so nobody reads the gaps as an oversight.

### Use case / scenario

Walk the user journey end to end, in the order a real player performs it.

- Use when: the value only appears across steps — register → verify → deposit → claim bonus → play.
- This is the technique that legitimately produces live E2E scenarios in `qa/`.

## Experience-based

### Error guessing

Target what historically breaks in this codebase: empty CMS collections, missing translations,
slow upstream, expired tokens, double submits, back-navigation after logout, duplicated event handlers.

- Feed it from `.agents/retros/**` and from closed bug issues in the same area.

### Exploratory

Timeboxed charter-based session when the behavior is not specified well enough to design cases up front.

- Charter format: "Explore <area> with <resource> to discover <information>."
- Output: findings and new scenarios, not a pass/fail verdict.
- Use when: a spec is thin, a third-party widget is involved, or a bug cannot be reproduced.

## Structure-based (white box)

Applied after reading the implementation, usually to decide unit-test cases.

- **Statement / branch coverage** — every `if`, `switch`, and early return exercised, including the
  fallback branches the AC never mentioned (locale fallback, null envelope, cache miss, retry).
- **Condition coverage** — each sub-condition of a compound predicate evaluated both ways.
- Use to *find missing cases*, never as a substitute for requirement coverage.

## Choosing in practice

| Feature shape | First-choice techniques |
| --- | --- |
| Form with validation | Equivalence partitioning + boundary values + negative cases |
| Status-driven UI (bonus, verification) | State transition + decision table |
| API endpoint | Partitioning on parameters + boundaries + negative auth cases + schema assertion |
| Layout across breakpoints and locales | Pairwise + use case |
| Bug fix | Error guessing around the fix + structure-based on the changed function |
| Thin or unclear spec | Exploratory charter first, then design cases from the findings |
