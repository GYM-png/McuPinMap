import { useEffect, useState } from "react";
import type { ExtensionToWebviewMessage } from "../shared/protocol";
import { AssignmentPanel } from "./components/AssignmentPanel";
import { ChipDataPanel } from "./components/ChipDataPanel";
import { ChipSelector } from "./components/ChipSelector";
import { LogicalPinMap } from "./components/LogicalPinMap";
import { PeripheralFilter } from "./components/PeripheralFilter";
import { PinDetailPanel } from "./components/PinDetailPanel";
import { SearchBox } from "./components/SearchBox";
import { Shell } from "./components/Shell";
import { handleExtensionMessage } from "./extensionMessages";
import { usePinMapStore } from "./state/usePinMapStore";
import { vscode } from "./vscodeApi";

export const App = (): JSX.Element => {
  const [error, setError] = useState<string>();
  const chip = usePinMapStore((state) => state.chip);
  const activeProjectMap = usePinMapStore((state) => state.activeProjectMap);
  const projectMapSaveStatus = usePinMapStore((state) => state.projectMapSaveStatus);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionToWebviewMessage>): void => {
      handleExtensionMessage(
        event.data,
        () => setError(undefined),
        (message) => setError(message)
      );
    };

    window.addEventListener("message", handleMessage);
    vscode.postMessage({ type: "ready" });

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const projectMapHeader = activeProjectMap ? (
    <div className="project-map-header" aria-label="Project map">
      <span>{activeProjectMap.name}</span>
      <small>{projectMapSaveStatus}</small>
      <button
        type="button"
        className="secondary-action"
        onClick={() => {
          const name = window.prompt("Rename project map", activeProjectMap.name);
          if (name?.trim()) {
            vscode.postMessage({
              type: "renameProjectMap",
              mapId: activeProjectMap.id,
              name: name.trim()
            });
          }
        }}
      >
        Rename
      </button>
      <button
        type="button"
        className="secondary-action"
        onClick={() => {
          const name = window.prompt("Duplicate project map as", `${activeProjectMap.name} Copy`);
          if (name?.trim()) {
            vscode.postMessage({
              type: "duplicateProjectMap",
              sourceMapId: activeProjectMap.id,
              name: name.trim()
            });
          }
        }}
      >
        Duplicate
      </button>
      <button
        type="button"
        className="secondary-action"
        onClick={() => {
          const name = window.prompt("New project map name", "New Map");
          if (name?.trim()) {
            vscode.postMessage({ type: "createProjectMap", name: name.trim() });
          }
        }}
      >
        New
      </button>
    </div>
  ) : undefined;

  return (
    <Shell
      error={error}
      projectMapHeader={projectMapHeader}
      sidebar={
        <>
          <ChipDataPanel />
          <ChipSelector />
          {chip ? (
            <>
              <SearchBox />
              <PeripheralFilter />
            </>
          ) : null}
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
