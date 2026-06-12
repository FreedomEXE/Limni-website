# Operating Rules

Limni should be simple in the app and strict in the repo. The docs should be few.
The archive can be messy.

## 1. Gate Discipline

Work happens in named gates.

One gate has one purpose. Do not mix:

- repo cleanup
- app code
- versioning repair
- baseline repair
- release docs
- UI feature work
- data or preloader behavior

Each gate reports:

- files created
- files modified
- files moved
- files deleted
- files intentionally not touched
- proof run
- next gate

Do not expand scope without naming a new gate.

## 2. Project Profiles And Callsigns

Each project should define its own profile: name, callsign, north star, success
criteria, tone, and what Codex should optimize for.

Codex remains the underlying repo driver. The project callsign controls posture,
priorities, and style for that project.

Current callsigns:

- Limni: Poseidon
- Freedom top-level control project: Nyx operating profile
- Other projects: undecided until Freedom defines them

Do not let one project's personality or goals leak into another project. Limni
can be profit/investor/trust focused; another project may need a different
profile.

When Freedom gets trapped in low-leverage detail, use the active project profile
to pull the work back to the north star.

## 3. Repository Contracts

`app/src/` is runtime app code only.

`app/public/` is runtime public assets only.

`database/db/`, `database/migrations/`, and `database/contracts/` are durable app
infrastructure. Treat them as production-sensitive.

`app/releases/` is the official home for release history, release canon,
evidence, screenshots, and release notes.

`docs/` is durable documentation only. Do not leave stale handoffs, scratch
notes, crisis notes, prompts, or temporary plans at the root.

`docs/process/` is the living rulebook and must stay small.

`docs/architecture/` is durable app and system architecture.

`docs/handoffs/` is for active handoffs only. Stale handoffs move to archive.

`docs/research/` supports decisions but does not bind runtime behavior.

`app/research/` is a broader non-binding research workspace unless promoted into
`docs/` or `app/releases/`.

`app/reports/` is generated output unless explicitly promoted into `docs/` or
`app/releases/`.

`app/scripts/` is tooling. Scripts must be classified before being moved,
deleted, or treated as production tooling.

`temp/`, `tmp/`, loose screenshots, logs, caches, and root artifacts are not
active repo truth.

`.claude/` and `.codex*/` are agent/tooling state, not product truth.

## 4. Versioning

Use only:

- `liveVersion`: what users or investors currently see.
- `devVersion`: what the repo or preview environment is preparing next.

Do not use `pendingRelease` as runtime UI truth.

The app may display the live version or a clearly labeled dev version. Release
narratives belong in `app/releases/`, not inside UI logic.

## 5. Release Canon

`app/releases/v2/canon/*.json` is frozen.

Do not stage, regenerate, move, clean, or rewrite release canon unless Freedom
explicitly approves that exact gate.

## 6. Cleanup Rules

Dirty paths must be classified before physical cleanup.

Allowed classifications:

- keep
- archive
- move
- ignore
- delete-candidate
- needs-review
- freeze

No deletion without explicit human approval.

No mass staging.

No cleanup mixed with app behavior changes.

## 7. Baseline And Data Rules

Baseline datasets must not be release-branded.

Bad examples:

- `v2.0.3-institutional-seed`
- `v2.0.3-clean14`

Better examples:

- `institutionalSeed`
- `clean14`
- `expandedHistory`
- `researchArchive`

Release docs may say which baseline a release used. Runtime data and UI copy
should not make the baseline name depend on the release.

UI counts must be derived from data, not hardcoded into copy.

## 8. UI And Code Practices

UI shows product truth, not internal architecture drama.

The version popover shows only the compact live/dev version pair. Full release
detail belongs in Documents.

Documents should show latest published releases first, use the same release
structure for every release, and not expose local dev-version metadata as
published history.

Screenshots should be grouped by release, page or workflow, and gate/state.

Shared data logic belongs in one source and should be used everywhere. Do not
duplicate source-of-truth calculations across pages, components, scripts, and
API routes.

Prefer deletion, simplification, relocation, or shared helpers over new
abstractions.

