import { afterEach, describe, expect, it } from "vitest";
import type { ProjectPinMapSummary } from "../../src/shared/projectPinMapConfig";
import type { Chip } from "../../src/shared/types";
import { usePinMapStore } from "../../src/webview/state/usePinMapStore";

const createChip = (packages: Chip["packages"]): Chip => ({
  id: "gd32f407",
  displayName: "GD32F407",
  vendor: "GigaDevice",
  family: "GD32F4",
  pins: [
    { name: "PA0", port: "PA", number: 0, functions: [] },
    { name: "PA1", port: "PA", number: 1, functions: [] }
  ],
  packages
});

const lqfp100: Chip["packages"][number] = {
  packageName: "LQFP100",
  packageType: "LQFP",
  totalPads: 100,
  pins: []
};

const lqfp144: Chip["packages"][number] = {
  packageName: "LQFP144",
  packageType: "LQFP",
  totalPads: 144,
  pins: []
};

const createProjectMap = (id: string, name: string): ProjectPinMapSummary => ({
  id,
  name,
  updatedAt: `2026-06-18T00:00:00.000Z-${id}`
});

afterEach(() => {
  usePinMapStore.setState(usePinMapStore.getInitialState(), true);
});

describe("usePinMapStore package view state", () => {
  it("defaults to package view and selects the first package when package layouts exist", () => {
    usePinMapStore.getState().setChip(createChip([lqfp100, lqfp144]));

    expect(usePinMapStore.getState().mapView).toBe("package");
    expect(usePinMapStore.getState().selectedPackageName).toBe("LQFP100");
  });

  it("preserves a valid selected package across chip reloads", () => {
    const store = usePinMapStore.getState();

    store.setChip(createChip([lqfp100, lqfp144]));
    store.setSelectedPackageName("LQFP144");
    store.setChip(createChip([lqfp100, lqfp144]));

    expect(usePinMapStore.getState().selectedPackageName).toBe("LQFP144");
  });

  it("forces logical view when the chip has no package layouts", () => {
    const store = usePinMapStore.getState();

    store.setChip(createChip([lqfp100]));
    store.setMapView("package");
    store.setChip(createChip([]));

    expect(usePinMapStore.getState().mapView).toBe("logical");
    expect(usePinMapStore.getState().selectedPackageName).toBeUndefined();
  });

  it("clears the loaded chip when the installed chip list becomes empty", () => {
    const store = usePinMapStore.getState();

    store.setChip(createChip([lqfp100]));
    store.setChips([]);

    expect(usePinMapStore.getState().chip).toBeUndefined();
    expect(usePinMapStore.getState().selectedChipId).toBeUndefined();
    expect(usePinMapStore.getState().assignments).toEqual([]);
  });

  it("tracks remote search and chip data action status", () => {
    const store = usePinMapStore.getState();

    store.setRemoteQuery("gd32");
    store.setRemoteSearchLoading();
    expect(usePinMapStore.getState()).toMatchObject({
      remoteQuery: "gd32",
      remoteSearchStatus: "loading"
    });
    store.finishRemoteSearch();
    expect(usePinMapStore.getState().remoteSearchStatus).toBe("idle");

    store.setRemoteSearchLoading();

    store.setRemoteSearchResults("gd32", [
      {
        id: "GD32F407",
        displayName: "GD32F407",
        vendor: "GigaDevice",
        family: "GD32F4",
        packages: ["LQFP100"],
        status: "stable",
        chipUrl: "https://raw.githubusercontent.com/GYM-png/mcupinfunc-data/main/chips/gigadevice/gd32f4/gd32f407/chip.json",
        sourceFiles: []
      }
    ]);
    expect(usePinMapStore.getState().remoteSearchStatus).toBe("ready");
    expect(usePinMapStore.getState().remoteChips).toHaveLength(1);

    store.setRemoteQuery("h7");
    store.setRemoteSearchLoading();
    store.setRemoteSearchResults("gd32", []);
    expect(usePinMapStore.getState().remoteSearchStatus).toBe("loading");
    store.finishRemoteSearch();
    expect(usePinMapStore.getState().remoteSearchStatus).toBe("idle");
    expect(usePinMapStore.getState().remoteChips).toHaveLength(1);

    store.setDownloadingChipId("GD32F407");
    store.setImportingCsv(true);
    store.finishDownload();
    expect(usePinMapStore.getState().downloadingChipId).toBeUndefined();
    expect(usePinMapStore.getState().importingCsv).toBe(true);
    store.finishImport();
    expect(usePinMapStore.getState().importingCsv).toBe(false);
  });

  it("selects the requested project map when project maps are loaded", () => {
    const firstMap = createProjectMap("default", "Default");
    const secondMap = createProjectMap("motor", "Motor Control");

    usePinMapStore.getState().setProjectMaps([firstMap, secondMap], "motor");

    expect(usePinMapStore.getState().projectMaps).toEqual([firstMap, secondMap]);
    expect(usePinMapStore.getState().activeProjectMap).toEqual(secondMap);
  });

  it("preserves the active project map when a reload omits an active id", () => {
    const firstMap = createProjectMap("default", "Default");
    const secondMap = createProjectMap("motor", "Motor Control");

    const store = usePinMapStore.getState();
    store.setProjectMaps([firstMap, secondMap], "motor");
    store.setProjectMaps([firstMap, secondMap]);

    expect(usePinMapStore.getState().activeProjectMap).toEqual(secondMap);
  });

  it("tracks project map upserts and save status", () => {
    const firstMap = createProjectMap("default", "Default");
    const renamedMap = createProjectMap("default", "Renamed");

    const store = usePinMapStore.getState();
    store.setProjectMap(firstMap);
    store.setProjectMapSaveStatus("saving");
    store.setProjectMap(renamedMap);
    store.setProjectMapSaveStatus("saved");

    expect(usePinMapStore.getState().projectMaps).toEqual([renamedMap]);
    expect(usePinMapStore.getState().activeProjectMap).toEqual(renamedMap);
    expect(usePinMapStore.getState().projectMapSaveStatus).toBe("saved");
  });
});
