import { parse } from "csv-parse/sync";
import type { Pin, PinFunction } from "../types";
import { parseFunction } from "./parseGpioAfCsv";

type PinoutFunctionRecord = {
  PinName?: string;
  PinType?: string;
  Alternate?: string;
  Remap?: string;
};

const GPIO_PIN_NAME = /^P([A-Z])(\d{1,2})$/;

export function parsePinoutFunctionCsvText(csvText: string): Pin[] {
  const records = parse(csvText, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as PinoutFunctionRecord[];

  const pinsByName = new Map<string, Pin>();
  for (const record of records) {
    if (record.PinType !== "gpio" || !record.PinName) {
      continue;
    }

    const match = GPIO_PIN_NAME.exec(record.PinName);
    if (!match) {
      continue;
    }

    const pin = pinsByName.get(record.PinName) ?? {
      name: record.PinName,
      port: match[1],
      number: Number(match[2]),
      functions: []
    };

    addFunctions(pin.functions, "ALT", record.Alternate);
    addFunctions(pin.functions, "REMAP", record.Remap);
    pinsByName.set(pin.name, pin);
  }

  return [...pinsByName.values()];
}

function addFunctions(functions: PinFunction[], af: "ALT" | "REMAP", cell: string | undefined): void {
  for (const raw of splitFunctionCell(cell)) {
    if (!functions.some((fn) => fn.af === af && fn.raw === raw)) {
      functions.push(parseFunction(af, raw));
    }
  }
}

function splitFunctionCell(cell: string | undefined): string[] {
  if (!cell) {
    return [];
  }

  return cell
    .split("/")
    .map((part) => part.replace(/\(\d+\)/g, "").trim())
    .filter((part) => part.length > 0);
}
