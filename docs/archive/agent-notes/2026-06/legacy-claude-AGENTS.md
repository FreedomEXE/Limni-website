# Agent Configuration — Limni Website

> This file applies to **any AI agent** working in this repository (Claude, Codex, Cursor, Copilot, etc.).
> Read this entire file before writing a single line of code.

## Project Context

Limni Labs — multi-asset trading intelligence platform.
Stack: Next.js 16 (App Router), React 19, TypeScript, PostgreSQL, Tailwind CSS 4, Luxon, Vitest.
Deploy: Vercel (frontend + crons), Render (worker bots).

---

## Design & Engineering Quality Bar

### 1. No AI Slop. Ever.

- No generic "AI aesthetic" — soft gradients + glassmorphism + pastel blobs + floating cards with no hierarchy.
- No Dribbble-copy layouts, default Tailwind stacks, or template-looking dashboards.
- No visual noise. No ornamental fluff without purpose.
- Every design decision must have intent.

### 2. Original, Opinionated Design

- Be bold. Take creative risks when appropriate.
- Develop a strong visual concept before laying out components.
- Design systems should feel **authored**, not assembled.
- Use typography intentionally (scale, rhythm, contrast).
- Prioritize hierarchy, whitespace, alignment, and restraint.
- Limit color palettes. Use contrast strategically.
- Design for clarity first, beauty second — then refine until both exist.

### 3. Ask When Unclear

- If product goals, constraints, or audience are ambiguous → ask clarifying questions.
- Never guess core requirements.
- Never proceed with shallow assumptions.

### 4. Systems Thinking

- Think in systems, not pages.
- Define spacing scale, type scale, color tokens, and interaction patterns.
- Ensure consistency across states (hover, focus, error, empty, loading).
- Design edge cases (empty states, errors, long content, extreme data).

### 5. UX Over Decoration

- Optimize for usability, accessibility, and clarity.
- Follow accessibility best practices (contrast, keyboard nav, semantics).
- Remove friction before adding flourish.
- Micro-interactions should enhance feedback, not distract.

---

## Engineering Standards

### 6. Modular Architecture

- Prefer reusable components over repetition.
- Abstract patterns early if reused twice.
- Separate concerns (UI, logic, data, state).
- No monolithic files.
- Design for future extension.

### 7. Clean, Future-Proof Code

- Use clear naming.
- Avoid premature optimization, but prevent technical debt.
- No hardcoded magic values — use tokens/constants.
- Avoid deeply nested logic.
- Refactor obvious duplication immediately.

### 8. Scalability Mindset

- Assume the product will grow.
- Build extensible component APIs.
- Make styling themeable where reasonable.
- Avoid coupling UI to static data structures.

### 9. Performance & Quality

- Avoid unnecessary renders.
- Lazy load when appropriate.
- Optimize assets.
- Keep bundle size in mind.

---

## Craft Standard

> If it feels generic, it is.
> If it looks like something you've seen 100 times, rethink it.
> If it could be simpler, simplify it.
> If it could be clearer, clarify it.
> **Quality > speed. Taste matters.**

---

## Code Quality Standards

1. **Diagnose Before Coding** — investigate and explain root cause first.
2. **Design Before Implementation** — provide a design proposal, wait for approval.
3. **Stop After Two Failed Attempts** — investigate properly, then simplify or abandon.
4. **Prefer Simple Over Clever** — boring and obvious beats clever and fragile.
5. **No Patches on Patches** — roll back and try a different approach.
6. **Production-Level Code Only** — no temporary solutions or TODOs.
7. **Ask Before Doing If Confused** — don't blindly follow; suggest better approaches.

---

## File Header Standard

**Every code file** must include this header (adapt year and description):

```
/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: example.ts
 *
 * Description:
 * High-level description — what it does, what it connects to, what it's for.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
```

- Year should always reflect the current year.
- Description should be meaningful, not boilerplate.
- If modifying an existing file without this header, add it.

---

## Documentation Protocol

- **Extensive documentation is MANDATORY** for anything that would benefit from it.
- If docs don't exist for a system/feature and they should — create them proactively.
- Bot strategies, architecture decisions, data pipelines, and API integrations must all have dedicated docs.
- Keep docs in `docs/` folder, organized by domain (e.g., `docs/bots/`, `docs/api/`, `docs/architecture/`).
- On every major git push, create or update a changelog entry in `docs/` summarizing what changed and why.

---

## Timezone Policy

- All user-facing dates/times must be displayed in Eastern Time using `America/New_York` (Toronto/New York market time).
- Do not use local machine/browser timezone defaults for UI timestamps.
- Prefer shared format helpers in `src/lib/time.ts` (`formatDateET`, `formatTimeET`, `formatDateTimeET`) for consistency.
- If showing timezone text, use `ET`.

---

## Process Safety

**NEVER kill processes broadly — this can terminate your own connection!**

- Never use `pkill node`, `killall node`, `taskkill /IM node.exe /F`.
- Always identify the specific PID first, then kill by PID only.
- Use `netstat -ano | findstr :PORT` to find the right process.

---

## Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm test             # Vitest
npm run db:migrate   # Run migrations
npm run bot:bitget   # Start Bitget bot (v2)
```

---

## Tool & Capability Awareness (AIQ Protocol)

**Always think about what tools, skills, MCP servers, or sub-agents could improve your output.**

- Before starting any non-trivial task, consider: is there an MCP server, skill, plugin, or external tool that would produce better results or save time?
- If you have access to MCP servers (database, browser, file system, API tools, etc.) — use them. Don't manually replicate what a tool can do better.
- If a sub-agent or specialist model would produce higher quality output for a subtask — delegate to it.
- If you discover a tool/skill that works well, note it so it can be configured permanently.
- If something doesn't work or produces poor results, flag it for removal.
- **The goal is to one-shot tasks.** Use every capability at your disposal to get it right the first time.
- Think of this as your "AIQ" — your ability to intelligently leverage the full toolkit available to you, not just raw intelligence.

---

## Working With Freedom

- The project owner is **Freedom** (Freedom_EXE).
- Freedom values directness, quality, and original thinking.
- Don't be a yes-agent — push back when you see a better way.
- Deliver institutional-grade work. This is a trading platform handling real capital.
- When in doubt, ask. When confident, execute decisively.
