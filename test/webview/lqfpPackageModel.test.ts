import { describe, expect, it, vi } from "vitest";
import type { SearchResult } from "../../src/shared/data/searchIndex";
import type { Assignment, Conflict, PackageLayout, Pin } from "../../src/shared/types";
import {
  classifyPackagePin,
  deriveLqfpSides,
  getDraggedPackagePan,
  getDraggedPackageScroll,
  getCenteredPackagePan,
  getLqfpBodySize,
  getNextPackageZoom,
  getPackagePanBounds,
  stopPackageWheelScroll
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

describe("getNextPackageZoom", () => {
  it("zooms package maps in with upward wheel movement and out with downward movement", () => {
    expect(getNextPackageZoom(1, -120)).toBe(1.1);
    expect(getNextPackageZoom(1, 120)).toBe(0.9);
  });

  it("clamps wheel zoom so the package map remains usable", () => {
    expect(getNextPackageZoom(1.8, -120)).toBe(1.8);
    expect(getNextPackageZoom(0.6, 120)).toBe(0.6);
  });
});

describe("stopPackageWheelScroll", () => {
  it("prevents page scrolling when the package map consumes a wheel event", () => {
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    };

    stopPackageWheelScroll(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
  });
});

describe("getDraggedPackageScroll", () => {
  it("pans the package map opposite to mouse drag movement", () => {
    expect(
      getDraggedPackageScroll({
        startClientX: 300,
        startClientY: 200,
        currentClientX: 260,
        currentClientY: 230,
        startScrollLeft: 100,
        startScrollTop: 80
      })
    ).toEqual({
      scrollLeft: 140,
      scrollTop: 50
    });
  });
});

describe("getDraggedPackagePan", () => {
  it("moves the visible package map with the mouse drag", () => {
    expect(
      getDraggedPackagePan({
        startClientX: 300,
        startClientY: 200,
        currentClientX: 260,
        currentClientY: 230,
        startPanX: 12,
        startPanY: -8
      })
    ).toEqual({
      panX: -28,
      panY: 22
    });
  });
});

describe("getCenteredPackagePan", () => {
  it("returns the default centered package pan", () => {
    expect(getCenteredPackagePan()).toEqual({ panX: 0, panY: 0 });
  });
});

describe("getPackagePanBounds", () => {
  it("allows package content to be partly clipped while keeping a visible edge in the package map", () => {
    expect(
      getPackagePanBounds({
        viewportWidth: 800,
        viewportHeight: 600,
        contentWidth: 500,
        contentHeight: 400
      })
    ).toEqual({
      minPanX: -476,
      maxPanX: 776,
      minPanY: -376,
      maxPanY: 576
    });

    expect(
      getPackagePanBounds({
        viewportWidth: 800,
        viewportHeight: 600,
        contentWidth: 1000,
        contentHeight: 900
      })
    ).toEqual({
      minPanX: -976,
      maxPanX: 776,
      minPanY: -876,
      maxPanY: 576
    });
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
