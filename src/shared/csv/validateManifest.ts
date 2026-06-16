import type { ChipManifest } from "../types";

export type ValidationResult = {
  errors: string[];
  warnings: string[];
};

export function validateManifest(input: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    errors.push("Manifest must be an object.");
    return { errors, warnings };
  }

  const manifest = input as Partial<ChipManifest>;

  if (manifest.schemaVersion !== 1) {
    errors.push("Manifest schemaVersion must be 1.");
  }

  if (typeof manifest.dataVersion !== "string" || manifest.dataVersion.length === 0) {
    errors.push("Manifest dataVersion must be a non-empty string.");
  }

  if (!Array.isArray(manifest.chips)) {
    errors.push("Manifest chips must be an array.");
    return { errors, warnings };
  }

  const seen = new Set<string>();
  for (const chip of manifest.chips as unknown[]) {
    if (typeof chip !== "object" || chip === null || Array.isArray(chip)) {
      errors.push("Each chip must be an object.");
      continue;
    }

    const chipRecord = chip as Record<string, unknown>;
    const id = chipRecord.id;
    if (typeof id !== "string" || id.length === 0) {
      errors.push("Each chip must have a non-empty id.");
      continue;
    }

    if (seen.has(id)) {
      errors.push(`Duplicate chip id ${id}.`);
    }
    seen.add(id);

    const functionSource = chipRecord.functionSource ?? "gpio-af-csv";
    if (functionSource !== "gpio-af-csv" && functionSource !== "pinout-csv") {
      errors.push(`Chip ${id} functionSource must be gpio-af-csv or pinout-csv.`);
    }

    const expectedFile = `${id}_GPIO_AF.csv`;
    const gpioAfCsv = chipRecord.gpioAfCsv;
    if (functionSource === "gpio-af-csv" && (typeof gpioAfCsv !== "string" || !gpioAfCsv.endsWith(expectedFile))) {
      errors.push(`Chip ${id} must reference a GPIO AF CSV named ${expectedFile}.`);
    } else if (functionSource === "pinout-csv" && gpioAfCsv !== undefined && typeof gpioAfCsv !== "string") {
      errors.push(`Chip ${id} gpioAfCsv must be a string when provided.`);
    }

    const packages = chipRecord.packages;
    if (!Array.isArray(packages)) {
      errors.push(`Chip ${id} packages must be an array.`);
    }
  }

  return { errors, warnings };
}
