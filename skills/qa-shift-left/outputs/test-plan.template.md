## QA Test Plan — {REF}

**Verdict:** {emoji} {verdict} — {one-line rationale}
**QA-owned:** api {api_n} / live {e2e_n} (limit {e2e_limit}) | **Delegated:** unit {unit_n} / component {component_n} / mocked {mock_n}
**Coverage:** {ac_covered}/{ac_total} ACs | Budget: {within_limits}
**Scope:** {variant name | all variants}

---

{only if any AC needs refinement:}
### AC rewrites

**{AC.id}** _{one-line reason}_
> Given {given}
> When {when}
> Then {then}

_Please confirm the rewrite or provide an alternative._

### Risks

{at most 3, highest impact first:}
- **{category}**: {description}

### Test scenarios

{`must` priority only:}
| ID | Level | Scenario | Covers | Destination |
| --- | --- | --- | --- | --- |
| {id} | {level} | {scenario} | {covers_ac} | {destination} |

### Handoff

- Mocked cases: `{case location}` — {ids}
- Live specs in `{tests dir}`: {ids or "none — nothing on the critical path"}
- Deferred (mock-only today): {ids or "none"}

### Full plan

`{artifact-path}.json` — all scenarios including `should` and `could`, coverage ladder, budget check, profile matrix.

---
*qa-shift-left*
