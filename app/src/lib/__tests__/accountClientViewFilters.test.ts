import { describe, expect, test } from "vitest";
import { filterAccountRows } from "@/lib/accounts/accountClientViewFilters";

const rows = [
  { id: "a", status: "open", searchText: "AUDUSD", sortValue: 2 },
  { id: "b", status: "closed", searchText: "EURUSD", sortValue: -1 },
  { id: "c", status: "open", searchText: "NZDJPY", sortValue: 5 },
];

describe("account client view filters", () => {
  test("filters by status and search", () => {
    expect(
      filterAccountRows({
        rows,
        statusFilter: "open",
        search: "nzd",
        sort: "recent",
      }).map((row) => row.id),
    ).toEqual(["c"]);
  });

  test("sorts by best/worst/oldest", () => {
    expect(
      filterAccountRows({ rows, statusFilter: "all", search: "", sort: "best" }).map(
        (row) => row.id,
      ),
    ).toEqual(["c", "a", "b"]);
    expect(
      filterAccountRows({ rows, statusFilter: "all", search: "", sort: "worst" }).map(
        (row) => row.id,
      ),
    ).toEqual(["b", "a", "c"]);
    expect(
      filterAccountRows({ rows, statusFilter: "all", search: "", sort: "oldest" }).map(
        (row) => row.id,
      ),
    ).toEqual(["c", "b", "a"]);
  });
});
