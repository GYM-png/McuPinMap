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
});
