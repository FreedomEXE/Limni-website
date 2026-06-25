# Limni

Limni is the Poseidon-controlled finance app plus local research and automation
workspace.

The repo is split into two visible lanes:

- public app surfaces that can ship or support the shipped app
- local research/automation surfaces used to verify and build systems before
  promotion

## Root Map

| Path | Purpose |
|---|---|
| `app/` | Next.js app runtime: routes, app libraries, public assets, release evidence, and app config. |
| `engine/` | Local institutional research/backtest engine workspace. Generated data and reports are ignored by default. |
| `automation/` | MT5 assets, bot workers, sentiment scraper, voice helpers, and Playwright automation. |
| `database/` | Database schema, migrations, and data/integration contracts. |
| `docs/` | Durable repo documentation, process docs, architecture, and backlog. |
| `poseidon/` | Project profile and Poseidon control-plane notes. |
| `config/` | Config documentation for files that cannot safely leave root yet. |
| `archive/` | Historical material mirrored by original repo ownership path. |

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

## Forward Local Commands

```bash
npm run engine:research-manifest:evaluate -- --manifest=<manifest.json>
npm run automation:contracts
npm run performance:coverage:check
```

Archived one-off research scripts remain under `archive/` for historical
evidence. Do not add new package scripts for stale gates.

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
- Release evidence and canon: `app/releases/`
- Engine scripts: `engine/scripts/`
- Engine local data: `engine/data/`
- Engine generated reports: `engine/reports/`
- MT5 and bot automation: `automation/`
- Database schema and migrations: `database/`

Release canon JSON under `app/releases/v2/canon/` is frozen unless an explicit
canon gate is approved.
