import type { ChipManifest } from "../types";

export type ValidationResult = {
  errors: string[];
  warnings: string[];
};

export function validateManifest(input: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
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
  for (const chip of manifest.chips as Array<Record<string, unknown>>) {
    const id = chip.id;
    if (typeof id !== "string" || id.length === 0) {
      errors.push("Each chip must have a non-empty id.");
      continue;
    }

    if (seen.has(id)) {
      errors.push(`Duplicate chip id ${id}.`);
    }
    seen.add(id);

    const gpioAfCsv = chip.gpioAfCsv;
    const expectedFile = `${id}_GPIO_AF.csv`;
    if (typeof gpioAfCsv !== "string" || !gpioAfCsv.endsWith(expectedFile)) {
      errors.push(`Chip ${id} must reference a GPIO AF CSV named ${expectedFile}.`);
    }

    const packages = chip.packages;
    if (!Array.isArray(packages)) {
      errors.push(`Chip ${id} packages must be an array.`);
    }
  }

  return { errors, warnings };
}
