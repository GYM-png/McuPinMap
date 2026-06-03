import { parse } from "csv-parse/sync";
import type { PackageLayout, PackagePin, PinType } from "../types";
import { compareBgaBalls, parseBgaBallName, parseBgaPackageName, VALID_PIN_TYPES } from "./bgaPinout";

type BgaPinoutRecord = {
  BallName?: string;
  PinName?: string;
  PinType?: string;
};

export function parseBgaPinoutCsvText(csvText: string, packageName: string): PackageLayout {
  const totalPads = parseBgaPackageName(packageName);
  const records = parse(csvText, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as BgaPinoutRecord[];

  const balls = new Set<string>();
  const pins = records
    .map((record, index): PackagePin => {
      const lineNumber = index + 2;
      const parsedBall = record.BallName ? parseBgaBallName(record.BallName) : undefined;
      if (!parsedBall) {
        throw new Error(`Line ${lineNumber} BallName must look like A1 or AA12.`);
      }

      if (balls.has(parsedBall.ballName)) {
        throw new Error(`Duplicate BallName ${parsedBall.ballName}.`);
      }
      balls.add(parsedBall.ballName);

      if (!record.PinName) {
        throw new Error(`Line ${lineNumber} must have PinName.`);
      }

      if (!record.PinType) {
        throw new Error(`Line ${lineNumber} must have PinType.`);
      }

      if (!VALID_PIN_TYPES.has(record.PinType)) {
        throw new Error(`Line ${lineNumber} PinType ${record.PinType} is unknown.`);
      }

      return {
        ballName: parsedBall.ballName,
        row: parsedBall.row,
        column: parsedBall.column,
        pinName: record.PinName,
        pinType: record.PinType as PinType
      };
    })
    .sort((left, right) => compareBgaBalls({ row: left.row ?? "", column: left.column ?? 0 }, { row: right.row ?? "", column: right.column ?? 0 }));

  if (pins.length !== totalPads) {
    throw new Error(`BGA pinout must contain ${totalPads} ball(s).`);
  }

  return {
    packageName,
    packageType: "BGA",
    totalPads,
    orientation: "a1-top-left",
    pins
  };
}
