import { describe, expect, it } from "vitest";
import {
  searchRemoteChipIndex,
  validateRemoteChipIndex
} from "../../src/shared/data/remoteChipIndex";
import type { RemoteChipIndex } from "../../src/shared/data/remoteChipIndex";

const index = (overrides: Partial<RemoteChipIndex> = {}): RemoteChipIndex => ({
  schemaVersion: 1,
  dataVersion: "2026-06-04",
  chips: [
    {
      id: "GD32F407",
      displayName: "GD32F407 Performance Line",
      vendor: "GigaDevice",
      family: "GD32F4",
      packages: ["LQFP100", "BGA176"],
      status: "stable",
      chipUrl: "https://raw.githubusercontent.com/GYM-png/mcupinfunc-data/main/chips/gd32f407/chip.json",
      sourceFiles: [
        {
          type: "gpio-af",
          url: "https://raw.githubusercontent.com/GYM-png/mcupinfunc-data/main/chips/gd32f407/source/GD32F407_GPIO_AF.csv"
        },
        {
          type: "pinout",
          package: "BGA176",
          url: "https://raw.githubusercontent.com/GYM-png/mcupinfunc-data/main/chips/gd32f407/source/GD32F407_BGA176_PINOUT.csv"
        }
      ]
    }
  ],
  ...overrides
});

describe("validateRemoteChipIndex", () => {
  it("accepts a valid schema version 1 remote index", () => {
    expect(validateRemoteChipIndex(index())).toEqual(index());
  });

  it("deduplicates package names from remote index summaries", () => {
    const remoteIndex = validateRemoteChipIndex({
      ...index(),
      chips: [
        {
          ...index().chips[0],
          packages: ["BGA100", "BGA100", "BGA176", "BGA176", "LQFP100"]
        }
      ]
    });

    expect(remoteIndex.chips[0]?.packages).toEqual(["BGA100", "BGA176", "LQFP100"]);
  });

  it("rejects unsupported schema versions", () => {
    expect(() =>
      validateRemoteChipIndex({
        ...index(),
        schemaVersion: 2
      })
    ).toThrow("schemaVersion must be 1");
  });

  it("rejects missing chip urls", () => {
    expect(() =>
      validateRemoteChipIndex({
        ...index(),
        chips: [{ ...index().chips[0], chipUrl: "" }]
      })
    ).toThrow("chips[0].chipUrl must be a valid URL");
  });

  it("rejects non-HTTPS chip urls except localhost test urls", () => {
    expect(() =>
      validateRemoteChipIndex({
        ...index(),
        chips: [{ ...index().chips[0], chipUrl: "http://example.com/chip.json" }]
      })
    ).toThrow("chips[0].chipUrl must be a valid URL");

    expect(
      validateRemoteChipIndex({
        ...index(),
        chips: [{ ...index().chips[0], chipUrl: "http://localhost:5173/chip.json" }]
      }).chips[0].chipUrl
    ).toBe("http://localhost:5173/chip.json");

    expect(
      validateRemoteChipIndex({
        ...index(),
        chips: [{ ...index().chips[0], chipUrl: "http://[::1]:5173/chip.json" }]
      }).chips[0].chipUrl
    ).toBe("http://[::1]:5173/chip.json");
  });

  it("rejects malformed source files", () => {
    expect(() =>
      validateRemoteChipIndex({
        ...index(),
        chips: [
          {
            ...index().chips[0],
            sourceFiles: [{ type: "pinout", url: "https://example.com/pinout.csv" } as never]
          }
        ]
      })
    ).toThrow("chips[0].sourceFiles[0].package must be a non-empty string");
  });
});

describe("searchRemoteChipIndex", () => {
  it("matches id, displayName, vendor, family, and packages", () => {
    const remoteIndex = index();

    expect(searchRemoteChipIndex(remoteIndex, "gd32f407").map((chip) => chip.id)).toEqual([
      "GD32F407"
    ]);
    expect(searchRemoteChipIndex(remoteIndex, "performance").map((chip) => chip.id)).toEqual([
      "GD32F407"
    ]);
    expect(searchRemoteChipIndex(remoteIndex, "gigadevice").map((chip) => chip.id)).toEqual([
      "GD32F407"
    ]);
    expect(searchRemoteChipIndex(remoteIndex, "gd32f4").map((chip) => chip.id)).toEqual([
      "GD32F407"
    ]);
    expect(searchRemoteChipIndex(remoteIndex, "bga176").map((chip) => chip.id)).toEqual([
      "GD32F407"
    ]);
  });
});
