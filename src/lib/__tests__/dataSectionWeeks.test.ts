import { describe, expect, it } from "vitest";

import {
  listActiveDataSectionSelectableWeekEntries,
  listActiveDataSectionWeekEntries,
} from "@/lib/dataSectionWeeks";

describe("Data section active weeks", () => {
  it("keeps the live source week selectable without adding it to closed baseline entries", () => {
    const currentWeekOpenUtc = "2026-06-07T23:00:00.000Z";

    const closedEntries = listActiveDataSectionWeekEntries(currentWeekOpenUtc);
    const selectableEntries = listActiveDataSectionSelectableWeekEntries({
      currentWeekOpenUtc,
      closedCurrentWeekOpenUtc: currentWeekOpenUtc,
    });

    expect(closedEntries.map((entry) => entry.weekOpenUtc)).not.toContain(currentWeekOpenUtc);
    expect(selectableEntries[0]).toEqual({
      weekOpenUtc: currentWeekOpenUtc,
      cotReportDate: "2026-06-02",
    });
    expect(selectableEntries.map((entry) => entry.weekOpenUtc)).toContain("2026-05-31T23:00:00.000Z");
  });
});
