import { describe, expect, it } from "vitest";
import { createSearchIndex } from "../../src/shared/data/searchIndex";
import { normalizeChip } from "../../src/shared/data/normalizeChip";
import type { PackageLayout, Pin } from "../../src/shared/types";

const entry = {
  id: "GD32F407",
  vendor: "GigaDevice",
  family: "GD32F4",
  displayName: "GD32F407",
  gpioAfCsv: "GD32F407_GPIO_AF.csv",
  packages: [],
  source: "fixture",
  status: "stable" as const
};

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
        ...entry,
        packages: [{ name: "LQFP2", pinoutCsv: "GD32F407_LQFP2_PINOUT.csv" }]
      },
      pins,
      packages
    );

    expect(chip.packages).toEqual(packages);
    expect(chip.pins.map((pin) => pin.name)).toEqual(["PA0", "PB1"]);
  });

  it("adds GPIO input and output functions to every normalized pin", () => {
    const chip = normalizeChip(entry, [
      { name: "PB1", port: "B", number: 1, functions: [] },
      {
        name: "PA0",
        port: "A",
        number: 0,
        functions: [
          {
            af: "AF1",
            raw: "TIMER1_CH0",
            peripheral: "TIMER1",
            signal: "CH0",
            aliases: ["TIMER1_CH0"]
          }
        ]
      }
    ]);

    expect(chip.pins[0]?.functions).toEqual([
      {
        af: "GPIO",
        raw: "GPIO_IN",
        peripheral: "GPIO",
        signal: "IN",
        aliases: ["PA0_IN", "PA0_GPIO_IN"]
      },
      {
        af: "GPIO",
        raw: "GPIO_OUT",
        peripheral: "GPIO",
        signal: "OUT",
        aliases: ["PA0_OUT", "PA0_GPIO_OUT"]
      },
      {
        af: "AF1",
        raw: "TIMER1_CH0",
        peripheral: "TIMER1",
        signal: "CH0",
        aliases: ["TIMER1_CH0"]
      }
    ]);
    expect(chip.pins[1]?.functions.map((fn) => fn.raw)).toEqual(["GPIO_IN", "GPIO_OUT"]);
  });

  it("does not duplicate existing GPIO input and output functions", () => {
    const chip = normalizeChip(entry, [
      {
        name: "PA0",
        port: "A",
        number: 0,
        functions: [
          {
            af: "GPIO",
            raw: "GPIO_IN",
            peripheral: "GPIO",
            signal: "IN",
            aliases: ["PA0_IN", "PA0_GPIO_IN"]
          },
          {
            af: "GPIO",
            raw: "GPIO_OUT",
            peripheral: "GPIO",
            signal: "OUT",
            aliases: ["PA0_OUT", "PA0_GPIO_OUT"]
          }
        ]
      }
    ]);

    expect(chip.pins[0]?.functions.map((fn) => fn.raw)).toEqual(["GPIO_IN", "GPIO_OUT"]);
  });

  it("indexes generated GPIO input and output functions for search", () => {
    const chip = normalizeChip(entry, [
      { name: "PA0", port: "A", number: 0, functions: [] }
    ]);
    const search = createSearchIndex(chip);

    expect(search.search("GPIO")).toContainEqual({
      kind: "function",
      pinName: "PA0",
      label: "GPIO_IN"
    });
    expect(search.search("PA0_OUT")).toContainEqual({
      kind: "function",
      pinName: "PA0",
      label: "GPIO_OUT"
    });
  });
});
