# Research Paper Intake Batch 02 - 2026-07-07

Scope: build the next legal PDF ingestion batch from:

- `docs/literature/papers/limni_remaining_research_paper_links.csv`
- `C:/Users/User/.codex/attachments/06b808b1-8a06-4b28-b28f-b529e5de2332/pasted-text.txt`

## Counts

- Attachment links/snippets received: 169
- Existing CSV rows reviewed: 51
- Combined raw inputs reviewed: 220
- Deduped unique paper candidates after title/source review: 57
- Accepted into `docs/research/papers/sources.csv`: 46
- Raw input snippets/rows not accepted into this batch: 174
- Unique paper candidates skipped because no legal runner-accessible PDF was found: 11
- Rejected non-paper/noise/duplicate raw inputs: 163
- Successful local PDFs after downloader: 46
- Failed accepted rows after correction: 0

## Verification

Commands run:

```powershell
npm run research:papers:ingest -- --dry-run
npm run research:papers:ingest
npm run research:papers:ingest -- --dry-run
npm run research:papers:ingest
```

The first downloader pass produced one failure:

- `Low Latency Trading and the Comovement of Order Flow and Prices` from ABFER returned `HTTP 403 Forbidden`.

Correction:

- Replaced the blocked ABFER URL with the NYU Stern PDF for the fuller paper title:
  `Low Latency Trading and the Comovement of Order Flow, Prices, and Market Conditions`.

Final manifest state:

- `papers_manifest.csv`: 46 rows.
- `papers_manifest.json`: 46 rows.
- `sources.csv`: 46 rows.
- `docs/research/papers/pdf/`: 46 local PDF files.
- PDF magic/hash/size validation: 46 of 46 passed.
- Text extraction: 46 rows marked `EXTRACTOR_NOT_FOUND` because `pdftotext` is not installed.

PDF files remain local-only under `docs/research/papers/pdf/`; they are ignored by Git unless Git LFS is explicitly configured and approved.

## Accepted From the 169-Link List That Were Missing or Not Safely Covered by the 51-Row CSV

- `High-Frequency Trading in a Limit Order Book`
- `Value and Momentum Everywhere`
- `Carry Trades and Currency Crashes`
- `Common Risk Factors in Currency Markets`
- `Understanding Alternative Risk Premia`
- `Investing With Style`
- `The Probability of Backtest Overfitting`
- `The Deflated Sharpe Ratio: Correcting for Selection Bias, Backtest Overfitting and Non-Normality`
- `The Three Types of Backtests`
- `Optimal Execution of Portfolio Transactions`

## Skipped Paper Candidates

These appear to be real or research-adjacent paper candidates, but were not ingested because no legal PDF worked with the repo runner or the available PDF was not from a source suitable for this intake.

- `Portfolio Selection` - Wiley PDF blocked; non-author mirror found but not used.
- `Markowitz's Portfolio Selection: A Fifty-Year Retrospective` - Wiley PDF blocked; non-author mirror not used.
- `Data-Snooping, Technical Trading Rule Performance, and the Bootstrap` - DOI/RePEc/Wiley source; no suitable legal direct PDF found for runner.
- `Backtest Overfitting in the Machine Learning Era` - SSRN-only route returned `403 Forbidden` to Node fetch.
- `Risk Parity Portfolio Optimization under Heavy-Tailed Returns and Time-Varying Volatility` - SSRN-only route returned `403 Forbidden` to Node fetch.
- `Optimal Liquidation` - SSRN-only route returned `403 Forbidden`; Almgren-Chriss `Optimal Execution of Portfolio Transactions` was ingested instead.
- `Optimal Execution Horizon` - SSRN/Wiley routes unavailable without blocked source-page access.
- `Time-Series Momentum: Is It There?` - SMU source returned an Incapsula HTML challenge; SSRN route blocked.
- `Time Series Momentum Implemented` - CBS PDF returned `403 Forbidden` to Node fetch.
- `Hierarchical Risk Parity (HRP) and Modified HRP Against Traditional Methods` - CBS PDF returned `403 Forbidden` to Node fetch.
- `Optimal Trade Execution under Stochastic Volatility and Liquidity` - Princeton OAR returned `401`; no legal runner-accessible PDF found.

## Rejected Source Classes

Rejected classes included:

- Wikipedia and general encyclopedia pages.
- Currency converters, job sites, company/person pages, social media, and search/profile pages.
- Ordinary blogs, Q&A posts, GitHub project repos, YouTube, Reddit, Medium, StackExchange, Scribd, CourseHero, Amanote, and ResearchGate request pages.
- Slides, lecture notes, book excerpts, and general explanatory material when they were not being treated as firm/institution research papers.
- Duplicate search snippets for papers already represented by better legal PDF sources.
