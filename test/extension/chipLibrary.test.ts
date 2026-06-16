import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ChipLibrary } from "../../src/extension/chipLibrary";
import { chipFileName, importedChipPath, remoteChipPath } from "../../src/shared/data/chipStorage";
import type { Chip } from "../../src/shared/types";

const chip = (overrides: Partial<Chip> = {}): Chip => ({
  id: "GD32F407",
  displayName: "GD32F407",
  vendor: "GigaDevice",
  family: "GD32F4",
  pins: [],
  packages: [],
  ...overrides
});

describe("ChipLibrary", () => {
  let storageRoot: string;
  let library: ChipLibrary;

  beforeEach(() => {
    storageRoot = mkdtempSync(join(tmpdir(), "mcupinmap-chip-library-"));
    library = new ChipLibrary(storageRoot);
  });

  afterEach(() => {
    rmSync(storageRoot, { recursive: true, force: true });
  });

  it("returns no chips for an empty library", () => {
    expect(library.listInstalledChips()).toEqual([]);
  });

  it("lists and loads a saved remote chip", () => {
    const remoteChip = chip();

    library.saveRemoteChip(remoteChip);

    expect(library.listInstalledChips()).toEqual([
      {
        id: "GD32F407",
        displayName: "GD32F407",
        vendor: "GigaDevice",
        family: "GD32F4"
      }
    ]);
    expect(library.loadInstalledChip("GD32F407")).toEqual(remoteChip);
  });

  it("deduplicates package layouts when loading an existing remote chip", () => {
    const duplicatePackageChip = chip({
      packages: [
        {
          packageName: "BGA100",
          packageType: "BGA",
          totalPads: 100,
          pins: []
        },
        {
          packageName: "BGA100",
          packageType: "BGA",
          totalPads: 100,
          pins: []
        }
      ]
    });
    mkdirSync(join(storageRoot, "chips"), { recursive: true });
    writeFileSync(remoteChipPath(storageRoot, "GD32F407"), JSON.stringify(duplicatePackageChip), "utf8");

    expect(library.loadInstalledChip("GD32F407").packages.map((layout) => layout.packageName)).toEqual([
      "BGA100"
    ]);
  });

  it("prefers imported chips over duplicate remote chips", () => {
    library.saveRemoteChip(chip({ id: "GD32F407", displayName: "Remote GD32F407" }));
    library.saveImportedChip(chip({ id: "GD32F407", displayName: "Imported GD32F407" }));

    expect(library.listInstalledChips()).toEqual([
      {
        id: "GD32F407",
        displayName: "Imported GD32F407",
        vendor: "GigaDevice",
        family: "GD32F4"
      }
    ]);
    expect(library.loadInstalledChip("gd32f407").displayName).toBe("Imported GD32F407");
  });

  it("ignores malformed JSON while listing chips", () => {
    mkdirSync(join(storageRoot, "chips"), { recursive: true });
    writeFileSync(remoteChipPath(storageRoot, "GD32F407"), "{", "utf8");

    expect(library.listInstalledChips()).toEqual([]);
  });

  it("throws a useful error when loading a missing chip", () => {
    expect(() => library.loadInstalledChip("GD32F407")).toThrow(
      "Chip GD32F407 is not installed in the local chip library."
    );
  });

  it("normalizes chip ids to lowercase file names", () => {
    library.saveRemoteChip(chip({ id: "GD32F407" }));
    library.saveImportedChip(chip({ id: "GD32H759" }));

    expect(chipFileName("GD32F407")).toBe("gd32f407.json");
    expect(library.loadInstalledChip("gd32f407").id).toBe("GD32F407");
    expect(remoteChipPath(storageRoot, "GD32F407")).toBe(
      join(storageRoot, "chips", "gd32f407.json")
    );
    expect(importedChipPath(storageRoot, "GD32H759")).toBe(
      join(storageRoot, "imports", "gd32h759.json")
    );
    expect(chipFileName("CON")).toBe("chip-con.json");
    expect(chipFileName("NUL.txt")).toBe("chip-nul.txt.json");
    expect(chipFileName("GD32F407...")).toBe("gd32f407.json");
  });

  it("throws a useful error when loading a selected malformed chip", () => {
    mkdirSync(join(storageRoot, "imports"), { recursive: true });
    writeFileSync(importedChipPath(storageRoot, "GD32F407"), "{", "utf8");

    expect(() => library.loadInstalledChip("GD32F407")).toThrow(
      "Failed to load chip GD32F407 from local chip library:"
    );
  });

  it("does not list a remote chip hidden by a malformed imported override", () => {
    library.saveRemoteChip(chip({ id: "GD32F407", displayName: "Remote GD32F407" }));
    mkdirSync(join(storageRoot, "imports"), { recursive: true });
    writeFileSync(importedChipPath(storageRoot, "GD32F407"), "{", "utf8");

    expect(library.listInstalledChips()).toEqual([]);
    expect(() => library.loadInstalledChip("GD32F407")).toThrow(
      "Failed to load chip GD32F407 from local chip library:"
    );
  });
});
