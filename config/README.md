# Config

Documentation home for repo configuration.

Most config files still stay at root because npm, Next.js, TypeScript, Vercel,
Render, Vitest, Playwright, Git, and GitHub discover them there by default.

Current root config/toolchain anchors include `package.json`, `package-lock.json`,
`tsconfig.json`, `eslint.config.mjs`, `playwright.config.ts`, `vitest.config.ts`,
`vercel.json`, `render.yaml`, `.gitignore`, `.vercelignore`, and `.env.example`.

Move a config file here only when the owning tool and every command path are
updated in the same gate.
