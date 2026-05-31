import { describe, expect, it } from "vitest";
import { normalizeChip } from "../../src/shared/data/normalizeChip";
import type { PackageLayout, Pin } from "../../src/shared/types";

describe("normalizeChip", () => {
  it("preserves parsed package layouts", () => {
    const pins: Pin[] = [
      { name: "PB1", port: "B", number: 1, functions: [] },
      { name: "PA0", port: "A", number: 0, functions: [] }
    ];
    const packages: PackageLayout[] = [
      {
        packageName: "LQFP2",
        packageType: "LQFP",
        totalPads: 2,
        orientation: "pin1-top-left",
        pins: [
          { padNumber: 1, pinName: "PA0", pinType: "gpio" },
          { padNumber: 2, pinName: "PB1", pinType: "gpio" }
        ]
      }
    ];

    const chip = normalizeChip(
      {
        id: "GD32F407",
        vendor: "GigaDevice",
        family: "GD32F4",
        displayName: "GD32F407",
        gpioAfCsv: "GD32F407_GPIO_AF.csv",
        packages: [{ name: "LQFP2", pinoutCsv: "GD32F407_LQFP2_PINOUT.csv" }],
        source: "fixture",
        status: "stable"
      },
      pins,
      packages
    );

    expect(chip.packages).toEqual(packages);
    expect(chip.pins.map((pin) => pin.name)).toEqual(["PA0", "PB1"]);
  });
});
