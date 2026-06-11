# Config

Target home for movable repo configuration and config documentation.

Many config files must remain at repo root because tools discover them there by
default:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `next.config.ts`
- `eslint.config.mjs`
- `playwright.config.ts`
- `vitest.config.ts`
- `postcss.config.mjs`
- `vercel.json`
- `render.yaml`
- `.gitignore`
- `.env.example`

Move config files here only when the owning tool supports that location and the
command/deployment path is updated in the same gate.

Do not move `package.json` or `package-lock.json` as simple cleanup. npm, Next,
Vercel, Render, and GitHub Actions all discover them from repo root today.
