import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseGpioAfCsvText } from "../src/shared/csv/parseGpioAfCsv";
import { normalizeChip } from "../src/shared/data/normalizeChip";
import type { ChipManifest } from "../src/shared/types";

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, "data/chips/manifest.json"), "utf8")) as ChipManifest;
const outputDir = join(root, "generated/chips");
mkdirSync(outputDir, { recursive: true });

for (const entry of manifest.chips) {
  const csvText = readFileSync(join(root, "data/chips", entry.gpioAfCsv), "utf8");
  const pins = parseGpioAfCsvText(csvText);
  const chip = normalizeChip(entry, pins);
  const outputPath = join(outputDir, `${entry.id.toLowerCase()}.json`);
  writeFileSync(outputPath, JSON.stringify(chip, null, 2), "utf8");
  console.log(`Built ${entry.id} -> ${outputPath}`);
}
