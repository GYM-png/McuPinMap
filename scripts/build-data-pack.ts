import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseBgaPinoutCsvText } from "../src/shared/csv/parseBgaPinoutCsv";
import { parseGpioAfCsvText } from "../src/shared/csv/parseGpioAfCsv";
import { parseLqfpPinoutCsvText } from "../src/shared/csv/parseLqfpPinoutCsv";
import { parsePinoutFunctionCsvText } from "../src/shared/csv/pinoutFunctionCsv";
import { normalizeChip } from "../src/shared/data/normalizeChip";
import type { Chip, ChipManifest, ChipManifestEntry, PackageLayout } from "../src/shared/types";
import { syncChipManifest } from "./sync-chip-manifest";

export type BuildDataPackOptions = {
  dataRoot?: string;
  outputRoot?: string;
};

export function buildChipFromManifestEntry(entry: ChipManifestEntry, dataRoot: string): Chip {
  const packages: PackageLayout[] = [];
  const pinoutCsvTexts: string[] = [];

  for (const packageEntry of entry.packages) {
    const pinoutCsvText = readFileSync(join(dataRoot, packageEntry.pinoutCsv), "utf8");
    pinoutCsvTexts.push(pinoutCsvText);
    if (/^LQFP\d+$/.test(packageEntry.name)) {
      packages.push(parseLqfpPinoutCsvText(pinoutCsvText, packageEntry.name));
      continue;
    }

    if (/^BGA\d+$/.test(packageEntry.name)) {
      packages.push(parseBgaPinoutCsvText(pinoutCsvText, packageEntry.name));
    }
  }

  const functionSource = entry.functionSource ?? "gpio-af-csv";
  const pins =
    functionSource === "pinout-csv"
      ? mergePins(pinoutCsvTexts.flatMap(parsePinoutFunctionCsvText))
      : parseGpioAfCsvText(readGpioAfCsvText(entry, dataRoot));

  return normalizeChip(entry, pins, packages);
}

function readGpioAfCsvText(entry: ChipManifestEntry, dataRoot: string): string {
  if (!entry.gpioAfCsv) {
    throw new Error(`Chip ${entry.id} must reference a GPIO AF CSV when functionSource is gpio-af-csv.`);
  }

  return readFileSync(join(dataRoot, entry.gpioAfCsv), "utf8");
}

function mergePins(pins: Chip["pins"]): Chip["pins"] {
  const byName = new Map<string, Chip["pins"][number]>();
  for (const pin of pins) {
    const existing = byName.get(pin.name);
    if (!existing) {
      byName.set(pin.name, { ...pin, functions: [...pin.functions] });
      continue;
    }

    for (const fn of pin.functions) {
      if (!existing.functions.some((existingFn) => existingFn.af === fn.af && existingFn.raw === fn.raw)) {
        existing.functions.push(fn);
      }
    }
  }

  return [...byName.values()];
}

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }

  return value;
}

export function buildDataPack(root: string, options: BuildDataPackOptions = {}): void {
  const dataRoot = options.dataRoot ?? join(root, "data/chips");
  syncChipManifest(root, { dataRoot });
  const manifest = JSON.parse(readFileSync(join(dataRoot, "manifest.json"), "utf8")) as ChipManifest;
  const outputDir = options.outputRoot ?? join(root, "generated/chips");
  mkdirSync(outputDir, { recursive: true });

  for (const entry of manifest.chips) {
    const chip = buildChipFromManifestEntry(entry, dataRoot);
    const outputPath = join(outputDir, `${entry.id.toLowerCase()}.json`);
    writeFileSync(outputPath, JSON.stringify(chip, null, 2), "utf8");
    console.log(`Built ${entry.id} -> ${outputPath}`);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  buildDataPack(process.cwd(), {
    dataRoot: readOption(args, "--data-root"),
    outputRoot: readOption(args, "--output-root")
  });
}
