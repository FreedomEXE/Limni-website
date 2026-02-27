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

- [ ] Poseidon god scheduler — silent since deploy, likely broken. Debug on Render logs
- [ ] Nereus briefings — not firing. Check schedule, cron logic, and Render logs
- [ ] Triton alerts — same. Verify it starts and runs post-deploy

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
