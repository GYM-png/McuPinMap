import { describe, expect, it } from "vitest";
import { buildChipFromManifestEntry } from "../../scripts/build-data-pack";

describe("buildChipFromManifestEntry", () => {
  it("includes sorted LQFP package layouts declared by the manifest", () => {
    const chip = buildChipFromManifestEntry(
      {
        id: "GD32F407",
        vendor: "GigaDevice",
        family: "GD32F4",
        displayName: "GD32F407",
        gpioAfCsv: "gpio-af-small.csv",
        packages: [{ name: "LQFP4", pinoutCsv: "lqfp-pinout-small.csv" }],
        source: "fixture",
        status: "stable"
      },
      "test/fixtures"
    );

    expect(chip.packages).toHaveLength(1);
    expect(chip.packages[0]).toMatchObject({
      packageName: "LQFP4",
      packageType: "LQFP",
      totalPads: 4,
      orientation: "pin1-top-left"
    });
    expect(chip.packages[0].pins.map((pin) => pin.padNumber)).toEqual([1, 2, 3, 4]);
  });
});
