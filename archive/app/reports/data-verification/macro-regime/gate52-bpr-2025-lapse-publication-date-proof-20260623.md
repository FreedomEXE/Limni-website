# Gate 52 BPR 2025 Lapse Publication Date Proof

Date: 2026-06-23

## Status

```txt
PASS_SOURCE_AMBIGUITY_BLOCKED
```

Gate 52 BPR dry-run smoke is accepted as a mechanical source-path pass. BPR
source-governance readiness is still incomplete.

No BPR dataset is authorized for persistence. No `bpr_attribution_v1` join audit
is authorized from this receipt.

## Question

Can the 2025 October and November BPR catch-up reports be consumed without
source ambiguity?

Current answer:

```txt
No. The report pages are present, but exact authoritative public release
timestamps were not found for the 2025-10-07 and 2025-11-04 BPR report dates.
```

## Evidence Sources

- CFTC BPR main page:
  `https://www.cftc.gov/MarketReports/BankParticipationReports/index.htm`
- CFTC BPR release schedule:
  `https://www.cftc.gov/MarketReports/BankParticipationReports/ReleaseSchedule/index.htm`
- CFTC BPR historical special announcements:
  `https://www.cftc.gov/MarketReports/BankParticipationReports/HistoricalSpecialAnnouncements/index.htm`
- October futures report:
  `https://www.cftc.gov/MarketReports/BankParticipation/deaoct25f`
- October options report:
  `https://www.cftc.gov/MarketReports/BankParticipation/deaoct25o`
- November futures report:
  `https://www.cftc.gov/MarketReports/BankParticipation/deanov25f`
- November options report:
  `https://www.cftc.gov/MarketReports/BankParticipation/deanov25o`

## Source Findings

The CFTC BPR main page and release schedule describe the normal cadence as
monthly publication on the first Friday after 3:30 ET, using first-Tuesday data
unless the first Tuesday is a federal holiday.

The CFTC historical special announcement says BPR processing and publication
were interrupted from October 1 through November 12, 2025 due to a lapse in
federal appropriations, and that publication would resume in chronological
order after normal operations returned.

The current CFTC report pages prove that the October and November reports are
present and expose report dates:

- `2025-10-07`
- `2025-11-04`

They do not prove exact public release timestamps for the catch-up reports. The
HTTP `Last-Modified` headers observed during this audit were current page/cache
metadata from 2026-06-23, not original 2025 publication timestamps.

## Classification

| Report date | Normal expected release | Current conservative availability | Exact publication timestamp found | Classification | Promotion eligible |
|---|---:|---:|---:|---|---:|
| 2025-10-07 | 2025-10-10T19:30:00.000Z | 2025-11-19T20:30:00.000Z | false | conservative_not_before_only / source_ambiguous_blocked | false |
| 2025-11-04 | 2025-11-07T20:30:00.000Z | 2025-11-19T20:30:00.000Z | false | conservative_not_before_only / source_ambiguous_blocked | false |

## Gate Decision

```txt
Gate 52 smoke: ACCEPT
Gate 52 source proof: INCOMPLETE
Persisted BPR dataset: NOT AUTHORIZED
BPR attribution: NOT AUTHORIZED
```

The correct source-governance result is fail-closed. The system should keep
`promotionBlockedUntilExactPublicationDateObservations` for the affected
observations unless exact CFTC publication timing is proven or Freedom approves
an explicit conservative policy for promotion.
