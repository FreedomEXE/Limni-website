export type FilterableRowLike = {
  status?: string;
  searchText?: string;
  sortValue?: number;
};

export function filterAccountRows<T extends FilterableRowLike>(options: {
  rows: T[];
  statusFilter: string;
  search: string;
  sort: string;
}) {
  const { rows, statusFilter, search, sort } = options;
  const searchLower = search.toLowerCase();
  const filtered = rows.filter((row) => {
    if (statusFilter !== "all" && row.status && row.status !== statusFilter) {
      return false;
    }
    if (searchLower && row.searchText && !row.searchText.toLowerCase().includes(searchLower)) {
      return false;
    }
    return true;
  });
  if (sort === "best") {
    return [...filtered].sort((a, b) => (b.sortValue ?? 0) - (a.sortValue ?? 0));
  }
  if (sort === "worst") {
    return [...filtered].sort((a, b) => (a.sortValue ?? 0) - (b.sortValue ?? 0));
  }
  if (sort === "oldest") {
    return [...filtered].reverse();
  }
  return filtered;
}
