# Next Chat Handoff - Gate 104 Speed Optimization

Copy/paste prompt for the next Codex chat:

```text
You are Codex working inside the Limni/Poseidon repo.

Repo:
C:/Users/User/Documents/GitHub/limni-website

Branch:
codex/gate88-mt5-lifecycle-protection-controls

Current gate:
Gate 104 - Revma MT5 Tester Speed Optimization - REVIEW GATED

Recovery order:
1. Read C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md
2. Read C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_CKB.md
3. Read AGENTS.md
4. Read automation/mt5/README.md
5. Read docs/research/gates/gate104/GATE104_REVMA_TESTER_SPEED_BENCHMARK_2026-07-08.md
6. Read docs/research/gates/gate104/GATE104_REVMA_SPEED_CODE_REVIEW_PACKET_2026-07-08.md
7. Run git status --branch --short and verify live repo truth.

Current state:
- Revma remains mean-reversion only.
- No strategy formula or risk-control work is open.
- CompactLongRun receipts exist and compile cleanly.
- AUTO output naming exists.
- Receipt file run IDs were shortened to LPEA_* to avoid MT5/path length CSV-open failures.
- The benchmark harness can run q profiles and tester models.
- Speed benchmarks show compact output is manageable, but a six-year open-prices run still projected about 2 hours and was stopped.
- The stopped six-year run is partial speed evidence only, not strategy evidence.
- Completed benchmark output folders were archived under Common Files/LimniPortfolioEA_Archive.

Primary objective:
Improve MT5 tester throughput in a non-destructive way so long-regime Revma research can run many controlled tests without two-hour single runs.

Expected approach:
- Do not code first.
- Wait for Freedom to provide/approve ChatGPT review alignment on the speed code-review packet.
- Review the code-review packet first, then compare ChatGPT's response against repo truth.
- Do not change Revma strategy behavior.
- Prefer harness improvements over EA logic changes.
- Most likely next work: shard runner + parallel terminal workers + aggregate ledger.
- Keep output cleanup workflow: root has only Archive plus current/unreviewed runs.

Hard boundaries:
- No Revma formula changes.
- No TP/parameter optimization.
- No Kyma/trend-following.
- No risk-guard design.
- No promotion/live-readiness claims.
- No full six-year rerun until the harness can shard/parallelize or otherwise reduce wall-clock time.

First response:
Identify Gate 104 speed optimization as active/review-gated, verify git status, summarize that the output-size problem is improved but long-window runtime is still too slow, and stop for Freedom approval or ChatGPT review input before implementation.
```
