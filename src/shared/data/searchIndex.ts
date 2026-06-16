import type { Chip, PinFunction } from "../types";

export type SearchResultKind = "pin" | "function" | "peripheral";

export type SearchResult = {
  kind: SearchResultKind;
  pinName: string;
  label: string;
};

type SearchRow = SearchResult & {
  terms: string[];
};

export type SearchIndex = {
  search(query: string): SearchResult[];
};

export function createSearchIndex(chip: Chip): SearchIndex {
  const rows = buildSearchRows(chip);

  return {
    search(query: string): SearchResult[] {
      const normalizedQuery = query.trim();
      const normalizedQueryLower = normalizedQuery.toLowerCase();

      if (!normalizedQuery) {
        return [];
      }

      const exactRows = rows.filter((row) =>
        row.terms.some((term) => isExactTermMatch(term, normalizedQueryLower))
      );
      const exactPinNameRows = exactRows.filter((row) =>
        isExactPinNameMatch(row, normalizedQueryLower)
      );
      if (exactPinNameRows.length > 0) {
        return dedupeRows(exactPinNameRows);
      }

      const prefixRows = rows.filter(
        (row) =>
          !exactRows.includes(row) &&
          row.terms.some((term) => isPrefixTermMatch(term, normalizedQueryLower))
      );

      return dedupeRows([...exactRows, ...prefixRows]);
    }
  };
}

export function matchesFunctionSearchQuery(
  fn: PinFunction,
  query: string,
  pinName?: string
): boolean {
  const normalizedQuery = query.trim();
  const normalizedQueryLower = normalizedQuery.toLowerCase();

  if (!normalizedQuery) {
    return false;
  }

  if (pinName && pinName.toLowerCase() === normalizedQueryLower) {
    return false;
  }

  return getFunctionSearchTerms(fn).some(
    (term) =>
      isExactTermMatch(term, normalizedQueryLower) ||
      isPrefixTermMatch(term, normalizedQueryLower)
  );
}

function buildSearchRows(chip: Chip): SearchRow[] {
  const rows: SearchRow[] = [];

  for (const pin of chip.pins) {
    rows.push({
      kind: "pin",
      pinName: pin.name,
      label: pin.name,
      terms: [pin.name, pin.port, String(pin.number)]
    });

    for (const fn of pin.functions) {
      rows.push({
        kind: "function",
        pinName: pin.name,
        label: fn.raw,
        terms: getFunctionSearchTerms(fn)
      });
      rows.push({
        kind: "peripheral",
        pinName: pin.name,
        label: fn.peripheral,
        terms: [fn.peripheral, fn.raw, fn.signal, ...fn.aliases]
      });
    }
  }

  return rows;
}

function getFunctionSearchTerms(fn: PinFunction): string[] {
  return [fn.raw, fn.peripheral, fn.signal, fn.af, ...fn.aliases];
}

function isExactTermMatch(term: string, normalizedQueryLower: string): boolean {
  return term.toLowerCase() === normalizedQueryLower;
}

function isPrefixTermMatch(term: string, normalizedQueryLower: string): boolean {
  return term.toLowerCase().startsWith(normalizedQueryLower);
}

function isExactPinNameMatch(row: SearchRow, normalizedQueryLower: string): boolean {
  return row.kind === "pin" && row.pinName.toLowerCase() === normalizedQueryLower;
}

function dedupeRows(rows: SearchRow[]): SearchResult[] {
  const seen = new Set<string>();
  const results: SearchResult[] = [];

  for (const row of rows) {
    const key = `${row.kind}\u0000${row.pinName}\u0000${row.label}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push({
      kind: row.kind,
      pinName: row.pinName,
      label: row.label
    });
  }

  return results;
}
