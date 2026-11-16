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
When the same action is performed as `registered-user`
Then <different observable outcome>
```

Profile ids come from the project's fixtures, roles, or auth model.

## Splitting a non-atomic AC

Original: "A customer can redeem, cancel, and re-redeem a coupon."

```
AC-1a: Given <...>, When the customer redeems the coupon, Then <...>
AC-1b: Given <...>, When the customer cancels an active coupon, Then <...>
AC-1c: Given <...>, When the customer re-redeems after cancelling, Then <...>
```

## Adding measurability

Original: "The list should load quickly."

```
Given <load profile>
When the user opens <route>
Then the list renders within <X> ms at <percentile>
```

## Adding the missing failure mode

Original: "A customer can redeem a coupon."

```
Given a coupon that expired
When the customer opens the coupon card
Then the redeem control is disabled and shows <exact copy>
```

## Variant applicability

If behavior differs per variant (tenant, locale, platform), say so in the rewrite rather than forking the AC:

```
Given variant `<A>`
When <action>
Then <outcome>
(For variant `<B>` the same trigger produces <outcome>; the capability is shared, the copy differs.)
```

## How to present rewrites

Always show:

1. The original text, verbatim.
2. The failed dimensions.
3. The proposed rewrite.
4. A request to confirm: the author or BA approves, not the skill.
