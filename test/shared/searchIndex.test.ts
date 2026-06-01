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
        },
        {
          af: "AF7",
          raw: "USART0_TX",
          peripheral: "USART0",
          signal: "TX",
          aliases: ["USART0_TX"]
        },
        {
          af: "AF7",
          raw: "USART0_CK",
          peripheral: "USART0",
          signal: "CK",
          aliases: ["USART0_CK"]
        }
      ]
    },
    {
      name: "PB10",
      port: "B",
      number: 10,
      functions: [
        {
          af: "AF7",
          raw: "USART1_TX",
          peripheral: "USART1",
          signal: "TX",
          aliases: ["USART1_TX"]
        }
      ]
    },
    {
      name: "PA15",
      port: "A",
      number: 15,
      functions: []
    },
    {
      name: "PB15",
      port: "B",
      number: 15,
      functions: []
    },
    {
      name: "PA1",
      port: "A",
      number: 1,
      functions: []
    }
  ],
  packages: []
};

describe("createSearchIndex", () => {
  it("returns no results for an empty query", () => {
    const index = createSearchIndex(chip);

    expect(index.search("")).toEqual([]);
  });

  it("returns pin rows for pin name matches", () => {
    const index = createSearchIndex(chip);

    expect(index.search("PA9")).toContainEqual({
      kind: "pin",
      pinName: "PA9",
      label: "PA9"
    });
  });

  it("matches pin names by case-insensitive prefix only", () => {
    const index = createSearchIndex(chip);
    const pa15Result = [
      {
        kind: "pin" as const,
        pinName: "PA15",
        label: "PA15"
      }
    ];

    expect(index.search("PA15")).toEqual(pa15Result);
    expect(index.search("pa15")).toEqual(pa15Result);
  });

  it("returns peripheral rows for peripheral name matches", () => {
    const index = createSearchIndex(chip);

    expect(index.search("USART0")).toContainEqual({
      kind: "peripheral",
      pinName: "PA9",
      label: "USART0"
    });
  });

  it("prefers exact function matches before prefix matches", () => {
    const index = createSearchIndex(chip);

    expect(index.search("USART0_TX")[0]).toMatchObject({
      kind: "function",
      pinName: "PA9",
      label: "USART0_TX"
    });
  });

  it("excludes fuzzy-only matches", () => {
    const index = createSearchIndex(chip);
    const results = index.search("USART0");

    expect(results).toContainEqual({
      kind: "peripheral",
      pinName: "PA9",
      label: "USART0"
    });
    expect(results).toContainEqual({
      kind: "function",
      pinName: "PA9",
      label: "USART0_TX"
    });
    expect(results).not.toContainEqual({
      kind: "function",
      pinName: "PB10",
      label: "USART1_TX"
    });
  });

  it("dedupes duplicate rows by kind, pinName, and label", () => {
    const index = createSearchIndex(chip);
    const results = index.search("USART0_TX").filter(
      (result) =>
        result.kind === "function" &&
        result.pinName === "PA9" &&
        result.label === "USART0_TX"
    );

    expect(results).toHaveLength(1);
  });
});
