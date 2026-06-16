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
    writeFileSync(join(existingChipDir, "GD32F407_BGA176_PINOUT.csv"), "BallName,PinName,PinType\n", "utf8");
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
          name: "BGA176",
          pinoutCsv: "gigadevice/gd32f4/gd32f407/GD32F407_BGA176_PINOUT.csv"
        },
        {
          name: "LQFP144",
          pinoutCsv: "gigadevice/gd32f4/gd32f407/GD32F407_LQFP144_PINOUT.csv"
        }
      ]
    });
    expect(manifest.chips[0]?.functionSource).toBeUndefined();
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
    expect(manifest.chips[1]?.functionSource).toBeUndefined();

    const written = JSON.parse(readFileSync(join(dataRoot, "manifest.json"), "utf8")) as ChipManifest;
    expect(written).toEqual(manifest);
  });

  it("writes manifest under a configurable data root", () => {
    const root = mkdtempSync(join(tmpdir(), "mcupinfunc-manifest-custom-"));
    const dataRoot = join(root, "custom-data");
    const chipDir = join(dataRoot, "gigadevice/gd32f4/gd32f407");
    mkdirSync(chipDir, { recursive: true });

    writeFileSync(join(chipDir, "GD32F407_GPIO_AF.csv"), "PinName,AF0\n", "utf8");
    writeFileSync(join(chipDir, "GD32F407_LQFP4_PINOUT.csv"), "PadNumber,PinName,PinType\n", "utf8");

    const manifest = syncChipManifest(root, { dataRoot });

    expect(manifest.chips).toHaveLength(1);
    expect(manifest.chips[0]).toMatchObject({
      id: "GD32F407",
      gpioAfCsv: "gigadevice/gd32f4/gd32f407/GD32F407_GPIO_AF.csv",
      packages: [
        {
          name: "LQFP4",
          pinoutCsv: "gigadevice/gd32f4/gd32f407/GD32F407_LQFP4_PINOUT.csv"
        }
      ]
    });
    expect(readFileSync(join(dataRoot, "manifest.json"), "utf8")).toContain("\"GD32F407\"");
  });

  it("scans the remote data repo source layout without falling back to legacy path parsing", () => {
    const root = mkdtempSync(join(tmpdir(), "mcupinfunc-manifest-remote-"));
    const dataRoot = join(root, "remote-data");
    const chipDir = join(dataRoot, "chips/gigadevice/gd32f4/gd32f407/source");
    const invalidChipDir = join(dataRoot, "chips/gigadevice/gd32f4/gd32f405");
    mkdirSync(chipDir, { recursive: true });
    mkdirSync(invalidChipDir, { recursive: true });

    writeFileSync(join(chipDir, "GD32F407_GPIO_AF.csv"), "PinName,AF0\n", "utf8");
    writeFileSync(join(chipDir, "GD32F407_LQFP4_PINOUT.csv"), "PadNumber,PinName,PinType\n", "utf8");
    writeFileSync(join(invalidChipDir, "GD32F405_GPIO_AF.csv"), "PinName,AF0\n", "utf8");

    const manifest = syncChipManifest(root, { dataRoot });

    expect(manifest.chips.map((chip) => chip.id)).toEqual(["GD32F407"]);
    expect(manifest.chips[0]).toMatchObject({
      gpioAfCsv: "chips/gigadevice/gd32f4/gd32f407/source/GD32F407_GPIO_AF.csv",
      source:
        "GD32F407 gpio-af-csv CSV scanned from chips/gigadevice/gd32f4/gd32f407/source/GD32F407_GPIO_AF.csv",
      packages: [
        {
          name: "LQFP4",
          pinoutCsv: "chips/gigadevice/gd32f4/gd32f407/source/GD32F407_LQFP4_PINOUT.csv"
        }
      ]
    });
  });

  it("syncs a chip that only has package pinout CSVs as pinout-csv", () => {
    const root = mkdtempSync(join(tmpdir(), "mcupinfunc-sync-pinout-"));
    const dataRoot = join(root, "mcupinfunc-data");
    const chipDir = join(dataRoot, "chips/gigadevice/gd32f1/gd32f103/source");
    mkdirSync(chipDir, { recursive: true });
    writeFileSync(
      join(chipDir, "GD32F103_LQFP4_PINOUT.csv"),
      [
        "PadNumber,PinName,PinType,Alternate,Remap",
        "1,PA4,gpio,SPI0_NSS,SPI2_NSS",
        "2,VDD,power,,",
        "3,VSS,ground,,",
        "4,NRST,reset,,"
      ].join("\n"),
      "utf8"
    );

    const manifest = syncChipManifest(root, { dataRoot });

    expect(manifest.chips).toEqual([
      expect.objectContaining({
        id: "GD32F103",
        functionSource: "pinout-csv",
        packages: [
          {
            name: "LQFP4",
            pinoutCsv: "chips/gigadevice/gd32f1/gd32f103/source/GD32F103_LQFP4_PINOUT.csv"
          }
        ]
      })
    ]);
    expect(manifest.chips[0]?.gpioAfCsv).toBeUndefined();
  });
});
