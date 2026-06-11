# Limni

Limni is the Poseidon-controlled finance app for COT bias, strategy research,
performance evidence, automation, and MT5/Bitget/OANDA workflows.

## Root Map

Committed root folders are intentionally few:

| Path | Purpose |
|---|---|
| `app/` | Next.js app, app assets, scripts, services, research, reports, and release evidence. |
| `database/` | Database schema, migrations, and data contracts. |
| `docs/` | Durable repo documentation, process docs, architecture, backlog, and archive. |
| `poseidon/` | Project profile and Poseidon control-plane notes. |
| `config/` | Config documentation for files that cannot safely leave root yet. |

Hidden workflow folders, such as `.github/` and `.husky/`, stay at root because
Git and GitHub discover them there. Local-only artifacts belong under ignored
`Local Environment/`.

Read [docs/REPO_STRUCTURE.md](docs/REPO_STRUCTURE.md) before moving files.

## App Commands

```bash
npm install
npm run dev
npm run build
npm test
```

Open `http://localhost:3000/dashboard` after `npm run dev`.

Focused Performance regression:

```bash
npm test -- app/src/lib/__tests__/engineAdapter.test.ts app/src/lib/__tests__/strategyConfigSelectionNormalization.test.ts app/src/lib/__tests__/tradeDrilldownRoute.test.ts app/src/lib/__tests__/canonWeekShard.test.ts app/src/lib/__tests__/canonClosedWeekDelta.test.ts
```

## Environment

Create `.env` from `.env.example` and keep local secrets out of git.

```bash
copy .env.example .env
```

The root `.env` and `.env.local` files are intentional toolchain anchors because
Next.js and repo scripts read them from the working directory.

## Important Paths

- App source: `app/src/`
- Public app assets: `app/public/`
- App scripts and verification tools: `app/scripts/`
- Automation services: `app/services/`
- Research workspace: `app/research/`
- Generated/evidence reports: `app/reports/`
- Release evidence and canon: `app/releases/`
- Database schema and migrations: `database/`

Release canon JSON under `app/releases/v2/canon/` is frozen unless an explicit
canon gate is approved.
