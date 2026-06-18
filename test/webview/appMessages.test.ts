import { afterEach, describe, expect, it } from "vitest";
import { handleExtensionMessage } from "../../src/webview/extensionMessages";
import { usePinMapStore } from "../../src/webview/state/usePinMapStore";

afterEach(() => {
  usePinMapStore.setState(usePinMapStore.getInitialState(), true);
});

describe("handleExtensionMessage", () => {
  it("updates the chip selector from installed chip refresh messages", () => {
    handleExtensionMessage(
      {
        type: "installedChipsLoaded",
        chips: [
          {
            id: "GD32F407",
            displayName: "GD32F407",
            vendor: "GigaDevice",
            family: "GD32F4"
          }
        ],
        selectedChipId: "GD32F407"
      },
      () => undefined,
      () => undefined
    );

    expect(usePinMapStore.getState().chips).toEqual([
      {
        id: "GD32F407",
        displayName: "GD32F407",
        vendor: "GigaDevice",
        family: "GD32F4"
      }
    ]);
  });

  it("clears transient errors for remote search and download status messages", () => {
    let error = "previous error";
    const clearError = (): void => {
      error = "";
    };
    const setError = (message: string): void => {
      error = message;
    };

    handleExtensionMessage(
      {
        type: "remoteChipSearchResults",
        query: "",
        chips: [
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
        ]
      },
      clearError,
      setError
    );
    expect(error).toBe("");
    expect(usePinMapStore.getState().remoteChips).toHaveLength(1);
    expect(usePinMapStore.getState().remoteSearchStatus).toBe("ready");

    usePinMapStore.getState().setRemoteQuery("new-query");
    usePinMapStore.getState().setRemoteSearchLoading();
    handleExtensionMessage(
      {
        type: "remoteChipSearchResults",
        query: "old-query",
        chips: []
      },
      clearError,
      setError
    );
    expect(usePinMapStore.getState().remoteSearchStatus).toBe("loading");
    expect(usePinMapStore.getState().remoteChips).toHaveLength(1);

    error = "previous error";
    handleExtensionMessage(
      {
        type: "chipDownloadStarted",
        chipId: "GD32F407"
      },
      clearError,
      setError
    );
    expect(error).toBe("");
    expect(usePinMapStore.getState().downloadingChipId).toBe("GD32F407");

    error = "previous error";
    usePinMapStore.getState().setImportingCsv(true);
    handleExtensionMessage(
      {
        type: "chipDownloadCompleted",
        chip: {
          id: "GD32F407",
          displayName: "GD32F407",
          vendor: "GigaDevice",
          family: "GD32F4"
        }
      },
      clearError,
      setError
    );
    expect(error).toBe("");
    expect(usePinMapStore.getState().downloadingChipId).toBeUndefined();
    expect(usePinMapStore.getState().importingCsv).toBe(true);
    expect(usePinMapStore.getState().chips).toEqual([]);

    usePinMapStore.getState().setImportingCsv(true);
    usePinMapStore.getState().setDownloadingChipId("GD32F407");
    error = "previous error";
    handleExtensionMessage(
      {
        type: "chipImportCancelled"
      },
      clearError,
      setError
    );
    expect(error).toBe("");
    expect(usePinMapStore.getState().importingCsv).toBe(false);
    expect(usePinMapStore.getState().downloadingChipId).toBe("GD32F407");

    usePinMapStore.getState().setImportingCsv(true);
    error = "previous error";
    handleExtensionMessage(
      {
        type: "chipImportCompleted",
        chip: {
          id: "LOCAL_GD32",
          displayName: "Local GD32",
          vendor: "Local",
          family: "Local"
        }
      },
      clearError,
      setError
    );
    expect(error).toBe("");
    expect(usePinMapStore.getState().importingCsv).toBe(false);
  });

  it("ends chip data activity on errors", () => {
    let error = "";
    usePinMapStore.getState().setRemoteSearchLoading();
    usePinMapStore.getState().setDownloadingChipId("GD32F407");
    usePinMapStore.getState().setImportingCsv(true);

    handleExtensionMessage(
      {
        type: "error",
        message: "network failed"
      },
      () => {
        error = "";
      },
      (message) => {
        error = message;
      }
    );

    expect(error).toBe("network failed");
    expect(usePinMapStore.getState().remoteSearchStatus).toBe("idle");
    expect(usePinMapStore.getState().downloadingChipId).toBeUndefined();
    expect(usePinMapStore.getState().importingCsv).toBe(false);
  });

  it("loads a project pin map and marks the save state as saved", () => {
    let error = "previous error";

    handleExtensionMessage(
      {
        type: "projectMapLoaded",
        map: {
          id: "default",
          name: "Default",
          updatedAt: "2026-06-18T00:00:00.000Z"
        }
      },
      () => {
        error = "";
      },
      (message) => {
        error = message;
      }
    );

    expect(error).toBe("");
    expect(usePinMapStore.getState().activeProjectMap).toEqual({
      id: "default",
      name: "Default",
      updatedAt: "2026-06-18T00:00:00.000Z"
    });
    expect(usePinMapStore.getState().projectMapSaveStatus).toBe("saved");
  });

  it("tracks project pin map save start and failure messages", () => {
    let error = "";

    handleExtensionMessage(
      {
        type: "projectMapSaveStarted"
      },
      () => {
        error = "";
      },
      (message) => {
        error = message;
      }
    );

    expect(usePinMapStore.getState().projectMapSaveStatus).toBe("saving");

    handleExtensionMessage(
      {
        type: "projectMapSaveFailed",
        message: "save failed"
      },
      () => {
        error = "";
      },
      (message) => {
        error = message;
      }
    );

    expect(error).toBe("save failed");
    expect(usePinMapStore.getState().projectMapSaveStatus).toBe("failed");
  });

  it("loads project pin map lists and preserves the active map when possible", () => {
    const firstMap = {
      id: "default",
      name: "Default",
      updatedAt: "2026-06-18T00:00:00.000Z"
    };
    const secondMap = {
      id: "motor",
      name: "Motor Control",
      updatedAt: "2026-06-18T00:01:00.000Z"
    };
    let error = "previous error";
    const clearError = (): void => {
      error = "";
    };

    handleExtensionMessage(
      {
        type: "projectMapsLoaded",
        maps: [firstMap, secondMap],
        activeMapId: "motor"
      },
      clearError,
      (message) => {
        error = message;
      }
    );
    expect(error).toBe("");
    expect(usePinMapStore.getState().activeProjectMap).toEqual(secondMap);

    handleExtensionMessage(
      {
        type: "projectMapsLoaded",
        maps: [firstMap, secondMap]
      },
      clearError,
      (message) => {
        error = message;
      }
    );

    expect(usePinMapStore.getState().activeProjectMap).toEqual(secondMap);
  });
});
