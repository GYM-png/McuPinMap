import { describe, expect, it } from "vitest";
import {
  createDefaultProjectPinMap,
  createNextProjectPinMapId,
  createProjectPinMapDocument,
  parseProjectPinMapDocument,
  parseProjectPinMapIndex,
  summarizeProjectPinMap
} from "../../src/shared/projectPinMapConfig";
import type { Assignment } from "../../src/shared/types";

const now = "2026-06-18T12:00:00.000Z";

const assignment: Assignment = {
  id: "gd32f407:PA15:SPI0_NSS",
  chipId: "gd32f407",
  pinName: "PA15",
  functionRaw: "SPI0_NSS",
  af: "AF5",
  peripheral: "SPI0",
  signal: "NSS"
};

describe("projectPinMapConfig", () => {
  it("creates the default project pin map index and document", () => {
    const { index, map } = createDefaultProjectPinMap(now);

    expect(map).toEqual({
      schemaVersion: 1,
      id: "default",
      name: "Default",
      mapView: "package",
      assignments: [],
      updatedAt: now
    });
    expect(index).toEqual({
      schemaVersion: 1,
      activeMapId: "default",
      maps: [
        {
          id: "default",
          name: "Default",
          updatedAt: now
        }
      ]
    });
  });

  it("parses valid project pin map index and document values", () => {
    const document = createProjectPinMapDocument("motor-control", "Motor Control", now);
    const index = {
      schemaVersion: 1,
      activeMapId: "motor-control",
      maps: [summarizeProjectPinMap(document)]
    };

    expect(parseProjectPinMapDocument(document)).toEqual(document);
    expect(parseProjectPinMapIndex(index)).toEqual(index);
  });

  it("rejects invalid index schema versions with a useful error", () => {
    expect(() =>
      parseProjectPinMapIndex({
        schemaVersion: 2,
        maps: []
      })
    ).toThrow("Project pin map index schemaVersion must be 1.");
  });

  it("rejects invalid document map views with a useful error", () => {
    expect(() =>
      parseProjectPinMapDocument({
        schemaVersion: 1,
        id: "motor-control",
        name: "Motor Control",
        mapView: "board",
        assignments: [],
        updatedAt: now
      })
    ).toThrow("Project pin map document mapView must be logical or package.");
  });

  it("creates stable unique ids from names", () => {
    expect(createNextProjectPinMapId("Motor Control", new Set())).toBe("motor-control");
    expect(createNextProjectPinMapId("Motor Control", new Set(["motor-control"]))).toBe(
      "motor-control-2"
    );
    expect(createNextProjectPinMapId("   ", new Set())).toBe("pin-map");
    expect(createNextProjectPinMapId("CON", new Set())).toBe("pin-map-con");
  });

  it("summarizes project pin maps without document-only fields", () => {
    expect(
      summarizeProjectPinMap({
        schemaVersion: 1,
        id: "motor-control",
        name: "Motor Control",
        chipId: "gd32f407",
        selectedPackageName: "LQFP100",
        mapView: "logical",
        assignments: [assignment],
        updatedAt: now
      })
    ).toEqual({
      id: "motor-control",
      name: "Motor Control",
      chipId: "gd32f407",
      updatedAt: now
    });
  });
});
