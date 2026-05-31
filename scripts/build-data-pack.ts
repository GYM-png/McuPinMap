import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseGpioAfCsvText } from "../src/shared/csv/parseGpioAfCsv";
import { parseLqfpPinoutCsvText } from "../src/shared/csv/parseLqfpPinoutCsv";
import { normalizeChip } from "../src/shared/data/normalizeChip";
import type { Chip, ChipManifest, ChipManifestEntry, PackageLayout } from "../src/shared/types";

export function buildChipFromManifestEntry(entry: ChipManifestEntry, dataRoot: string): Chip {
  const csvText = readFileSync(join(dataRoot, entry.gpioAfCsv), "utf8");
  const pins = parseGpioAfCsvText(csvText);
  const packages: PackageLayout[] = [];

  for (const packageEntry of entry.packages) {
    if (!/^LQFP\d+$/.test(packageEntry.name)) {
      continue;
    }

    const pinoutCsvText = readFileSync(join(dataRoot, packageEntry.pinoutCsv), "utf8");
    packages.push(parseLqfpPinoutCsvText(pinoutCsvText, packageEntry.name));
  }

  return normalizeChip(entry, pins, packages);
}

export function buildDataPack(root: string): void {
  const dataRoot = join(root, "data/chips");
  const manifest = JSON.parse(readFileSync(join(dataRoot, "manifest.json"), "utf8")) as ChipManifest;
  const outputDir = join(root, "generated/chips");
  mkdirSync(outputDir, { recursive: true });

  for (const entry of manifest.chips) {
    const chip = buildChipFromManifestEntry(entry, dataRoot);
    const outputPath = join(outputDir, `${entry.id.toLowerCase()}.json`);
    writeFileSync(outputPath, JSON.stringify(chip, null, 2), "utf8");
    console.log(`Built ${entry.id} -> ${outputPath}`);
  }
}

if (require.main === module) {
  buildDataPack(process.cwd());
}
