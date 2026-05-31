import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionContext } from "vscode";
import type { Chip, ChipManifest, ChipSummary } from "../shared/types";

export class ChipRepository {
  private readonly extensionRoot: string;

  constructor(context: ExtensionContext) {
    this.extensionRoot = context.extensionUri.fsPath;
  }

  listChips(): ChipSummary[] {
    const manifest = this.readManifest();
    return manifest.chips.map((chip) => ({
      id: chip.id,
      displayName: chip.displayName,
      vendor: chip.vendor,
      family: chip.family
    }));
  }

  loadChip(chipId: string): Chip {
    const chipPath = join(this.extensionRoot, "generated/chips", `${chipId.toLowerCase()}.json`);
    return JSON.parse(readFileSync(chipPath, "utf8")) as Chip;
  }

  private readManifest(): ChipManifest {
    const manifestPath = join(this.extensionRoot, "data/chips/manifest.json");
    return JSON.parse(readFileSync(manifestPath, "utf8")) as ChipManifest;
  }
}
