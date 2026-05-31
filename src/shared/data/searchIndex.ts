import Fuse from "fuse.js";
import type { Chip } from "../types";

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
  const fuse = new Fuse(rows, {
    keys: ["label", "pinName", "terms"],
    threshold: 0.35,
    ignoreLocation: true
  });

  return {
    search(query: string): SearchResult[] {
      const normalizedQuery = query.trim().toLowerCase();

      if (!normalizedQuery) {
        return [];
      }

      const exactRows = rows.filter((row) =>
        row.terms.some((term) => term.toLowerCase() === normalizedQuery)
      );
      const includeRows = rows.filter(
        (row) =>
          !exactRows.includes(row) &&
          row.terms.some((term) => term.toLowerCase().includes(normalizedQuery))
      );
      const fuzzyRows = fuse.search(query).map((result) => result.item);

      return dedupeRows([...exactRows, ...includeRows, ...fuzzyRows]);
    }
  };
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
        terms: [fn.raw, fn.peripheral, fn.signal, fn.af, ...fn.aliases]
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
