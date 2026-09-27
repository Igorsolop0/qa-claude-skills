# Comment and Decision Signals

Applies to every input type. Parse discussion immediately after reading the source, before AC
extraction. Signals found here are carried forward explicitly — they shape ACs, risks, and scenarios.

Sources of signals:

- GitHub issue comments (`gh issue view <N> --json comments`)
- Linked PR review threads, when the change is already in flight
- OpenSpec review notes inside the change folder
- Decisions the user states directly in the session

## When to skip

Skip when there are no comments, or when every comment is automated: bot review summaries, CI status
posts, project-field change logs. An automated comment is one with no human-authored sentence.

## Signal types

| Signal | What it looks like | How to use it |
| --- | --- | --- |
| AC change | "Updated AC-3", "confirmed: X is not required" | Supersedes the description; use the updated version |
| Scope narrowing | "FE is out of scope for this issue", "backend only" | Add to `assumptions[]`; generate no scenarios for what was cut |
| Implementation constraint | "Must reuse the existing service", "no new collection" | Shapes `dependencies` and the level choice |
| Design change | "Figma updated — the flow is now Y" | Re-derive the affected ACs |
| Dependency revealed | "Blocked on #NNN", "needs the gateway change first" | Add to `risks[]` as an integration dependency |
| Root cause hypothesis (bugs) | "I think the endpoint never re-fetches after save" | Carries into `feature_framing.what_changes`; shapes the RED scenario |
| Prior fix attempt (bugs) | "PR #123 was reverted because…" | Add to `risks[]` as a regression risk for that approach |
| Reproduction constraint (bugs) | "Only on qa", "only for verified players" | Constrains the scenario conditions; note in `assumptions[]` |
| Ambiguity resolved | Someone explains what a term means here | Update `assumptions[]` accordingly |

## Process

1. Read comments in chronological order.
2. Skip automated entries.
3. Classify each human comment against the table.
4. Rank by effect: AC-changing → scope-narrowing → risk-revealing → context-enriching.
5. Contradictory comments: use the most recent, and record the discrepancy in `ambiguities[]`.

## Output

```json
"decision_signals": [
  {
    "source": "issue #2201 comment",
    "signal_type": "scope_narrowing",
    "text": "Backoffice UI is out of scope for this issue",
    "carried_into": "assumptions[0], scenario_matrix (no BO UI scenarios)"
  }
]
```

No signals → `"decision_signals": []`.

## Hard rules

- Never silently drop a signal you read. Ignoring a scope change is exactly the failure this step prevents.
- Comments supersede the description for ACs when they state a change. Descriptions go stale; decisions land in comments.
- Comments can narrow, clarify, or change scope. They cannot silently add new requirements — an addition must be stated as a new AC.
- One long comment can carry several signals.
