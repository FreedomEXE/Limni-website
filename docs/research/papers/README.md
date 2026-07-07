# Limni Research Paper Ingestion

This folder is the repo-native intake lane for Revma/q/inventory/market-making,
execution, portfolio-risk, and research-discipline papers.

The pipeline stores source metadata and manifests in Git, but keeps downloaded
PDF files local unless Git LFS is explicitly configured for this repo.

## Files

- `sources.csv` - input ledger. Add one row per paper or source.
- `papers_manifest.csv` - generated machine-readable download manifest.
- `papers_manifest.json` - generated JSON copy of the manifest.
- `pdf/` - local downloaded PDFs. Ignored by Git by default.
- `text/` - extracted text sidecars when a local extractor is available.

## Source CSV Fields

```csv
id,title,authors,year,doi,arxiv,url,source_type,notes
```

Use stable lowercase ids such as `2014-bailey-lopezdeprado-deflated-sharpe`.
If an arXiv id exists, put it in `arxiv`. If a DOI exists, put it in `doi`.
If the only source is a landing page, put it in `url` and set `source_type` to
`WEB_SOURCE`.

## Running

```powershell
npm run research:papers:ingest -- --dry-run
npm run research:papers:ingest -- --limit=20 --unpaywall-email=you@example.com
```

Unpaywall requires an email address. Use `--unpaywall-email=...` or set
`UNPAYWALL_EMAIL`.

The downloader:

- prefers official direct PDFs;
- uses official arXiv PDFs when an arXiv id is present;
- queries Unpaywall and OpenAlex for legal OA PDF URLs when a DOI is present;
- scans source landing pages for explicit `.pdf` links;
- rejects tiny or malformed files;
- validates `%PDF-` magic bytes;
- computes SHA256 hashes;
- records status and failure reasons.

It does not bypass paywalls and must not use Sci-Hub, LibGen, Z-Library, or
other piracy sources.

## Text Extraction

The script writes `text/{id}.txt` when `pdftotext` is available locally.
If `pdftotext` is not installed, the manifest marks:

```text
extraction_status=EXTRACTOR_NOT_FOUND
```

Install Poppler for Windows if text sidecars are required.

## Git LFS Boundary

Git LFS is installed on this machine, but this repo does not currently track
PDFs with LFS. Until that changes, `pdf/*.pdf` remains ignored and local-only.

If Freedom chooses to version PDFs later, configure LFS first:

```powershell
git lfs track "docs/research/papers/pdf/*.pdf"
git add .gitattributes
```

Only after that should PDFs be staged.
