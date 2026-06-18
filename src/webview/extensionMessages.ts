import type { ExtensionToWebviewMessage } from "../shared/protocol";
import { usePinMapStore } from "./state/usePinMapStore";

export const handleExtensionMessage = (
  message: ExtensionToWebviewMessage,
  clearError: () => void,
  setError: (message: string) => void
): void => {
  const store = usePinMapStore.getState();

  switch (message.type) {
    case "chipsLoaded":
      store.setChips(message.chips, message.selectedChipId);
      clearError();
      break;

    case "installedChipsLoaded":
      store.setChips(message.chips, message.selectedChipId);
      clearError();
      break;

    case "chipLoaded":
      store.setChip(message.chip);
      store.setAssignments(message.assignments, message.conflicts);
      clearError();
      break;

    case "projectMapsLoaded":
      store.setProjectMaps(message.maps, message.activeMapId);
      clearError();
      break;

    case "projectMapLoaded":
      store.setProjectMap(message.map);
      store.setProjectMapViewState(message.mapView, message.selectedPackageName);
      store.setProjectMapSaveStatus("saved");
      clearError();
      break;

    case "projectMapSaveStarted":
      store.setProjectMapSaveStatus("saving");
      break;

    case "projectMapSaved":
      store.setProjectMap(message.map);
      store.setProjectMapSaveStatus("saved");
      clearError();
      break;

    case "projectMapSaveFailed":
      store.setProjectMapSaveStatus("failed");
      setError(message.message);
      break;

    case "assignmentsUpdated":
      store.setAssignments(message.assignments, message.conflicts);
      if (store.projectMapSaveStatus !== "failed") {
        clearError();
      }
      break;

    case "error":
      store.finishRemoteSearch();
      store.finishChipDataActions();
      setError(message.message);
      break;

    case "remoteChipSearchResults":
      store.setRemoteSearchResults(message.query, message.chips);
      clearError();
      break;

    case "chipDownloadStarted":
      store.setDownloadingChipId(message.chipId);
      clearError();
      break;

    case "chipDownloadCompleted":
      store.finishDownload();
      clearError();
      break;

    case "chipImportCancelled":
      store.finishImport();
      clearError();
      break;

    case "chipImportCompleted":
      store.finishImport();
      clearError();
      break;
  }
};
