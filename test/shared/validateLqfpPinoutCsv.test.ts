import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateLqfpPinoutCsvText } from "../../src/shared/csv/validateLqfpPinoutCsv";

describe("validateLqfpPinoutCsvText", () => {
  it("accepts continuous pad numbers for the requested package size", () => {
    const csv = readFileSync("test/fixtures/lqfp-pinout-small.csv", "utf8");
    const result = validateLqfpPinoutCsvText(csv, 4);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("rejects missing pad numbers", () => {
    const csv = `PadNumber,PinName,PinType
1,PE2,gpio
3,VSS,ground
`;
    const result = validateLqfpPinoutCsvText(csv, 3);

    expect(result.errors).toContain("PadNumber must cover every value from 1 to 3.");
  });
});
