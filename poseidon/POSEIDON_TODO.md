# Poseidon — Open Items

> Last updated: 2026-02-27
> Status: Paused — revisit when ready

---

## Proteus Group Mode

- [ ] Group persona still too robotic — needs prompt tuning for natural conversation
- [ ] Compare against Will's Jarvis behavior as reference for tone/quality
- [ ] Smart interjection logic needs real-world tuning (cooldown timing, quality threshold)
- [ ] Group scoring system (Haiku batch scorer) untested end-to-end
- [ ] Leaderboard / /scores commands untested in group context
- [ ] Confirm BotFather privacy mode was disabled for group message visibility

## Deities (Poseidon / Nereus / Triton)

- [x] Poseidon god scheduler — startup schedule logging added, failure alerting added, and successful run telemetry persisted to `poseidon_kv` (`poseidon_last_run`)
- [x] Nereus briefings — UTC schedule verification + startup logs added, failure alerting added, and successful run telemetry persisted to `poseidon_kv` (`nereus_last_run`)
- [x] Triton alerts — polling startup verification added, monitor-failure surfacing + alerting added, and successful cycle telemetry persisted to `poseidon_kv` (`triton_last_run`)

## Truth-Source Authority (Resolved 2026-03-02)

- [x] Static memory files now explicitly marked as non-authoritative for operational facts
- [x] System prompt now enforces live-query-first rule for current platform/account/trade state
- [x] Runtime state policy aligned: DB (`poseidon_kv`) is authoritative, state files are seed/fallback only

## API Costs

- [ ] Monitor Anthropic usage after prompt caching + history reduction went live
- [ ] Top up API credits when ready to resume testing
- [ ] Evaluate whether MAX_TOOL_ROUNDS=3 causes any noticeable quality loss
- [ ] Revisit Haiku for group if Sonnet costs are too high (failed first attempt — needs better prompt)

## Context

- Prompt caching, history 50->20, tool rounds 5->3 shipped in `95d8c34`
- Group mode core shipped in `5c3886b`, bug fixes through `369dc7d`
- 409 zombie loop fixed with SIGTERM force-kill in `09d0885`
- Migration 011 (group tables) manually run against prod DB
