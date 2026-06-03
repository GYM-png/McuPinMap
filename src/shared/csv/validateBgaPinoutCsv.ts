import { parse } from "csv-parse/sync";
import type { ValidationResult } from "./validateManifest";
import { parseBgaBallName, VALID_PIN_TYPES } from "./bgaPinout";

type BgaPinoutRow = {
  BallName?: string;
  PinName?: string;
  PinType?: string;
};

export function validateBgaPinoutCsvText(csvText: string, totalPads: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let rows: BgaPinoutRow[];

  try {
    rows = parse(csvText, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as BgaPinoutRow[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { errors: [`BGA pinout CSV could not be parsed: ${message}`], warnings };
  }

  const ballNames = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const lineNumber = index + 2;
    const parsedBall = row.BallName ? parseBgaBallName(row.BallName) : undefined;

    if (!parsedBall) {
      errors.push(`Line ${lineNumber} BallName must look like A1 or AA12.`);
    } else if (ballNames.has(parsedBall.ballName)) {
      errors.push(`Duplicate BallName ${parsedBall.ballName}.`);
    } else {
      ballNames.add(parsedBall.ballName);
    }

    if (!row.PinName) {
      errors.push(`Line ${lineNumber} must have PinName.`);
    }

    if (!row.PinType) {
      errors.push(`Line ${lineNumber} must have PinType.`);
    } else if (!VALID_PIN_TYPES.has(row.PinType)) {
      errors.push(`Line ${lineNumber} PinType ${row.PinType} is unknown.`);
    }
  }

  if (rows.length !== totalPads) {
    errors.push(`BGA pinout must contain ${totalPads} ball(s).`);
  }

  return { errors, warnings };
}
