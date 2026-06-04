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
        chips: []
      },
      clearError,
      setError
    );
    expect(error).toBe("");

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

    error = "previous error";
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
    expect(usePinMapStore.getState().chips).toEqual([]);

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
  });
});
