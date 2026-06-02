import { afterEach, describe, expect, it } from "vitest";
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
});
