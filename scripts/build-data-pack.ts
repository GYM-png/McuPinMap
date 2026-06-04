import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseBgaPinoutCsvText } from "../src/shared/csv/parseBgaPinoutCsv";
import { parseGpioAfCsvText } from "../src/shared/csv/parseGpioAfCsv";
import { parseLqfpPinoutCsvText } from "../src/shared/csv/parseLqfpPinoutCsv";
import { normalizeChip } from "../src/shared/data/normalizeChip";
import type { Chip, ChipManifest, ChipManifestEntry, PackageLayout } from "../src/shared/types";
import { syncChipManifest } from "./sync-chip-manifest";

export type BuildDataPackOptions = {
  dataRoot?: string;
  outputRoot?: string;
};

export function buildChipFromManifestEntry(entry: ChipManifestEntry, dataRoot: string): Chip {
  const csvText = readFileSync(join(dataRoot, entry.gpioAfCsv), "utf8");
  const pins = parseGpioAfCsvText(csvText);
  const packages: PackageLayout[] = [];

  for (const packageEntry of entry.packages) {
    const pinoutCsvText = readFileSync(join(dataRoot, packageEntry.pinoutCsv), "utf8");
    if (/^LQFP\d+$/.test(packageEntry.name)) {
      packages.push(parseLqfpPinoutCsvText(pinoutCsvText, packageEntry.name));
      continue;
    }

    if (/^BGA\d+$/.test(packageEntry.name)) {
      packages.push(parseBgaPinoutCsvText(pinoutCsvText, packageEntry.name));
    }
  }

  return normalizeChip(entry, pins, packages);
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