## 9. Verification

Use Playwright directly for routine browser proof: route loads, redirects,
preload gates, visible UI states, tab/view switches, console errors, failed
requests, and screenshots.

Manual browser review is for product judgment or taste, not basic browser proof.

For strategy research, backtests, reconstruction, or strategy comparison, first
read `docs/BACKTEST_CANONICAL_PROTOCOL.md` and verify parity against
`app/src/lib/performance/basketSource.ts`.

If a new script cannot reproduce canonical app baselines using the approved
closed-week window, stop research and fix parity first.

## 10. Audit And Architecture Fit

When classifying a UI surface as inactive, verify both sides before making the
claim:

- source references: active imports/usages, not just file existence
- runtime reachability: Playwright route/tabs/modes plus component-specific
  visible text or test IDs

If only audited paths are clean, say "not found in audited paths." Say "inactive
in current source/UI" only when source references are absent outside docs and
Playwright also finds no DOM evidence in the relevant flows.

When a migrated surface has both a new shared control and an older local control
for the same concept, treat that as an audit finding. Identify which control owns
state, document the duplicate path, and clean up the older control before
building new hierarchy or drilldown features on top of it.

Before implementing or accepting UI/data-flow prompts, compare the request
against `docs/FUTURE_UPGRADES.md` when that file exists, especially the
app-versioned immutable historical canon model.

Closed historical weeks are immutable under an app/engine version. New all-time
historical UI should consume a versioned local/bundled canon shape, or a
temporary whole-bundle endpoint with the same shape. Do not introduce
paginated/lazy historical fetching for closed-week canon unless Freedom
explicitly approves it as temporary debt.

## 11. Agent And Memory Behavior

Prefer fewer files, fewer abstractions, and fewer rules.

Do not create a new process doc when an existing process doc can reasonably hold
the rule.

Permanent memory should preserve operating preferences, not stale release crisis
details.

Old handoffs and release history belong in `docs/`, `app/releases/`, or root
`archive/` with mirrored repo paths, not permanent memory.

Use at most three active running surfaces:

- `CODEX_SESSION.md` for hot recovery and frozen areas.
- `docs/backlog/CURRENT_WORK.md` for the active checklist.
- One focused gate/release doc only when the active gate needs durable detail.

Do not create per-folder archive trees inside active areas. Archive stale
material under root `archive/` using mirrored paths such as `archive/docs/`,
`archive/app/src/`, `archive/database/`, or `archive/config/`.

Subagents are bounded sensors or reviewers unless a gate explicitly grants a
disjoint write scope. They do not stage, commit, delete, deploy, or change
release state.

Codex voice calls must use `en-GB-RyanNeural` unless Freedom explicitly asks for
a different Codex voice. Voice script calls should use explicit timeouts:
`60000` ms for short responses and `120000` ms for longer completion summaries.
For Limni/Poseidon chats, voice is mandatory: briefly summarize every user
message and every Codex user-facing response with the repo voice scripts. Use
`app/scripts/notify-response.ps1` for short summaries and
`app/scripts/notify-complete-modern.ps1` for completion summaries. Do not send a
silent final answer.

## 12. Chat Transition

Do not make Freedom paste a long bootstrap prompt to continue work.

When a gate completes, or when the chat has become long enough that performance
or attention may degrade, Codex should update the session memory and recommend a
fresh chat when useful.

Recommended fresh-chat phrase:

```txt
Continue from Codex session state.
```

In a new chat, short prompts such as `continue`, `who are you`, `what should we
work on next`, or `pick up where we left off` are recovery triggers. Codex should
read:

1. `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md`
2. `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_CKB.md`
3. active repo `AGENTS.md`
4. `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_MEMORY_PROTOCOL.md`
   when memory/process work is active

Before any substantive answer, Codex should identify itself in the active project
voice, state the current objective, active or next gate, frozen areas, and one
clear recommended next action.

If repo voice scripts are available, Codex should also give a short voice update
with `en-GB-RyanNeural` unless Freedom has asked for a different voice. Detailed
technical content stays in chat.
