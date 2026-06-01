# Limni Versioning Discipline

> Canonical release discipline for Limni app updates. All future release work
> follows this contract unless Freedom explicitly changes it.

## Version Fields

- `releaseLine`: major product line, for example `v2`.
- `displayVersion`: compact UI label, usually the release line (`v2`).
- `appVersion`: exact runtime release, for example `v2.0.1`.
- `semanticVersion`: SemVer equivalent, for example `2.0.1`.
- `canonVersion`: immutable canon artifact identity, for example `v2`.
- `cacheNamespace`: client cache invalidation namespace. Defaults to `appVersion`.

## Timestamp Semantics

- `preparedAt`: local-ready timestamp.
- `releasedAt`: production-go-live timestamp. Keep `null` until the release is actually pushed live.

## Bump Rules

- Patch (`v2.0.1`): bug fix or small behavior correction inside the current release line.
- Minor (`v2.1.0`): meaningful feature or UI update inside the current major architecture.
- Major (`v3.0.0`): architecture or product-model change.

When ambiguous, choose the most conservative bump.

## Cache Rules

- If runtime code or cache interpretation changes, bump `cacheNamespace`.
- If historical canon bytes change, bump `canonVersion` and materialize new canon artifacts.
- Most patches bump `cacheNamespace` but keep `canonVersion` unchanged.
- When in doubt, bump `cacheNamespace`; stale state is more expensive than a fresh preload.

## Push Discipline

All release changes stay local until Freedom explicitly approves push/deploy.
Do not tag or push during implementation verification unless explicitly instructed.

## Issue Lifecycle

Open issues move through:

`Open -> Fixed locally -> Pushed -> Verified in production -> Monitoring -> Closed`
