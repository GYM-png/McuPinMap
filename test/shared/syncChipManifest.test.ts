import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { syncChipManifest } from "../../scripts/sync-chip-manifest";
import type { ChipManifest } from "../../src/shared/types";

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2), "utf8");
}

describe("syncChipManifest", () => {
  it("adds scanned chip CSV files and package pinouts while preserving existing metadata", () => {
    const root = mkdtempSync(join(tmpdir(), "mcupinfunc-manifest-"));
    const dataRoot = join(root, "data/chips");
    const existingChipDir = join(dataRoot, "gigadevice/gd32f4/gd32f407");
    const newChipDir = join(dataRoot, "gigadevice/gd32h7/gd32h759");
    mkdirSync(existingChipDir, { recursive: true });
    mkdirSync(newChipDir, { recursive: true });

    writeJson(join(dataRoot, "manifest.json"), {
      schemaVersion: 1,
      dataVersion: "2026.05.31",
      chips: [
        {
          id: "GD32F407",
          vendor: "GigaDevice",
          family: "GD32F4",
          displayName: "GD32F407",
          gpioAfCsv: "gigadevice/gd32f4/gd32f407/GD32F407_GPIO_AF.csv",
          packages: [],
          source: "hand curated",
          status: "stable"
        }
      ]
    } satisfies ChipManifest);

    writeFileSync(join(existingChipDir, "GD32F407_GPIO_AF.csv"), "PinName,AF0\n", "utf8");
    writeFileSync(join(existingChipDir, "GD32F407_LQFP144_PINOUT.csv"), "PadNumber,PinName,PinType\n", "utf8");
    writeFileSync(join(newChipDir, "GD32H759_GPIO_AF.csv"), "PinName,AF0\n", "utf8");
    writeFileSync(join(newChipDir, "GD32H759_LQFP176_PINOUT.csv"), "PadNumber,PinName,PinType\n", "utf8");

    const manifest = syncChipManifest(root);

    expect(manifest.chips.map((chip) => chip.id)).toEqual(["GD32F407", "GD32H759"]);
    expect(manifest.chips[0]).toMatchObject({
      id: "GD32F407",
      source: "hand curated",
      status: "stable",
      packages: [
        {
          name: "LQFP144",
          pinoutCsv: "gigadevice/gd32f4/gd32f407/GD32F407_LQFP144_PINOUT.csv"
        }
      ]
    });
    expect(manifest.chips[1]).toMatchObject({
      id: "GD32H759",
      vendor: "GigaDevice",
      family: "GD32H7",
      displayName: "GD32H759",
      gpioAfCsv: "gigadevice/gd32h7/gd32h759/GD32H759_GPIO_AF.csv",
      packages: [
        {
          name: "LQFP176",
          pinoutCsv: "gigadevice/gd32h7/gd32h759/GD32H759_LQFP176_PINOUT.csv"
        }
      ],
      status: "draft"
    });

    const written = JSON.parse(readFileSync(join(dataRoot, "manifest.json"), "utf8")) as ChipManifest;
    expect(written).toEqual(manifest);
  });
});
