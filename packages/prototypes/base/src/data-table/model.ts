export type DataRecord = Readonly<Record<string, string | number | boolean | null>> &
  Readonly<{ id: string }>;
export type SortDirection = 'none' | 'ascending' | 'descending';
export function dataView(
  rows: readonly DataRecord[],
  options: {
    sortKey?: string;
    sortDirection?: SortDirection;
    filter?: string;
    page?: number;
    pageSize?: number;
  } = {}
): { rows: DataRecord[]; filteredCount: number; pageCount: number; page: number } {
  if (
    rows.some((row) => typeof row.id !== 'string' || !row.id) ||
    new Set(rows.map((row) => row.id)).size !== rows.length
  )
    throw new Error('Data table records require unique non-empty id');
  const query = (options.filter ?? '').trim().toLocaleLowerCase();
  let result = rows
    .map((row, index) => ({ row, index }))
    .filter(
      ({ row }) =>
        !query ||
        Object.values(row).some((value) =>
          String(value ?? '')
            .toLocaleLowerCase()
            .includes(query)
        )
    );
  if (options.sortKey && options.sortDirection !== 'none') {
    const key = options.sortKey,
      sign = options.sortDirection === 'descending' ? -1 : 1;
    result.sort((a, b) => {
      const x = a.row[key],
        y = b.row[key];
      const compare =
        x == null
          ? y == null
            ? 0
            : 1
          : y == null
            ? -1
            : typeof x === 'number' && typeof y === 'number'
              ? x - y
              : String(x).localeCompare(String(y));
      return compare * sign || a.index - b.index;
    });
  }
  const filteredCount = result.length,
    size = Math.max(1, Math.trunc(Number.isFinite(options.pageSize) ? options.pageSize! : 10)),
    pageCount = Math.max(1, Math.ceil(filteredCount / size)),
    page = Math.max(
      0,
      Math.min(pageCount - 1, Math.trunc(Number.isFinite(options.page) ? options.page! : 0))
    );
  return {
    rows: result.slice(page * size, (page + 1) * size).map(({ row }) => row),
    filteredCount,
    pageCount,
    page,
  };
}
