# How I build skills

This is the pipeline I use to turn raw learning material (a course lesson, a war story, a docs page I keep re-reading) into a Claude Code skill that's actually worth shipping. The point of writing it down: so I don't lower the bar over time, and so the process is reproducible without me.

## The pipeline

```
recording / docs / problem  →  transcript / notes  →  nuggets  →  gate  →  SKILL.md + references + evals
                                                                  ↓
                                                            draft (rejected)
```

1. **Source material.** Course lesson recording (Meetily), Playwright docs section, or a real bug I just chased. Anything that took me time to learn the hard way is a candidate.
2. **Transcript / summary.** For recorded material I generate a structured markdown summary — key points, code samples, mechanism explanations. Not a verbatim transcript, an extraction.
3. **Nuggets.** Pull out each individually-useful claim or technique. Granularity: small enough that one nugget = one rule or one mechanism. "page.goto() does not throw on 4xx" is one nugget; "page object pattern" is too big and needs splitting.
4. **Skill candidates.** Cluster related nuggets into "would this be a skill?" candidates. Most clusters fail. That's the point.
5. **Gate.** Apply the 5-point gate below. Fail-fast — first miss kills the candidate.
6. **SKILL.md + references + evals.** Only for survivors. Progressive disclosure: thin SKILL.md (trigger + workflow + philosophy) plus `references/` loaded on demand.

## The 5-point gate

A candidate ships only if **all five** pass. If you're tempted to fudge any of them, the skill isn't ready.

### 1. Repeat-test

> Will I (or someone like me) hit this same situation more than ~5 times in a year?

If no, it's a one-off lookup, not a skill. Skills earn their context cost by amortizing over many invocations.

**Pass example:** "review a Playwright test for anti-patterns" — every PR review.
**Fail example:** "parse a specific bank's CSV export with this exact column order" — once.

### 2. Tribal-knowledge test

> Is the value here *non-obvious* from reading the official docs or a quick Google?

If the answer is in the first page of search results, write a snippet, not a skill. Skills are for institutional knowledge — the stuff a senior knows that a junior wouldn't extract from documentation in time.

**Pass example:** "networkidle is a common antipattern because of background polling — wait on an element instead" — implied by docs but never stated this directly.
**Fail example:** "use `page.goto()` to navigate to a URL" — the literal first line of the Playwright getting-started.

### 3. Triggers test

> Can I write a description that triggers reliably on phrasing the user would actually use, without false positives?

The skill description is the contract. Vague descriptions either don't trigger (wasted work) or trigger on the wrong things (annoying). Trigger phrases should be concrete and varied — `"review playwright test"`, `"is this test flaky"`, `"code smell in this spec"`, etc.

If you can't list 4–5 trigger phrases without overlap with another skill, the skill's scope isn't clear yet.

### 4. Output test

> Is the output a specific, useful artifact — not just "Claude responds about the topic"?

A skill should produce something concrete: a structured review, a generated file, a decision rubric, a checklist applied to inputs. "Explains things about X" is not a skill, it's a generic capability.

**Pass example:** `pw-test-review` outputs a Critical/High/Medium/Low report with line numbers and fixes.
**Fail example:** "tell me about Playwright best practices" — that's a conversation.

### 5. Maintenance test

> Will this stay useful for 12+ months without significant rework?

If the underlying tech changes weekly, the skill goes stale faster than you can update it. Bias toward principles and mechanisms (which stay valid) over specific API versions (which don't).

**Pass example:** Anti-pattern catalogue based on async/await semantics, parallel-workers behaviour — these are foundational.
**Fail example:** "use this specific 2026 alpha feature in playwright.config.ts" — gone in 6 months.

## Anatomy of a good SKILL.md

Progressive disclosure: thin top-level file, references loaded on demand.

```markdown
---
name: pw-test-review
description: <punchy, specific, lists trigger phrases. This is the part Claude reads to decide if your skill is relevant.>
---

# pw-test-review

<One-sentence "what this is" — including what it's NOT, if there's a common misread.>

## When this skill applies
<Concrete trigger phrases the user would actually say.>

## Workflow
<5–7 steps, imperative voice, the steps Claude follows.>

## Philosophy
<The thing the user cares about — why this exists, what audience it's for. This is also what Claude uses to make judgement calls inside the workflow.>

## References
- `references/<catalog>.md` — full details, loaded only when needed
- `references/<output-template>.md` — exact output structure
```

Why progressive disclosure: SKILL.md is loaded into Claude's context every time the skill *might* trigger. If it's 500 lines, every triggering eats context for nothing. Keep it under ~80 lines and offload the rest into `references/` that Claude opens only when actually doing the work.

## Evals — why every skill ships with them

A skill without evals is a vibe. With evals you can:

- Test before publishing — does the skill actually catch what it claims?
- Compare against a no-skill baseline — is the skill earning its keep, or would Claude do the same thing without it?
- Notice regressions when you edit SKILL.md.

Minimum viable eval set: 3–5 fixture files covering the main cases the skill is for, plus one "clean" fixture (no issues to flag) — to make sure the skill doesn't hallucinate problems.

Fixtures live in `evals/fixtures/`. Eval definitions live in `evals/evals.json`:

```json
{
  "skill_name": "<name>",
  "evals": [
    {
      "id": 0,
      "eval_name": "descriptive-name",
      "prompt": "<what the user would say, in their voice>",
      "files": ["fixtures/<file>.spec.ts"],
      "assertions": []
    }
  ]
}
```

## On rejected candidates

The candidates that *fail* the gate are part of the system, not waste. Keep them as drafts somewhere visible — writing the rejections down is the discipline. Without that, the gate decays into "I want to ship something this week."

Typical failure modes worth recognizing:

- **Repeat-test fails** — a task you only hit a couple times a year doesn't need a skill, just a saved snippet.
- **Tribal-knowledge fails** — if the official docs already cover it cleanly, skip the wrapping. Skills are for the senior reflexes that aren't in the docs.
- **Maintenance fails** — anything tied to a specific alpha API or fast-moving config will go stale before it pays off.

If a method is reusable but the framework-specific wrapping isn't, generalize the method into a tool-agnostic draft instead of shipping a narrow skill. The draft is cheap to promote later if the same pattern shows up in two more contexts.

## TL;DR

The gate keeps the bar honest. Source material is everywhere; the scarce thing is judgement about what's worth turning into a skill.

If you adopt this pipeline, the only thing I'd insist on is: **write down the candidates that fail.** That's where you'll see your future self trying to lower the bar.
