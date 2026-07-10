# Gate 107C-R-S2 repository preflight

This folder contains repository-only MetaEditor compile receipts. No Strategy
Tester, smoke runner, shard runner, benchmark, or optimization was executed by
Codex.

The accepted pre-check is `repo-compile-log-v3.txt`:

```text
Result: 0 errors, 0 warnings, 197706 ms elapsed, cpu='X64 Regular'
```

`repo-compile-log.txt` and `repo-compile-log-v2.txt` are retained as earlier
clean intermediate compiles. The later v3 receipt supersedes them because it
includes the final identity-only disabled-guard reservation correction.
