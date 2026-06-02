import { describe, expect, it } from "vitest";
import type { SearchResult } from "../../src/shared/data/searchIndex";
import type { Assignment, Conflict, PackageLayout, Pin } from "../../src/shared/types";
import {
  classifyPackagePin,
  deriveLqfpSides,
  getLqfpBodySize
} from "../../src/webview/lqfpPackageModel";

const packageLayout: PackageLayout = {
  packageName: "LQFP8",
  packageType: "LQFP",
  totalPads: 8,
  orientation: "pin1-top-left",
  pins: Array.from({ length: 8 }, (_, index) => ({
    padNumber: index + 1,
    pinName: `P${index + 1}`,
    pinType: "gpio"
  }))
};

const pin: Pin = {
  name: "PA2",
  port: "PA",
  number: 2,
  functions: []
};

describe("deriveLqfpSides", () => {
  it("returns LQFP pads in visual order around all four sides", () => {
    const sides = deriveLqfpSides(packageLayout);

    expect(sides.left.map((pad) => pad.padNumber)).toEqual([1, 2]);
    expect(sides.bottom.map((pad) => pad.padNumber)).toEqual([3, 4]);
    expect(sides.right.map((pad) => pad.padNumber)).toEqual([6, 5]);
    expect(sides.top.map((pad) => pad.padNumber)).toEqual([8, 7]);
  });
});

describe("getLqfpBodySize", () => {
  it("scales larger LQFP packages up so dense pad numbers remain readable", () => {
    expect(getLqfpBodySize(100)).toBe("min(56vw, 520px)");
    expect(getLqfpBodySize(144)).toBe("min(64vw, 620px)");
    expect(getLqfpBodySize(176)).toBe("min(68vw, 700px)");
  });
});

describe("classifyPackagePin", () => {
  it("marks a mapped GPIO pad as interactive and reflects selected, search, assignment, and conflict state", () => {
    const assignment: Assignment = {
      id: "gd32f407:PA2:USART2_TX",
      chipId: "gd32f407",
      pinName: "PA2",
      functionRaw: "USART2_TX",
      af: "AF7",
      peripheral: "USART2",
      signal: "TX"
    };
    const conflict: Conflict = {
      id: "conflict",
      kind: "pin-overlap",
      message: "Pin overlap",
      assignmentIds: [assignment.id]
    };
    const searchResults: SearchResult[] = [
      { kind: "pin", pinName: "PA2", label: "PA2" }
    ];

    const viewModel = classifyPackagePin({
      packagePin: { padNumber: 42, pinName: "PA2", pinType: "gpio" },
      pinsByName: new Map([[pin.name, pin]]),
      selectedPinName: "PA2",
      searchResults,
      assignments: [assignment],
      conflicts: [conflict]
    });

    expect(viewModel).toMatchObject({
      isInteractive: true,
      isSelected: true,
      isSearchMatch: true,
      isAssigned: true,
      isConflict: true,
      label: "PA2"
    });
    expect(viewModel.classNames).toContain("is-selected");
    expect(viewModel.classNames).toContain("is-search-match");
    expect(viewModel.classNames).toContain("is-assigned");
    expect(viewModel.classNames).toContain("is-conflict");
  });

  it("keeps non-GPIO and missing GPIO pads non-interactive", () => {
    const pinsByName = new Map([[pin.name, pin]]);

    expect(
      classifyPackagePin({
        packagePin: { padNumber: 1, pinName: "VSS", pinType: "ground" },
        pinsByName,
        selectedPinName: "PA2",
        searchResults: [],
        assignments: [],
        conflicts: []
      })
    ).toMatchObject({ isInteractive: false, classNames: expect.stringContaining("is-ground") });

    expect(
      classifyPackagePin({
        packagePin: { padNumber: 2, pinName: "PX99", pinType: "gpio" },
        pinsByName,
        selectedPinName: "PA2",
        searchResults: [],
        assignments: [],
        conflicts: []
      })
    ).toMatchObject({ isInteractive: false, classNames: expect.stringContaining("is-unmapped") });
  });
});
