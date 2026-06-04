import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildChipFromManifestEntry, buildDataPack } from "../../scripts/build-data-pack";

describe("buildChipFromManifestEntry", () => {
  it("includes package layouts declared by the manifest", () => {
    const chip = buildChipFromManifestEntry(
      {
        id: "GD32F407",
        vendor: "GigaDevice",
        family: "GD32F4",
        displayName: "GD32F407",
        gpioAfCsv: "gpio-af-small.csv",
        packages: [
          { name: "LQFP4", pinoutCsv: "lqfp-pinout-small.csv" },
          { name: "BGA4", pinoutCsv: "bga-pinout-small.csv" }
        ],
        source: "fixture",
        status: "stable"
      },
      "test/fixtures"
    );

    expect(chip.packages).toHaveLength(2);
    expect(chip.packages[0]).toMatchObject({
      packageName: "LQFP4",
      packageType: "LQFP",
      totalPads: 4,
      orientation: "pin1-top-left"
    });
    expect(chip.packages[0].pins.map((pin) => pin.padNumber)).toEqual([1, 2, 3, 4]);
    expect(chip.packages[1]).toMatchObject({
      packageName: "BGA4",
      packageType: "BGA",
      totalPads: 4,
      orientation: "a1-top-left"
    });
    expect(chip.packages[1].pins.map((pin) => pin.ballName)).toEqual(["A1", "A2", "B1", "B2"]);
  });

  it("builds generated chip JSON from configurable data and output roots", () => {
    const root = mkdtempSync(join(tmpdir(), "mcupinfunc-build-"));
    const dataRoot = join(root, "custom-data");
    const outputRoot = join(root, "custom-output");
    const chipDir = join(dataRoot, "gigadevice/gd32f4/gd32f407");
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

    buildDataPack(root, { dataRoot, outputRoot });

    const outputPath = join(outputRoot, "gd32f407.json");
    expect(existsSync(outputPath)).toBe(true);
    const chip = JSON.parse(readFileSync(outputPath, "utf8")) as { id: string; packages: unknown[] };
    expect(chip.id).toBe("GD32F407");
    expect(chip.packages).toHaveLength(1);
  });
});
