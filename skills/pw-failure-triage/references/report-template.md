# Report template

Answer in the user's language. Keep identifiers, commands and error strings verbatim.

```markdown
## Run <startTime UTC>, build <deployed sha> (<n> PRs since last green <sha>)

<failed> failed, <flaky> flaky: <k> infra, <k> test-drift, <k> product-bug, <k> flaky.
<One sentence: did the merged changes break anything, and what needs a human.>

| # | Test | Project | Class | Evidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | Registering again… | web-mobile | infra | `POST /api/auth/otp/request` 503 at 08:15:52, 200 at 08:15:29 | rerun; escalate if repeated |
| 2 | Guest and player session rows | web-desktop | test-drift | #137 hides `profile-settings` for guests | healed, 3/3 passed |

### Proposed fixes (local, uncommitted)

- `tests/...spec.ts`: <what and why>. Verified: `<command>` → 3 passed.

### Bugs

- Known: #182 (left red).
- New draft: `[fix][area] Title`, with steps, expected, actual and evidence. Created only after your yes.

### Unresolved

- <test>: <what is missing to classify or heal it>.
```

Skip empty sections. One row per failure, even when several share a cause; say "same cause as #n"
in Evidence.
