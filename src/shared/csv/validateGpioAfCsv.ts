import { parse } from "csv-parse/sync";
import type { ValidationResult } from "./validateManifest";

const AF_HEADERS = Array.from({ length: 16 }, (_, index) => `AF${index}`);

export function validateGpioAfCsvText(csvText: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rows = parse(csvText, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true
  }) as string[][];

  if (rows.length === 0) {
    return { errors: ["GPIO AF CSV must contain a header row."], warnings };
  }

  const header = rows[0];
  if (header[0] !== "PinName") {
    errors.push("GPIO AF CSV header must start with PinName.");
  }

  const expected = ["PinName", ...AF_HEADERS];
  if (header.join(",") !== expected.join(",")) {
    errors.push(`GPIO AF CSV header must be exactly ${expected.join(",")}.`);
  }

  const pinNames = new Set<string>();
  for (const [index, row] of rows.slice(1).entries()) {
    const lineNumber = index + 2;
    const pinName = row[0];
    if (!/^P[A-Z][0-9]+$/.test(pinName)) {
      warnings.push(`Line ${lineNumber} pin name ${pinName} does not match GPIO pattern P<port><number>.`);
    }
    if (pinNames.has(pinName)) {
      errors.push(`Duplicate pin name ${pinName}.`);
    }
    pinNames.add(pinName);
  }

  return { errors, warnings };
}
