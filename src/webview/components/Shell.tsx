import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type PropsWithChildren
} from "react";
import {
  getDraggedWorkspaceLayout,
  getWorkspaceLayoutFromState,
  resetWorkspaceLayout,
  setWorkspaceLayoutInState,
  type WorkspaceDivider,
  type WorkspaceLayout
} from "../workspaceLayoutModel";
import { vscode } from "../vscodeApi";

type ShellProps = PropsWithChildren<{
  sidebar: JSX.Element;
  detail: JSX.Element;
  error?: string;
}>;

type WorkspaceDragState = {
  divider: WorkspaceDivider;
  startClientX: number;
  startLayout: WorkspaceLayout;
};

const workspaceGridStyle = (
  layout: WorkspaceLayout
): CSSProperties & Record<string, string> => ({
  "--workspace-sidebar-width": `${layout.sidebarWidth}px`,
  "--workspace-detail-width": `${layout.detailWidth}px`
});

export const Shell = ({ sidebar, detail, error, children }: ShellProps): JSX.Element => {
  const [layout, setLayout] = useState(() =>
    getWorkspaceLayoutFromState(
      vscode.getState(),
      typeof window === "undefined" ? Number.POSITIVE_INFINITY : window.innerWidth
    )
  );
  const [dragState, setDragState] = useState<WorkspaceDragState>();

  const updateLayout = useCallback((nextLayout: WorkspaceLayout): void => {
    setLayout(nextLayout);
    vscode.setState(setWorkspaceLayoutInState(vscode.getState(), nextLayout));
  }, []);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handleMouseMove = (event: MouseEvent): void => {
      event.preventDefault();
      updateLayout(
        getDraggedWorkspaceLayout({
          divider: dragState.divider,
          startClientX: dragState.startClientX,
          currentClientX: event.clientX,
          startLayout: dragState.startLayout,
          viewportWidth: window.innerWidth
        })
      );
    };

    const handleMouseUp = (): void => {
      setDragState(undefined);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp, { once: true });

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, updateLayout]);

  const startResize = (divider: WorkspaceDivider, clientX: number): void => {
    setDragState({
      divider,
      startClientX: clientX,
      startLayout: layout
    });
  };

  return (
    <main className="pin-workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">McuPinFunc</p>
          <h1>Pin Map Workspace</h1>
        </div>
        <div className="workspace-header-actions">
          <p className="workspace-kicker">
            Search alternate functions, assign signals, and catch pin conflicts before firmware
            setup.
          </p>
          <button
            type="button"
            className="secondary-action workspace-reset-button"
            onClick={() => updateLayout(resetWorkspaceLayout())}
          >
            Reset layout
          </button>
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}

      <section
        className={`workspace-grid${dragState ? " is-resizing" : ""}`}
        aria-label="Pin map workspace"
        style={workspaceGridStyle(layout)}
      >
        <aside className="sidebar-region">{sidebar}</aside>
        <button
          type="button"
          className="workspace-resizer workspace-resizer-sidebar"
          aria-label="Resize left panels"
          onMouseDown={(event) => {
            event.preventDefault();
            startResize("sidebar", event.clientX);
          }}
        />
        <section className="map-region">{children}</section>
        <button
          type="button"
          className="workspace-resizer workspace-resizer-detail"
          aria-label="Resize right panels"
          onMouseDown={(event) => {
            event.preventDefault();
            startResize("detail", event.clientX);
          }}
        />
        <aside className="detail-region">{detail}</aside>
      </section>
    </main>
  );
};
