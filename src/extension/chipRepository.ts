import type { ExtensionContext } from "vscode";
import type { Chip, ChipSummary } from "../shared/types";
import { ChipLibrary } from "./chipLibrary";

export class ChipRepository {
  private readonly chipLibrary: ChipLibrary;

  constructor(context: ExtensionContext) {
    this.chipLibrary = new ChipLibrary(context.globalStorageUri.fsPath);
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
