# AC Refinement Templates

When an AC fails the quality rubric, propose a rewrite. Never silently replace the original — the
author confirms it.

## Standard Given/When/Then

```
Given <preconditions>
When <action or event>
Then <observable outcome>
```

## Access-profile variant

When the same trigger produces different outcomes per profile:

```
Given <preconditions>
When <action> as `guest`
Then <observable outcome for a guest>

Given <preconditions>
When the same action is performed as `player-default`
Then <different observable outcome>
```

Profile ids come from `gateway/mock/profiles/<brand>/profiles.yaml`.

## Splitting a non-atomic AC

Original: "A player can claim, cancel, and re-claim a bonus."

```
AC-1a: Given <...>, When the player claims the bonus, Then <...>
AC-1b: Given <...>, When the player cancels an active bonus, Then <...>
AC-1c: Given <...>, When the player re-claims after cancelling, Then <...>
```

## Adding measurability

Original: "The list should load quickly."

```
Given <load profile>
When the player opens <route>
Then the list renders within <X> ms at <percentile>
```

## Adding the missing failure mode

Original: "A player can claim a bonus."

```
Given a bonus that expired
When the player opens the bonus card
Then the claim control is disabled and shows <exact copy>
```

## Brand applicability

If behavior differs per brand, say so in the rewrite rather than forking the AC:

```
Given brand `client`
When <action>
Then <outcome>
(For `brand-b` the same trigger produces <outcome>; capability is shared, the copy differs.)
```

## How to present rewrites

Always show:

1. The original text, verbatim.
2. The failed dimensions.
3. The proposed rewrite.
4. A request to confirm: the author or BA approves, not the skill.
