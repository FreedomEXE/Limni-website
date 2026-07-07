# Literature

This folder stores outside research material that may be useful for Limni.

Use this lane for papers and institutional research from firms, universities,
central banks, exchanges, regulators, and other serious research sources.

## Rules

- Keep one source row per downloaded file in `manifest.csv`.
- Prefer public, legal source URLs. Do not bypass paywalls or private access.
- Store original files under `papers/`.
- Store summaries, extracted notes, and relevance comments under `notes/`.
- Do not treat literature as Limni evidence unless a later gate reproduces or
  tests the idea inside our own data and receipt system.
- Keep filenames readable: `YYYY-author-or-institution-short-title.pdf`.

## Manifest Fields

`manifest.csv` tracks:

- `id`: stable short id for the paper.
- `title`: paper or report title.
- `authors_or_institution`: authors, firm, university, or institution.
- `source_url`: original source URL.
- `downloaded_at_utc`: download date/time.
- `local_path`: path under this folder.
- `sha256`: file hash for source integrity.
- `license_or_access_note`: public/open/paywalled/permission note.
- `topic_tags`: short tags such as `volatility`, `fx`, `portfolio`, `execution`.
- `limni_relevance`: one-line reason this belongs here.

