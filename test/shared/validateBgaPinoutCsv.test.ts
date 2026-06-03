import { describe, expect, it } from "vitest";
import { validateBgaPinoutCsvText } from "../../src/shared/csv/validateBgaPinoutCsv";

describe("validateBgaPinoutCsvText", () => {
  it("accepts a valid BGA pinout CSV", () => {
    const csv = "BallName,PinName,PinType\nA1,PA0,gpio\nA2,VSS,ground";

    expect(validateBgaPinoutCsvText(csv, 2)).toEqual({ errors: [], warnings: [] });
  });

  it("reports duplicate and malformed ball names", () => {
    const csv = "BallName,PinName,PinType\nA1,PA0,gpio\na1,PB0,gpio\n1A,PC0,gpio";
    const result = validateBgaPinoutCsvText(csv, 3);

    expect(result.errors).toContain("Duplicate BallName A1.");
    expect(result.errors).toContain("Line 4 BallName must look like A1 or AA12.");
  });

  it("reports missing fields and unknown pin types", () => {
    const csv = "BallName,PinName,PinType\nA1,,analog\nA2,PB0,";
    const result = validateBgaPinoutCsvText(csv, 2);

    expect(result.errors).toContain("Line 2 must have PinName.");
    expect(result.errors).toContain("Line 2 PinType analog is unknown.");
    expect(result.errors).toContain("Line 3 must have PinType.");
  });

  it("reports a ball count mismatch", () => {
    const csv = "BallName,PinName,PinType\nA1,PA0,gpio";
    const result = validateBgaPinoutCsvText(csv, 2);

    expect(result.errors).toContain("BGA pinout must contain 2 ball(s).");
  });
});
