import { describe, expect, it } from "vitest";
import { parseBgaPinoutCsvText } from "../../src/shared/csv/parseBgaPinoutCsv";

describe("parseBgaPinoutCsvText", () => {
  it("returns a sorted BGA package layout from ball pinout CSV text", () => {
    const csv = [
      "BallName,PinName,PinType",
      "B2,VDD,power",
      "A2,VSS,ground",
      "A1,PA0,gpio",
      "B1,PB1,gpio"
    ].join("\n");

    const layout = parseBgaPinoutCsvText(csv, "BGA4");

    expect(layout).toEqual({
      packageName: "BGA4",
      packageType: "BGA",
      totalPads: 4,
      orientation: "a1-top-left",
      pins: [
        { ballName: "A1", row: "A", column: 1, pinName: "PA0", pinType: "gpio" },
        { ballName: "A2", row: "A", column: 2, pinName: "VSS", pinType: "ground" },
        { ballName: "B1", row: "B", column: 1, pinName: "PB1", pinType: "gpio" },
        { ballName: "B2", row: "B", column: 2, pinName: "VDD", pinType: "power" }
      ]
    });
  });

  it("accepts multi-letter BGA rows", () => {
    const csv = "BallName,PinName,PinType\nAA12,PA0,gpio";

    expect(parseBgaPinoutCsvText(csv, "BGA1").pins[0]).toMatchObject({
      ballName: "AA12",
      row: "AA",
      column: 12
    });
  });

  it("rejects duplicate ball names", () => {
    const csv = "BallName,PinName,PinType\nA1,PA0,gpio\na1,PB0,gpio";

    expect(() => parseBgaPinoutCsvText(csv, "BGA2")).toThrow("Duplicate BallName A1.");
  });

  it("rejects unknown pin types", () => {
    const csv = "BallName,PinName,PinType\nA1,PA0,analog";

    expect(() => parseBgaPinoutCsvText(csv, "BGA1")).toThrow("Line 2 PinType analog is unknown.");
  });

  it("requires the ball count to match the package name", () => {
    const csv = "BallName,PinName,PinType\nA1,PA0,gpio";

    expect(() => parseBgaPinoutCsvText(csv, "BGA2")).toThrow("BGA pinout must contain 2 ball(s).");
  });
});
