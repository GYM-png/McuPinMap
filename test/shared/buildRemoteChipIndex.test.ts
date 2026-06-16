import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRemoteChipIndex } from "../../scripts/build-remote-chip-index";

describe("buildRemoteChipIndex", () => {
  it("writes per-chip JSON and a raw GitHub URL index for a data repo layout", () => {
    const root = mkdtempSync(join(tmpdir(), "mcupinmap-remote-index-"));
    const dataRoot = join(root, "mcupinfunc-data");
    const chipDir = join(dataRoot, "chips/gigadevice/gd32f4/gd32f407/source");
    mkdirSync(chipDir, { recursive: true });

    writeFileSync(
      join(chipDir, "GD32F407_GPIO_AF.csv"),
      [
        "PinName,AF0,AF1,AF2,AF3,AF4,AF5,AF6,AF7,AF8,AF9,AF10,AF11,AF12,AF13,AF14,AF15",
        "PA0,GPIOA_0,,,,,,,,,,,,,,,"
      ].join("\n"),
      "utf8"
    );
    writeFileSync(
      join(chipDir, "GD32F407_LQFP4_PINOUT.csv"),
      ["PadNumber,PinName,PinType", "1,PA0,gpio", "2,VDD,power", "3,VSS,ground", "4,NRST,reset"].join("\n"),
      "utf8"
    );

    const index = buildRemoteChipIndex(root, {
      dataRoot,
      owner: "example",
      repo: "chips",
      branch: "dev"
    });

    const chipOutputPath = join(dataRoot, "chips/gigadevice/gd32f4/gd32f407/chip.json");
    expect(existsSync(chipOutputPath)).toBe(true);
    expect(JSON.parse(readFileSync(chipOutputPath, "utf8"))).toMatchObject({
      id: "GD32F407",
      displayName: "GD32F407"
    });

    expect(index).toMatchObject({
      schemaVersion: 1,
      chips: [
        {
          id: "GD32F407",
          packages: ["LQFP4"],
          chipUrl:
            "https://raw.githubusercontent.com/example/chips/dev/chips/gigadevice/gd32f4/gd32f407/chip.json",
          sourceFiles: [
            {
              type: "gpio-af",
              url: "https://raw.githubusercontent.com/example/chips/dev/chips/gigadevice/gd32f4/gd32f407/source/GD32F407_GPIO_AF.csv"
            },
            {
              type: "pinout",
              package: "LQFP4",
              url: "https://raw.githubusercontent.com/example/chips/dev/chips/gigadevice/gd32f4/gd32f407/source/GD32F407_LQFP4_PINOUT.csv"
            }
          ]
        }
      ]
    });
    expect(JSON.parse(readFileSync(join(dataRoot, "index.json"), "utf8"))).toEqual(index);
  });

  it("builds remote index entries for pinout-csv chips without gpio-af source files", () => {
    const root = mkdtempSync(join(tmpdir(), "mcupinmap-remote-pinout-index-"));
    const dataRoot = join(root, "mcupinfunc-data");
    const chipDir = join(dataRoot, "chips/gigadevice/gd32f1/gd32f103/source");
    mkdirSync(chipDir, { recursive: true });
    writeFileSync(
      join(chipDir, "GD32F103_LQFP4_PINOUT.csv"),
      [
        "PadNumber,PinName,PinType,Alternate,Remap",
        "1,PA4,gpio,SPI0_NSS,SPI2_NSS",
        "2,PA5,gpio,SPI0_SCK,",
        "3,VDD,power,,",
        "4,VSS,ground,,"
      ].join("\n"),
      "utf8"
    );

    const index = buildRemoteChipIndex(root, {
      dataRoot,
      owner: "example",
      repo: "chips",
      branch: "dev"
    });

    expect(index.chips[0]).toMatchObject({
      id: "GD32F103",
      sourceFiles: [
        {
          type: "pinout",
          package: "LQFP4",
          url: "https://raw.githubusercontent.com/example/chips/dev/chips/gigadevice/gd32f1/gd32f103/source/GD32F103_LQFP4_PINOUT.csv"
        }
      ]
    });
    expect(existsSync(join(dataRoot, "chips/gigadevice/gd32f1/gd32f103/chip.json"))).toBe(true);
  });
});
