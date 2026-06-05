import { describe, expect, it } from "vitest";
import { validateManifest } from "../../src/shared/csv/validateManifest";

describe("validateManifest", () => {
  it("accepts schema version 1 with one chip", () => {
    const result = validateManifest({
      schemaVersion: 1,
      dataVersion: "2026.05.31",
      chips: [
        {
          id: "GD32F407",
          vendor: "GigaDevice",
          family: "GD32F4",
          displayName: "GD32F407",
          gpioAfCsv: "gigadevice/gd32f4/gd32f407/GD32F407_GPIO_AF.csv",
          packages: [],
          source: "fixture",
          status: "stable"
        }
      ]
    });

    expect(result.errors).toEqual([]);
  });

  it("rejects a gpioAfCsv that does not match the chip id", () => {
    const result = validateManifest({
      schemaVersion: 1,
      dataVersion: "2026.05.31",
      chips: [
        {
          id: "GD32F407",
          vendor: "GigaDevice",
          family: "GD32F4",
          displayName: "GD32F407",
          gpioAfCsv: "gigadevice/gd32f4/gd32f407/GD32F405_GPIO_AF.csv",
          packages: [],
          source: "fixture",
          status: "stable"
        }
      ]
    });

    expect(result.errors).toContain("Chip GD32F407 must reference a GPIO AF CSV named GD32F407_GPIO_AF.csv.");
  });

  it("accepts a pinout-csv chip without GPIO AF CSV", () => {
    const result = validateManifest({
      schemaVersion: 1,
      dataVersion: "2026-06-05",
      chips: [
        {
          id: "GD32F103",
          vendor: "GigaDevice",
          family: "GD32F1",
          displayName: "GD32F103",
          functionSource: "pinout-csv",
          packages: [{ name: "LQFP100", pinoutCsv: "chips/gigadevice/gd32f1/gd32f103/source/GD32F103_LQFP100_PINOUT.csv" }],
          source: "fixture",
          status: "draft"
        }
      ]
    });

    expect(result.errors).toEqual([]);
  });

  it("rejects a gpio-af-csv chip without GPIO AF CSV", () => {
    const result = validateManifest({
      schemaVersion: 1,
      dataVersion: "2026-06-05",
      chips: [
        {
          id: "GD32F407",
          vendor: "GigaDevice",
          family: "GD32F4",
          displayName: "GD32F407",
          functionSource: "gpio-af-csv",
          packages: [],
          source: "fixture",
          status: "draft"
        }
      ]
    });

    expect(result.errors).toContain("Chip GD32F407 must reference a GPIO AF CSV named GD32F407_GPIO_AF.csv.");
  });

  it("rejects an unknown functionSource", () => {
    const result = validateManifest({
      schemaVersion: 1,
      dataVersion: "2026-06-05",
      chips: [
        {
          id: "GD32F103",
          vendor: "GigaDevice",
          family: "GD32F1",
          displayName: "GD32F103",
          functionSource: "legacy",
          packages: [],
          source: "fixture",
          status: "draft"
        }
      ]
    });

    expect(result.errors).toContain("Chip GD32F103 functionSource must be gpio-af-csv or pinout-csv.");
  });

  it("returns errors for null input", () => {
    const result = validateManifest(null);

    expect(result.errors).toContain("Manifest must be an object.");
  });

  it("returns errors for non-object input", () => {
    const result = validateManifest("not a manifest");

    expect(result.errors).toContain("Manifest must be an object.");
  });

  it("returns errors for non-object chip entries", () => {
    const result = validateManifest({
      schemaVersion: 1,
      dataVersion: "2026.05.31",
      chips: [null]
    });

    expect(result.errors).toContain("Each chip must be an object.");
  });
});
