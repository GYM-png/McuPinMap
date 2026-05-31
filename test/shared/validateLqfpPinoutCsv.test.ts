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

  it("rejects duplicate pad numbers", () => {
    const csv = `PadNumber,PinName,PinType
1,PE2,gpio
1,PE3,gpio
2,VSS,ground
3,VDD,power
`;
    const result = validateLqfpPinoutCsvText(csv, 3);

    expect(result.errors).toContain("Duplicate PadNumber 1.");
  });

  it("rejects pad numbers outside the package range", () => {
    const csv = `PadNumber,PinName,PinType
1,PE2,gpio
5,VSS,ground
`;
    const result = validateLqfpPinoutCsvText(csv, 4);

    expect(result.errors).toContain("Line 3 PadNumber must be an integer from 1 to 4.");
  });

  it("rejects rows without PinName", () => {
    const csv = `PadNumber,PinName,PinType
1,,gpio
`;
    const result = validateLqfpPinoutCsvText(csv, 1);

    expect(result.errors).toContain("Line 2 must have PinName.");
  });

  it("rejects unknown PinType values", () => {
    const csv = `PadNumber,PinName,PinType
1,PE2,analog
`;
    const result = validateLqfpPinoutCsvText(csv, 1);

    expect(result.errors).toContain("Line 2 PinType analog is unknown.");
    expect(result.warnings).toEqual([]);
  });

  it("rejects missing PinType values", () => {
    const csv = `PadNumber,PinName,PinType
1,PE2,
`;
    const result = validateLqfpPinoutCsvText(csv, 1);

    expect(result.errors).toContain("Line 2 must have PinType.");
    expect(result.warnings).toEqual([]);
  });

  it("returns validation errors for malformed CSV", () => {
    const result = validateLqfpPinoutCsvText('PadNumber,PinName,PinType\n1,"PE2,gpio', 1);

    expect(result.errors[0]).toMatch(/^LQFP pinout CSV could not be parsed:/);
    expect(result.warnings).toEqual([]);
  });
});
