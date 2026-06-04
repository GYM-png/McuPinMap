import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ChipRepository } from "../../src/extension/chipRepository";
import type { Chip } from "../../src/shared/types";

const chip = (overrides: Partial<Chip> = {}): Chip => ({
  id: "GD32F407",
  displayName: "Local GD32F407",
  vendor: "GigaDevice",
  family: "GD32F4",
  pins: [],
  packages: [],
  ...overrides
});

const context = (storageRoot: string, extensionRoot: string) =>
  ({
    globalStorageUri: { fsPath: storageRoot },
    extensionUri: { fsPath: extensionRoot }
  }) as never;

describe("ChipRepository", () => {
  let storageRoot: string;
  let extensionRoot: string;

  beforeEach(() => {
    storageRoot = mkdtempSync(join(tmpdir(), "mcupinfunc-repository-storage-"));
    extensionRoot = mkdtempSync(join(tmpdir(), "mcupinfunc-extension-root-"));
  });

  afterEach(() => {
    rmSync(storageRoot, { recursive: true, force: true });
    rmSync(extensionRoot, { recursive: true, force: true });
  });

  it("delegates to the local chip library instead of extension root files", () => {
    mkdirSync(join(extensionRoot, "data/chips"), { recursive: true });
    mkdirSync(join(extensionRoot, "generated/chips"), { recursive: true });
    writeFileSync(
      join(extensionRoot, "data/chips/manifest.json"),
      JSON.stringify({
        schemaVersion: 1,
        dataVersion: "test",
        chips: [
          {
            id: "EXTENSION_ONLY",
            displayName: "Extension Root Chip",
            vendor: "Extension",
            family: "Root",
            gpioAfCsv: "unused.csv",
            packages: [],
            source: "test",
            status: "stable"
          }
        ]
      }),
      "utf8"
    );
    writeFileSync(
      join(extensionRoot, "generated/chips/extension_only.json"),
      JSON.stringify(chip({ id: "EXTENSION_ONLY", displayName: "Extension Root Chip" })),
      "utf8"
    );

    const repository = new ChipRepository(context(storageRoot, extensionRoot));
    repository.saveRemoteChip(chip());

    expect(repository.listChips()).toEqual([
      {
        id: "GD32F407",
        displayName: "Local GD32F407",
        vendor: "GigaDevice",
        family: "GD32F4"
      }
    ]);
    expect(repository.loadChip("GD32F407")).toEqual(chip());
    expect(() => repository.loadChip("EXTENSION_ONLY")).toThrow(
      "Chip EXTENSION_ONLY is not installed in the local chip library."
    );
  });
});
