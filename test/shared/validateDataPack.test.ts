import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateDataPack } from "../../scripts/validate-data-pack";

describe("validateDataPack", () => {
  it("validates pinout-csv chips without GPIO AF CSV files", () => {
    const root = mkdtempSync(join(tmpdir(), "mcupinmap-validate-pinout-"));
    const dataRoot = join(root, "mcupinfunc-data");
    const chipDir = join(dataRoot, "chips/gigadevice/gd32f1/gd32f103/source");
    mkdirSync(chipDir, { recursive: true });
    writeFileSync(
      join(chipDir, "GD32F103_LQFP4_PINOUT.csv"),
      [
        "PadNumber,PinName,PinType,Alternate,Remap",
        "1,PA4,gpio,SPI0_NSS,SPI2_NSS",
        "2,VDD,power,,",
        "3,VSS,ground,,",
        "4,NRST,reset,,"
      ].join("\n"),
      "utf8"
    );

    expect(validateDataPack(root, { dataRoot })).toBe(0);
  });
});
