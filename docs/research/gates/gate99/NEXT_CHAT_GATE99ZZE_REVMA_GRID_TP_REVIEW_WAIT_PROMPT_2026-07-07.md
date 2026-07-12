# Next Chat Prompt - Gate 99ZZE Revma Grid TP Review Wait

You are working inside the Limni/Poseidon repo.

Repo:
`C:/Users/User/Documents/GitHub/limni-website`

Branch:
`codex/gate88-mt5-lifecycle-protection-controls`

Mode:
`REVIEW WAIT - DO NOT CODE`

Recovery order:

1. Read `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md`.
2. Read `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_CKB.md`.
3. Read `AGENTS.md`.
4. Read
   `docs/research/gates/gate99/GATE99ZZE_REVMA_GRID_BASKET_TP_REPAIR_2026-07-07.md`.
5. Read
   `docs/research/gates/gate99/CHATGPT_REVIEW_GATE99ZZE_REVMA_GRID_TP_ARCHITECTURE_PROMPT_2026-07-07.md`.

Current state:

- Gate 99ZZE is a pushed checkpoint for external review.
- Revma v001 is the current Pair Direction / Grid Sleeve strategy.
- The current Gate 99ZZE implementation uses managed close-grid execution for
  single-pair q TP.
- Freedom says this is still not the intended visible/grid TP behavior because
  MT5 tickets still show `T/P=0.00000`.
- Freedom's intended behavior:

```text
The EA should set a grid-level TP.
With one trade, that is just the one trade's TP.
As more trades are added, the grid-level TP should move/change so the whole
grid closes at the configured basket/q target.
```

Stop line:

- Do not modify files.
- Do not write code.
- Do not run new MT5 tests.
- Do not optimize.
- Do not open all-28.
- Do not touch Katarakti.
- Do not resurrect Q-state/future-system controls.
- Wait for ChatGPT Pro's code review first.

Allowed work before Pro review returns:

- Answer clarification questions.
- Read code/docs if Freedom asks.
- Summarize the current checkpoint.
- Prepare to compare Pro's findings against repo evidence.

When Pro review returns:

1. Read it carefully.
2. Verify claims against repo source.
3. Produce a short implementation plan.
4. Stop for Freedom approval before coding unless Freedom explicitly authorizes
   the patch.

The next likely gate is a narrow Revma grid TP architecture repair, not TP
survival, all-28 testing, or optimization.
