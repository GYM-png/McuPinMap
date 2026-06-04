import { join } from "node:path";

const CHIP_FILE_EXTENSION = ".json";
const WINDOWS_RESERVED_FILE_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9"
]);

export function normalizeChipIdForFile(chipId: string): string {
  const normalized = chipId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^\.+/, "")
    .replace(/[. ]+$/, "");

  if (!normalized) {
    throw new Error("Chip id must contain at least one safe file-name character.");
  }

  const baseName = normalized.split(".")[0] ?? normalized;
  return WINDOWS_RESERVED_FILE_NAMES.has(baseName) ? `chip-${normalized}` : normalized;
}

export function chipFileName(chipId: string): string {
  return `${normalizeChipIdForFile(chipId)}${CHIP_FILE_EXTENSION}`;
}

export function remoteChipDirectory(libraryRoot: string): string {
  return join(libraryRoot, "chips");
}

export function importedChipDirectory(libraryRoot: string): string {
  return join(libraryRoot, "imports");
}

export function remoteChipPath(libraryRoot: string, chipId: string): string {
  return join(remoteChipDirectory(libraryRoot), chipFileName(chipId));
}

export function importedChipPath(libraryRoot: string, chipId: string): string {
  return join(importedChipDirectory(libraryRoot), chipFileName(chipId));
}
