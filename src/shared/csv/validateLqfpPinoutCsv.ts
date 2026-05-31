import { parse } from "csv-parse/sync";
import type { ValidationResult } from "./validateManifest";

const VALID_PIN_TYPES = new Set(["gpio", "power", "ground", "reset", "clock", "boot", "nc"]);

type LqfpPinoutRow = {
  PadNumber?: string;
  PinName?: string;
  PinType?: string;
};

export function validateLqfpPinoutCsvText(csvText: string, totalPads: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let rows: LqfpPinoutRow[];

  try {
    rows = parse(csvText, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as LqfpPinoutRow[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { errors: [`LQFP pinout CSV could not be parsed: ${message}`], warnings };
  }

  const padNumbers = new Set<number>();
  for (const [index, row] of rows.entries()) {
    const lineNumber = index + 2;
    const padNumber = Number(row.PadNumber);

    if (!Number.isInteger(padNumber) || padNumber < 1 || padNumber > totalPads) {
      errors.push(`Line ${lineNumber} PadNumber must be an integer from 1 to ${totalPads}.`);
    } else {
      padNumbers.add(padNumber);
    }

    if (!row.PinName) {
      errors.push(`Line ${lineNumber} must have PinName.`);
    }

    if (row.PinType && !VALID_PIN_TYPES.has(row.PinType)) {
      warnings.push(`Line ${lineNumber} PinType ${row.PinType} is unknown.`);
    }
  }

  if (padNumbers.size !== totalPads) {
    errors.push(`PadNumber must cover every value from 1 to ${totalPads}.`);
  }

  return { errors, warnings };
}
