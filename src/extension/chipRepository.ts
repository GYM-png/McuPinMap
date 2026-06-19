import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync
} from "node:fs";
import { basename, dirname, join } from "node:path";
import type { ExtensionContext } from "vscode";
import type { Chip, ChipSummary } from "../shared/types";
import { ChipLibrary } from "./chipLibrary";

export class ChipRepository {
  private readonly chipLibrary: ChipLibrary;

  constructor(context: ExtensionContext) {
    const libraryRoot = context.globalStorageUri.fsPath;
    migrateLocalDevelopmentChipLibrary(libraryRoot);
    this.chipLibrary = new ChipLibrary(libraryRoot);
  }

  listChips(): ChipSummary[] {
    return this.chipLibrary.listInstalledChips();
  }

  loadChip(chipId: string): Chip {
    return this.chipLibrary.loadInstalledChip(chipId);
  }

  saveRemoteChip(chip: Chip): void {
    this.chipLibrary.saveRemoteChip(chip);
  }

  saveImportedChip(chip: Chip): void {
    this.chipLibrary.saveImportedChip(chip);
  }

  removeChip(chipId: string): void {
    this.chipLibrary.removeChip(chipId);
  }
}

function migrateLocalDevelopmentChipLibrary(libraryRoot: string): void {
  if (basename(libraryRoot).toLowerCase() === "local-dev.mcupinmap") {
    return;
  }

  const devLibraryRoot = join(dirname(libraryRoot), "local-dev.mcupinmap");
  for (const directoryName of ["chips", "imports"]) {
    copyMissingJsonFiles(join(devLibraryRoot, directoryName), join(libraryRoot, directoryName));
  }
}

function copyMissingJsonFiles(sourceDirectory: string, targetDirectory: string): void {
  if (!existsSync(sourceDirectory)) {
    return;
  }

  const files = readdirSync(sourceDirectory, { withFileTypes: true }).filter(
    (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json")
  );
  if (files.length === 0) {
    return;
  }

  mkdirSync(targetDirectory, { recursive: true });
  for (const file of files) {
    const targetPath = join(targetDirectory, file.name);
    if (!existsSync(targetPath)) {
      copyFileSync(join(sourceDirectory, file.name), targetPath);
    }
  }
}
