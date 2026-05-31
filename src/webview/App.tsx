import { useEffect, useState } from "react";
import type { ExtensionToWebviewMessage } from "../shared/protocol";
import { AssignmentPanel } from "./components/AssignmentPanel";
import { ChipSelector } from "./components/ChipSelector";
import { LogicalPinMap } from "./components/LogicalPinMap";
import { PeripheralFilter } from "./components/PeripheralFilter";
import { PinDetailPanel } from "./components/PinDetailPanel";
import { SearchBox } from "./components/SearchBox";
import { Shell } from "./components/Shell";
import { usePinMapStore } from "./state/usePinMapStore";
import { vscode } from "./vscodeApi";

export const App = (): JSX.Element => {
  const [error, setError] = useState<string>();

  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionToWebviewMessage>): void => {
      const message = event.data;
      const store = usePinMapStore.getState();

      switch (message.type) {
        case "chipsLoaded":
          store.setChips(message.chips);
          setError(undefined);
          break;

        case "chipLoaded":
          store.setChip(message.chip);
          store.setAssignments(message.assignments, message.conflicts);
          setError(undefined);
          break;

        case "assignmentsUpdated":
          store.setAssignments(message.assignments, message.conflicts);
          setError(undefined);
          break;

        case "error":
          setError(message.message);
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    vscode.postMessage({ type: "ready" });

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  return (
    <Shell
      error={error}
      sidebar={
        <>
          <ChipSelector />
          <SearchBox />
          <PeripheralFilter />
        </>
      }
      detail={
        <>
          <PinDetailPanel />
          <AssignmentPanel />
        </>
      }
    >
      <LogicalPinMap />
    </Shell>
  );
};
