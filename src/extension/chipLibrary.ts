import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { join } from "node:path";
import {
  chipFileName,
  importedChipDirectory,
  importedChipPath,
  remoteChipDirectory,
  remoteChipPath
} from "../shared/data/chipStorage";
import type { Chip, ChipSummary } from "../shared/types";

type ChipSource = "remote" | "imported";

export class ChipLibrary {
  constructor(private readonly libraryRoot: string) {}

  listInstalledChips(): ChipSummary[] {
    const chipsByFileId = new Map<string, ChipSummary>();
    const importedFileIds = new Set<string>();

    for (const entry of this.listChipFiles("remote")) {
      const chip = this.tryReadChip(entry.path);
      if (chip) {
        chipsByFileId.set(entry.fileId, this.toSummary(chip));
      }
    }

    for (const entry of this.listChipFiles("imported")) {
      importedFileIds.add(entry.fileId);
      const chip = this.tryReadChip(entry.path);
      if (chip) {
        chipsByFileId.set(entry.fileId, this.toSummary(chip));
      }
    }

    for (const importedFileId of importedFileIds) {
      if (!this.tryReadChip(importedChipPath(this.libraryRoot, importedFileId))) {
        chipsByFileId.delete(importedFileId);
      }
    }

    return [...chipsByFileId.values()].sort((left, right) =>
      left.displayName.localeCompare(right.displayName)
    );
  }

  loadInstalledChip(chipId: string): Chip {
    const importedPath = importedChipPath(this.libraryRoot, chipId);
    if (existsSync(importedPath)) {
      return this.readChipOrThrow(importedPath, chipId);
    }

    const remotePath = remoteChipPath(this.libraryRoot, chipId);
    if (existsSync(remotePath)) {
      return this.readChipOrThrow(remotePath, chipId);
    }

    throw new Error(`Chip ${chipId} is not installed in the local chip library.`);
  }

  saveRemoteChip(chip: Chip): void {
    this.saveChip(remoteChipDirectory(this.libraryRoot), chip);
  }

  saveImportedChip(chip: Chip): void {
    this.saveChip(importedChipDirectory(this.libraryRoot), chip);
  }

  removeChip(chipId: string): void {
    rmSync(remoteChipPath(this.libraryRoot, chipId), { force: true });
    rmSync(importedChipPath(this.libraryRoot, chipId), { force: true });
  }

  private saveChip(directory: string, chip: Chip): void {
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, chipFileName(chip.id)), JSON.stringify(chip, null, 2), "utf8");
  }

  private listChipFiles(source: ChipSource): Array<{ fileId: string; path: string }> {
    const directory =
      source === "remote"
        ? remoteChipDirectory(this.libraryRoot)
        : importedChipDirectory(this.libraryRoot);

    if (!existsSync(directory)) {
      return [];
    }

    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
      .map((entry) => ({
        fileId: entry.name.slice(0, -".json".length).toLowerCase(),
        path: join(directory, entry.name)
      }));
  }

  private tryReadChip(chipPath: string): Chip | undefined {
    try {
      return this.parseChip(readFileSync(chipPath, "utf8"));
    } catch {
      return undefined;
    }
  }

  private readChipOrThrow(chipPath: string, chipId: string): Chip {
    try {
      return this.parseChip(readFileSync(chipPath, "utf8"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load chip ${chipId} from local chip library: ${message}`);
    }
  }

  private parseChip(text: string): Chip {
    const value = JSON.parse(text) as unknown;
    if (!this.isChip(value)) {
      throw new Error("chip file does not contain a valid Chip object");
    }

    return value;
  }

  private isChip(value: unknown): value is Chip {
    if (!value || typeof value !== "object") {
      return false;
    }

    const candidate = value as Partial<Chip>;
    return (
      typeof candidate.id === "string" &&
      typeof candidate.displayName === "string" &&
      typeof candidate.vendor === "string" &&
      typeof candidate.family === "string" &&
      Array.isArray(candidate.pins) &&
      Array.isArray(candidate.packages)
    );
  }

  private toSummary(chip: Chip): ChipSummary {
    return {
      id: chip.id,
      displayName: chip.displayName,
      vendor: chip.vendor,
      family: chip.family
    };
  }
}
