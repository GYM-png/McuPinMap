import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateGpioAfCsvText } from "../src/shared/csv/validateGpioAfCsv";
import { validateManifest } from "../src/shared/csv/validateManifest";
import type { ChipManifest } from "../src/shared/types";

const root = process.cwd();
const manifestPath = join(root, "data/chips/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ChipManifest;
const manifestResult = validateManifest(manifest);
const errors = [...manifestResult.errors];
const warnings = [...manifestResult.warnings];

for (const warning of warnings) {
  console.warn(`Warning: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`Error: ${error}`);
  }
  process.exit(1);
}

for (const chip of manifest.chips) {
  const csvPath = join(root, "data/chips", chip.gpioAfCsv);
  const csvText = readFileSync(csvPath, "utf8");
  const csvResult = validateGpioAfCsvText(csvText);
  errors.push(...csvResult.errors.map((error) => `${chip.id}: ${error}`));
  warnings.push(...csvResult.warnings.map((warning) => `${chip.id}: ${warning}`));
}

for (const warning of warnings.slice(manifestResult.warnings.length)) {
  console.warn(`Warning: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`Error: ${error}`);
  }
  process.exit(1);
}

console.log(`Validated ${manifest.chips.length} chip data file(s).`);
