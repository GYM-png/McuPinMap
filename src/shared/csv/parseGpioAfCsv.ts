import { parse } from "csv-parse/sync";
import type { Pin, PinFunction } from "../types";

type CsvRecord = Record<string, string>;

export function parseGpioAfCsvText(csvText: string): Pin[] {
  const records = parse(csvText, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as CsvRecord[];

  return records.map((record) => {
    const pinName = record.PinName;
    const match = /^P([A-Z])([0-9]+)$/.exec(pinName);
    const functions: PinFunction[] = [];

    for (let afIndex = 0; afIndex <= 15; afIndex += 1) {
      const af = `AF${afIndex}`;
      const cell = record[af];
      if (!cell) {
        continue;
      }

      for (const raw of cell.split("/").map((value) => value.trim()).filter(Boolean)) {
        functions.push(parseFunction(af, raw));
      }
    }

    return {
      name: pinName,
      port: match?.[1] ?? "",
      number: Number(match?.[2] ?? -1),
      functions
    };
  });
}

function parseFunction(af: string, raw: string): PinFunction {
  const separatorIndex = raw.indexOf("_");
  if (separatorIndex === -1) {
    return {
      af,
      raw,
      peripheral: raw,
      signal: raw,
      aliases: [raw]
    };
  }

  return {
    af,
    raw,
    peripheral: raw.slice(0, separatorIndex),
    signal: raw.slice(separatorIndex + 1),
    aliases: [raw]
  };
}
