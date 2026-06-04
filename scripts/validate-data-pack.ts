import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateBgaPinoutCsvText } from "../src/shared/csv/validateBgaPinoutCsv";
import { validateGpioAfCsvText } from "../src/shared/csv/validateGpioAfCsv";
import { validateLqfpPinoutCsvText } from "../src/shared/csv/validateLqfpPinoutCsv";
import { validateManifest } from "../src/shared/csv/validateManifest";
import type { ChipManifest } from "../src/shared/types";
import { syncChipManifest } from "./sync-chip-manifest";

export type ValidateDataPackOptions = {
  dataRoot?: string;
};

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

export function validateDataPack(root: string, options: ValidateDataPackOptions = {}): number {
  const dataRoot = options.dataRoot ?? join(root, "data/chips");
  syncChipManifest(root, { dataRoot });
  const manifestPath = join(dataRoot, "manifest.json");
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
    return 1;
  }

  for (const chip of manifest.chips) {
    const csvPath = join(dataRoot, chip.gpioAfCsv);
    const csvText = readFileSync(csvPath, "utf8");
    const csvResult = validateGpioAfCsvText(csvText);
    errors.push(...csvResult.errors.map((error) => `${chip.id}: ${error}`));
    warnings.push(...csvResult.warnings.map((warning) => `${chip.id}: ${warning}`));

    for (const packageEntry of chip.packages) {
      const lqfpMatch = /^LQFP(\d+)$/.exec(packageEntry.name);
      const bgaMatch = /^BGA(\d+)$/.exec(packageEntry.name);
      if (!lqfpMatch && !bgaMatch) {
        continue;
      }

      const pinoutCsvPath = join(dataRoot, packageEntry.pinoutCsv);
      const pinoutCsvText = readFileSync(pinoutCsvPath, "utf8");
      const pinoutResult = lqfpMatch
        ? validateLqfpPinoutCsvText(pinoutCsvText, Number(lqfpMatch[1]))
        : validateBgaPinoutCsvText(pinoutCsvText, Number(bgaMatch?.[1]));
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
    return 1;
  }

  console.log(`Validated ${manifest.chips.length} chip data file(s).`);
  return 0;
}

if (require.main === module) {
  process.exitCode = validateDataPack(process.cwd(), {
    dataRoot: readOption(process.argv.slice(2), "--data-root")
  });
}
