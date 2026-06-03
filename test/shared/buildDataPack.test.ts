import { describe, expect, it } from "vitest";
import { buildChipFromManifestEntry } from "../../scripts/build-data-pack";

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
});
