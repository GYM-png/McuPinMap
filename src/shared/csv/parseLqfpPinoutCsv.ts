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

  const records = parse(csvText, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as LqfpPinoutRecord[];

  const pins = records
    .map((record): PackagePin => {
      const pin: PackagePin = {
        padNumber: Number(record.PadNumber),
        pinName: record.PinName ?? ""
      };

      if (record.PinType && VALID_PIN_TYPES.has(record.PinType as PinType)) {
        pin.pinType = record.PinType as PinType;
      }

      return pin;
    })
    .sort((left, right) => left.padNumber - right.padNumber);

  return {
    packageName,
    packageType: "LQFP",
    totalPads: Number(match[1]),
    orientation: "pin1-top-left",
    pins
  };
}
