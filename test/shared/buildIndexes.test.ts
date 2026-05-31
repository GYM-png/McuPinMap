import { describe, expect, it } from "vitest";
import { buildChipIndexes } from "../../src/shared/data/buildIndexes";
import type { Chip } from "../../src/shared/types";

const chip: Chip = {
  id: "gd32f407",
  displayName: "GD32F407",
  vendor: "GigaDevice",
  family: "GD32F4",
  pins: [
    {
      name: "PA9",
      port: "A",
      number: 9,
      functions: [
        {
          af: "AF7",
          raw: "USART0_TX",
          peripheral: "USART0",
          signal: "TX",
          aliases: ["USART0_TX"]
        }
      ]
    }
  ],
  packages: []
};

describe("buildChipIndexes", () => {
  it("indexes functions and pins by pin, function, and peripheral", () => {
    const indexes = buildChipIndexes(chip);

    expect(indexes.functionsByPin.get("PA9")?.[0].raw).toBe("USART0_TX");
    expect(indexes.pinsByFunction.get("USART0_TX")).toEqual(["PA9"]);
    expect(indexes.pinsByPeripheral.get("USART0")).toEqual(["PA9"]);
  });
});
