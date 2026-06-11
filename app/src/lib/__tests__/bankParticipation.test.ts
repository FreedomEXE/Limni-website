import { describe, expect, test } from "vitest";
import {
  buildBankMarketBiasByAsset,
  deriveBankPairs,
  extractBankReportLinks,
  parseBankReportHtml,
  selectBankReportForDate,
  type BankReport,
} from "@/lib/research/bankParticipation";

const SAMPLE_INDEX = `
<a href="/MarketReports/BankParticipation/deafeb26f">Feb 2026 Futures</a>
<a href="/MarketReports/BankParticipation/deafeb26o">Feb 2026 Options</a>
<a href="/MarketReports/BankParticipation/deajan26f">Jan 2026 Futures</a>
<a href="/MarketReports/BankParticipation/deadec25f">Dec 2025 Futures</a>
`;

const SAMPLE_REPORT_HTML = `
<table>
  <tr><td>REPORT DATE: 1/6/2026</td></tr>
  <tr>
    <td>COMMODITY</td><td>BANK TYPE</td><td>BANK COUNT</td>
    <td>LONG FUTURES</td><td>%</td><td>SHORT FUTURES</td><td>%</td><td>OPEN INTEREST</td>
  </tr>
  <tr>
    <td>CME EURO FX</td><td>U.S.</td><td>6</td><td>130,000</td><td>1.0</td><td>70,000</td><td>1.0</td><td>500,000</td>
  </tr>
  <tr>
    <td>&nbsp;</td><td>NON U.S.</td><td>12</td><td>20,000</td><td>1.0</td><td>10,000</td><td>1.0</td><td>&nbsp;</td>
  </tr>
  <tr>
    <td>CME USD INDEX</td><td>U.S.</td><td>4</td><td>10,000</td><td>1.0</td><td>100,000</td><td>1.0</td><td>500,000</td>
  </tr>
  <tr>
    <td>&nbsp;</td><td>NON U.S.</td><td>8</td><td>2,000</td><td>1.0</td><td>8,000</td><td>1.0</td><td>&nbsp;</td>
  </tr>
</table>
`;

describe("bank participation research helpers", () => {
  test("extracts and sorts futures report links", () => {
    expect(extractBankReportLinks(SAMPLE_INDEX, "f")).toEqual([
      "https://www.cftc.gov/MarketReports/BankParticipation/deafeb26f",
      "https://www.cftc.gov/MarketReports/BankParticipation/deajan26f",
      "https://www.cftc.gov/MarketReports/BankParticipation/deadec25f",
    ]);
  });

  test("parses bank monthly report rows", () => {
    const parsed = parseBankReportHtml(
      SAMPLE_REPORT_HTML,
      "https://www.cftc.gov/MarketReports/BankParticipation/deajan26f",
    );
    expect(parsed.report_date).toBe("2026-01-06");
    expect(parsed.markets).toHaveLength(2);
    expect(parsed.markets[0]).toMatchObject({
      commodity: "CME EURO FX",
      us: { long: 130000, short: 70000 },
      nonUs: { long: 20000, short: 10000 },
    });
  });

  test("selects latest bank report not newer than a weekly report date", () => {
    const reports: BankReport[] = [
      { source_url: "a", report_date: "2025-12-02", markets: [] },
      { source_url: "b", report_date: "2026-01-06", markets: [] },
      { source_url: "c", report_date: "2026-02-03", markets: [] },
    ];
    expect(selectBankReportForDate(reports, "2026-01-24")?.report_date).toBe("2026-01-06");
    expect(selectBankReportForDate(reports, "2025-11-30")).toBeNull();
  });

  test("builds directional and contrarian FX pair signals from bank rows", () => {
    const parsed = parseBankReportHtml(SAMPLE_REPORT_HTML, "x");
    const directionalBias = buildBankMarketBiasByAsset(parsed, "fx", "directional");
    const directionalPairs = deriveBankPairs("fx", directionalBias);
    expect(directionalPairs.EURUSD?.direction).toBe("LONG");

    const contrarianBias = buildBankMarketBiasByAsset(parsed, "fx", "contrarian");
    const contrarianPairs = deriveBankPairs("fx", contrarianBias);
    expect(contrarianPairs.EURUSD?.direction).toBe("SHORT");
  });
});
