import { describe, expect, it } from "vitest";
import type { PackagePin, Pin } from "../../src/shared/types";
import { buildBgaGridModel } from "../../src/webview/bgaPackageModel";

const pins: PackagePin[] = [
  { ballName: "A1", row: "A", column: 1, pinName: "PA0", pinType: "gpio" },
  { ballName: "A3", row: "A", column: 3, pinName: "VSS", pinType: "ground" },
  { ballName: "B1", row: "B", column: 1, pinName: "PB1", pinType: "gpio" },
  { ballName: "AA2", row: "AA", column: 2, pinName: "PC2", pinType: "gpio" }
];

describe("buildBgaGridModel", () => {
  it("places A1 at the top-left and leaves missing balls empty", () => {
    const model = buildBgaGridModel({
      packagePins: pins,
      pinsByName: new Map(),
      selectedPinName: undefined,
      searchResults: [],
      assignments: [],
      conflicts: []
    });

    expect(model.rows).toEqual(["A", "B", "AA"]);
    expect(model.columns).toEqual([1, 2, 3]);
    expect(model.cells[0][0].packagePin?.ballName).toBe("A1");
    expect(model.cells[0][1].packagePin).toBeUndefined();
  });

  it("reuses package pin state classification for BGA balls", () => {
    const pa0: Pin = { name: "PA0", port: "PA", number: 0, functions: [] };
    const model = buildBgaGridModel({
      packagePins: pins,
      pinsByName: new Map([["PA0", pa0]]),
      selectedPinName: "PA0",
      searchResults: [{ kind: "pin", pinName: "PA0", label: "PA0" }],
      assignments: [
        {
          id: "a1",
          chipId: "gd32",
          pinName: "PA0",
          functionRaw: "USART0_TX",
          af: "AF7",
          peripheral: "USART0",
          signal: "TX"
        }
      ],
      conflicts: []
    });

    expect(model.cells[0][0].viewModel).toMatchObject({
      isInteractive: true,
      isSelected: true,
      isSearchMatch: true,
      isAssigned: true
    });
  });
});
