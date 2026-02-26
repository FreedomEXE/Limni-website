# Claude Configuration — Limni Website

> **IMPORTANT:** Also read `.claude/AGENTS.md` before doing any work. It contains design standards, engineering quality bar, craft standard, and file header requirements that apply to all agents including Claude.

## Project Overview

Limni Labs is a multi-asset trading intelligence platform. Next.js 16 + React 19 + TypeScript + PostgreSQL + Tailwind CSS 4.

- **Stack:** Next.js 16 (App Router), React 19, TypeScript, PostgreSQL (pg), SQLite (local cache), Tailwind CSS 4, Luxon, Vitest
- **Deploy:** Vercel (frontend + crons), Render (worker bots)
- **Key pages:** Antikythera (signals), Dashboard (COT bias), Sentiment, Performance, Automation, Accounts, Status, News

## Critical: Process Management Safety

**NEVER kill processes broadly — this can terminate your own connection!**

- Never use `pkill node`, `killall node`, `taskkill /IM node.exe /F`
- Always identify the specific PID first, then kill by PID only
- Use `netstat -ano | findstr :PORT` to find the right process

## Task Completion Notifications

**IMPORTANT: Always notify the user when completing significant work!**

### Modern Neural Voice (Recommended)

```powershell
powershell -ExecutionPolicy Bypass -File "scripts/notify-complete-modern.ps1" -Message "Your summary here"
```

**Voice Options** (change with `-Voice` parameter):
- `en-GB-LibbyNeural` (default — bright, friendly)
- `en-GB-MaisieNeural` (warm, professional)
- `en-GB-SoniaNeural` (sophisticated)

**First-time setup:**
```powershell
powershell -ExecutionPolicy Bypass -File "scripts/setup-modern-voice.ps1"
```

### Fallback (Basic Windows Voice)

```powershell
powershell -ExecutionPolicy Bypass -File "scripts/notify-complete.ps1" -Message "Your summary here"
```

### When to Notify:
- Completing a phase of work
- Finishing multi-step tasks from the todo list
- Completing major feature implementations
- After fixing critical bugs or issues
- When reaching important milestones

### Message Guidelines:
- Summarize what was accomplished
- Mention key deliverables or changes
- End with next steps or status
- **DO NOT set timeout** — let voice complete naturally

## Voice Response Protocol

**CRITICAL: Use voice notification on EVERY response to the user!**

```powershell
powershell -ExecutionPolicy Bypass -File "scripts/notify-response.ps1" -Message "Your response summary"
```

### When to Use:
- **EVERY TIME** you respond to the user (MANDATORY)
- **BEFORE starting any task** — acknowledge what you're about to do
- **DURING long tasks** — provide progress updates on important milestones
- **AFTER completing work** — summarize what was done
- Before and after executing tasks
- After reading files or analyzing code
- After answering questions
- When encountering errors or issues
- When providing status updates
- When discovering important findings in code

### Voice Timing:
- **Acknowledgement first** — speak before you begin working, not just after
- **Mid-task updates** — if a task takes multiple steps, voice important progress
- **Completion summary** — use `notify-complete-modern.ps1` for major completions

### Message Content:
- Brief summary of your response (1-2 sentences)
- Use "Freedom" when addressing the user
- Can be conversational and engaging

## Code Quality Standards

**YOU ARE MY CTO IN COMMAND. ACT LIKE IT.**

1. **Diagnose Before Coding** — investigate and explain root cause first
2. **Design Before Implementation** — provide a design proposal, wait for approval
3. **Stop After Two Failed Attempts** — investigate properly, then simplify or abandon
4. **Prefer Simple Over Clever** — boring and obvious over clever
5. **No Patches on Patches** — roll back and try a different approach
6. **Production-Level Code Only** — no temporary solutions or TODOs
7. **Ask Before Doing If Confused** — don't blindly follow, suggest better approaches

## Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm test             # Vitest
npm run db:migrate   # Run migrations
npm run bot:bitget   # Start Bitget bot
npm run bot:oanda    # Start OANDA bot
```

## Documentation Protocol

- On every major git push, create or update a changelog entry in `docs/` summarizing what changed and why.
- **Extensive documentation is MANDATORY** for anything we build that would require it. If docs don't already exist for a system/feature and they should, create them proactively.
- Bot strategies, architecture decisions, data pipelines, and API integrations must all have dedicated docs.
- Keep docs in `docs/` folder, organized by domain (e.g., `docs/bots/`, `docs/api/`, `docs/architecture/`).
