# Next Chat Prompt - Gate 101 Revma Mean-Reversion Lockdown

You are working inside the Limni/Poseidon repo.

Repo:
`C:/Users/User/Documents/GitHub/limni-website`

Branch at handoff time:
`codex/gate88-mt5-lifecycle-protection-controls`

Gate status:

- Gate 99 is closed as a local implementation checkpoint.
- Gate 100 is research-only and is being handled separately.
- Gate 101 is the next implementation gate.
- Do not continue extending Gate 99 through more alphabet suffixes.

Recovery order:

1. Read `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md`.
2. Read `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_CKB.md`.
3. Read `AGENTS.md`.
4. Read `automation/mt5/README.md`.
5. Run `git status --branch --short` and verify live branch/worktree truth.

Current checkpoint:

- Revma reversion works only "okay" and still needs future logic work.
- Revma continuation inside Revma is rejected.
- Gate 99ZZG added broker-visible grid TP sync, dashboard centerline cleanup,
  sleeve-specific controls with generic inheritance, and a round-trip fee
  estimate for tiny TP targets.
- Latest compile/sync before this handoff reported `0 errors, 0 warnings` for:
  - repo `automation/mt5/Experts/Limni/LimniPortfolioEA.mq5`
  - terminal `14275...`
  - terminal `94497...`
- Freedom handles MT5 runtime verification unless explicitly asking Codex to run
  tests.

Gate 101 scope:

```text
Gate 101 - Revma Mean-Reversion Lockdown
```

1. Revma becomes mean-reversion only.
2. Remove continuation logic from Revma.
3. Either park continuation code under dormant Kyma or delete it.
4. Kyma must not be registered, exposed, or executable yet.
5. Compile.
6. Run one-pair Revma smoke only if Freedom authorizes testing.
7. Prove no Revma CONTINUATION receipts remain.

Pass label:

```text
Gate 101 compile + one-pair behavior pass
```

Not in scope:

- Edge proof.
- All-28.
- Kyma implementation.
- Optimization.
- More Revma continuation patching.
- Katarakti.
- Q-state/future-system controls.

Architecture direction:

```text
Revma = mean-reversion strategy only.
Kyma = future continuation strategy.
```

Inputs, strategy logic, receipts, lifecycle, and dashboard terms must become
strategy-specific. Do not keep mixed Revma/Kyma ownership hidden behind generic
Revma sleeve controls.

Gate discipline rule:

Once a gate has run through the alphabet once, wrap it and move to the next
numbered gate. Small gates, clear pass/fail, move forward.
