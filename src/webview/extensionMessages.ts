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
      store.setChips(message.chips);
      clearError();
      break;

    case "installedChipsLoaded":
      store.setChips(message.chips);
      clearError();
      break;

    case "chipLoaded":
      store.setChip(message.chip);
      store.setAssignments(message.assignments, message.conflicts);
      clearError();
      break;

    case "assignmentsUpdated":
      store.setAssignments(message.assignments, message.conflicts);
      clearError();
      break;

    case "error":
      setError(message.message);
      break;

    case "remoteChipSearchResults":
    case "chipDownloadStarted":
    case "chipDownloadCompleted":
      clearError();
      break;
  }
};
