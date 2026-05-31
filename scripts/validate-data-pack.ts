import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateGpioAfCsvText } from "../src/shared/csv/validateGpioAfCsv";
import { validateLqfpPinoutCsvText } from "../src/shared/csv/validateLqfpPinoutCsv";
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

  for (const packageEntry of chip.packages) {
    const match = /^LQFP(\d+)$/.exec(packageEntry.name);
    if (!match) {
      continue;
    }

    const pinoutCsvPath = join(root, "data/chips", packageEntry.pinoutCsv);
    const pinoutCsvText = readFileSync(pinoutCsvPath, "utf8");
    const pinoutResult = validateLqfpPinoutCsvText(pinoutCsvText, Number(match[1]));
    const prefix = `${chip.id} ${packageEntry.name}`;
    errors.push(...pinoutResult.errors.map((error) => `${prefix}: ${error}`));
    warnings.push(...pinoutResult.warnings.map((warning) => `${prefix}: ${warning}`));
  }
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
