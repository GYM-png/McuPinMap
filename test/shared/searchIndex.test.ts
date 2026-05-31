import { describe, expect, it } from "vitest";
import { createSearchIndex } from "../../src/shared/data/searchIndex";
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

describe("createSearchIndex", () => {
  it("returns pin rows for pin name matches", () => {
    const index = createSearchIndex(chip);

    expect(index.search("PA9")).toContainEqual({
      kind: "pin",
      pinName: "PA9",
      label: "PA9"
    });
  });

  it("prefers exact function matches before fuzzy matches", () => {
    const index = createSearchIndex(chip);

    expect(index.search("USART0_TX")[0]).toMatchObject({
      kind: "function",
      pinName: "PA9",
      label: "USART0_TX"
    });
  });
});
