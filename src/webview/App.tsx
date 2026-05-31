import { useEffect, useState } from "react";
import type { ExtensionToWebviewMessage } from "../shared/protocol";
import type { Assignment, Chip, ChipSummary, Conflict } from "../shared/types";
import { vscode } from "./vscodeApi";

type WebviewState = {
  chips: ChipSummary[];
  selectedChipId?: string;
  chip?: Chip;
  assignments: Assignment[];
  conflicts: Conflict[];
  error?: string;
};

const initialState: WebviewState = {
  chips: [],
  assignments: [],
  conflicts: []
};

export const App = (): JSX.Element => {
  const [state, setState] = useState<WebviewState>(initialState);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionToWebviewMessage>): void => {
      const message = event.data;

      switch (message.type) {
        case "chipsLoaded":
          setState((current) => ({
            ...current,
            chips: message.chips,
            selectedChipId: message.selectedChipId,
            error: undefined
          }));
          break;

        case "chipLoaded":
          setState((current) => ({
            ...current,
            chip: message.chip,
            selectedChipId: message.chip.id,
            assignments: message.assignments,
            conflicts: message.conflicts,
            error: undefined
          }));
          break;

        case "assignmentsUpdated":
          setState((current) => ({
            ...current,
            assignments: message.assignments,
            conflicts: message.conflicts,
            error: undefined
          }));
          break;

        case "error":
          setState((current) => ({
            ...current,
            error: message.message
          }));
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
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">McuPinFunc</p>
        <h1>Pin Map Workspace</h1>
        <p className="hero-copy">
          A focused shell for exploring bundled MCU pin data, assignments, and
          conflicts inside VS Code.
        </p>
      </section>

      <section className="content-grid" aria-label="Pin map summary">
        <aside className="sidebar-card">
          <h2>Bundled Chips</h2>
          <p className="metric">{state.chips.length}</p>
          <p className="muted">Selected chip: {state.selectedChipId ?? "None"}</p>
        </aside>

        <section className="detail-card">
          <h2>{state.chip?.displayName ?? "Waiting for chip data"}</h2>
          <dl className="stats-grid">
            <div>
              <dt>Pins</dt>
              <dd>{state.chip?.pins.length ?? 0}</dd>
            </div>
            <div>
              <dt>Assignments</dt>
              <dd>{state.assignments.length}</dd>
            </div>
            <div>
              <dt>Conflicts</dt>
              <dd>{state.conflicts.length}</dd>
            </div>
          </dl>

          {state.error ? <p className="error-banner">{state.error}</p> : null}
        </section>
      </section>
    </main>
  );
};
