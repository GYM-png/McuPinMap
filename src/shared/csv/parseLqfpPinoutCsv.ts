import { parse } from "csv-parse/sync";
import type { PackageLayout, PackagePin, PinType } from "../types";

type LqfpPinoutRecord = {
  PadNumber?: string;
  PinName?: string;
  PinType?: string;
};

const VALID_PIN_TYPES = new Set<PinType>(["gpio", "power", "ground", "reset", "clock", "boot", "nc"]);

export function parseLqfpPinoutCsvText(csvText: string, packageName: string): PackageLayout {
  const match = /^LQFP(\d+)$/.exec(packageName);
  if (!match) {
    throw new Error(`Unsupported package name ${packageName}. Expected LQFP<number>.`);
  }

  const totalPads = Number(match[1]);
  const records = parse(csvText, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as LqfpPinoutRecord[];

  const pins = records
    .map((record, index): PackagePin => {
      const lineNumber = index + 2;
      const padNumber = Number(record.PadNumber);
      if (!Number.isInteger(padNumber) || padNumber < 1 || padNumber > totalPads) {
        throw new Error(`Line ${lineNumber} PadNumber must be an integer from 1 to ${totalPads}.`);
      }

      if (!record.PinType) {
        throw new Error(`Line ${lineNumber} must have PinType.`);
      }

      if (!VALID_PIN_TYPES.has(record.PinType as PinType)) {
        throw new Error(`Line ${lineNumber} PinType ${record.PinType} is unknown.`);
      }

      const pin: PackagePin = {
        padNumber,
        pinName: record.PinName ?? "",
        pinType: record.PinType as PinType
      };

      return pin;
    })
    .sort((left, right) => left.padNumber - right.padNumber);

  return {
    packageName,
    packageType: "LQFP",
    totalPads,
    orientation: "pin1-top-left",
    pins
  };
}
