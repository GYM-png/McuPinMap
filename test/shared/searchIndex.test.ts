import { describe, expect, it } from "vitest";
import { createSearchIndex, matchesFunctionSearchQuery } from "../../src/shared/data/searchIndex";
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
      name: "PA0",
      port: "A",
      number: 0,
      functions: [
        {
          af: "AF0",
          raw: "GPIO_IN",
          peripheral: "GPIO",
          signal: "IN",
          aliases: ["PA0"]
        },
        {
          af: "AF0",
          raw: "GPIO_OUT",
          peripheral: "GPIO",
          signal: "OUT",
          aliases: ["PA0"]
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

  it("returns only the pin row when a query exactly matches a pin name", () => {
    const index = createSearchIndex(chip);

    expect(index.search("PA0")).toEqual([
      {
        kind: "pin",
        pinName: "PA0",
        label: "PA0"
      }
    ]);
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

describe("matchesFunctionSearchQuery", () => {
  const canFunction = {
    af: "AF9",
    raw: "CAN1_RX",
    peripheral: "CAN1",
    signal: "RX",
    aliases: ["CAN_RX"]
  };

  it("matches a selected pin detail function by the active peripheral query", () => {
    expect(matchesFunctionSearchQuery(canFunction, "CAN1")).toBe(true);
  });

  it("uses the same trimmed case-insensitive exact and prefix search semantics", () => {
    expect(matchesFunctionSearchQuery(canFunction, " can1 ")).toBe(true);
    expect(matchesFunctionSearchQuery(canFunction, "can1_r")).toBe(true);
    expect(matchesFunctionSearchQuery(canFunction, "AN1")).toBe(false);
    expect(matchesFunctionSearchQuery(canFunction, "")).toBe(false);
  });

  it("does not treat an exact pin name query as a function highlight match", () => {
    const gpioFunction = {
      af: "AF0",
      raw: "GPIO_IN",
      peripheral: "GPIO",
      signal: "IN",
      aliases: ["PA0"]
    };

    expect(matchesFunctionSearchQuery(gpioFunction, "PA0", "PA0")).toBe(false);
    expect(matchesFunctionSearchQuery(gpioFunction, "GPIO", "PA0")).toBe(true);
  });
});
