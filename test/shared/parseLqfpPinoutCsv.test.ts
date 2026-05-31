import { describe, expect, it } from "vitest";
import { parseLqfpPinoutCsvText } from "../../src/shared/csv/parseLqfpPinoutCsv";

describe("parseLqfpPinoutCsvText", () => {
  it("returns a sorted LQFP package layout from pinout CSV text", () => {
    const csv = `PadNumber,PinName,PinType
3,VSS,ground
1,PE2,gpio
2,VDD,power
`;

    const layout = parseLqfpPinoutCsvText(csv, "LQFP3");

    expect(layout).toEqual({
      packageName: "LQFP3",
      packageType: "LQFP",
      totalPads: 3,
      orientation: "pin1-top-left",
      pins: [
        { padNumber: 1, pinName: "PE2", pinType: "gpio" },
        { padNumber: 2, pinName: "VDD", pinType: "power" },
        { padNumber: 3, pinName: "VSS", pinType: "ground" }
      ]
    });
  });

  it("throws for unknown PinType values", () => {
    const csv = `PadNumber,PinName,PinType
1,PE2,analog
`;

    expect(() => parseLqfpPinoutCsvText(csv, "LQFP1")).toThrow("Line 2 PinType analog is unknown.");
  });

  it("throws for missing PinType values", () => {
    const csv = `PadNumber,PinName,PinType
1,PE2,
`;

    expect(() => parseLqfpPinoutCsvText(csv, "LQFP1")).toThrow("Line 2 must have PinType.");
  });

  it("throws for invalid PadNumber values", () => {
    const csv = `PadNumber,PinName,PinType
abc,PE2,gpio
`;

    expect(() => parseLqfpPinoutCsvText(csv, "LQFP1")).toThrow(
      "Line 2 PadNumber must be an integer from 1 to 1."
    );
  });
});
