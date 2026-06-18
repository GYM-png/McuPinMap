import type { ProjectPinMapSummary } from "../shared/projectPinMapConfig";

export type PinMapLauncherState =
  | { kind: "no-workspace" }
  | { kind: "error"; message: string }
  | { kind: "empty" }
  | { kind: "ready"; maps: ProjectPinMapSummary[]; activeMapId?: string };

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderLauncherBody = (state: PinMapLauncherState): string => {
  switch (state.kind) {
    case "no-workspace":
      return `<p>Open a workspace folder to use project pin maps.</p>`;

    case "error":
      return `<p class="error">${escapeHtml(state.message)}</p>`;

    case "empty":
      return `<p>No project pin maps have been created for this workspace.</p>
      <button type="button" data-action="createDefaultMap">Create Default Map</button>`;

    case "ready":
      return `<div class="map-list">
        ${state.maps
          .map((map) => {
            const isActive = map.id === state.activeMapId;
            const chipId = map.chipId ?? "No chip selected";
            return `<button type="button" class="map-row${isActive ? " active" : ""}" data-action="openProjectMap" data-map-id="${escapeHtml(map.id)}">
              <span class="map-name">${escapeHtml(map.name)}</span>
              <span class="map-meta">${escapeHtml(chipId)}</span>
              <span class="map-meta">${escapeHtml(map.updatedAt)}</span>
            </button>`;
          })
          .join("")}
      </div>
      <button type="button" data-action="newProjectMap">New Map</button>`;
  }
};

export const renderPinMapLauncherHtml = (nonce: string, state: PinMapLauncherState): string => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
    <title>McuPinMap</title>
    <style>
      body {
        box-sizing: border-box;
        margin: 0;
        padding: 16px;
        color: var(--vscode-foreground);
        background: var(--vscode-sideBar-background);
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
      }

      .container {
        display: flex;
        min-height: calc(100vh - 32px);
        flex-direction: column;
        gap: 12px;
      }

      h1 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      p {
        margin: 0;
        color: var(--vscode-descriptionForeground);
        line-height: 1.45;
      }

      button {
        width: 100%;
        border: 0;
        border-radius: 2px;
        padding: 8px 10px;
        color: var(--vscode-button-foreground);
        background: var(--vscode-button-background);
        cursor: pointer;
        font: inherit;
      }

      button:hover {
        background: var(--vscode-button-hoverBackground);
      }

      .map-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .map-row {
        display: flex;
        align-items: flex-start;
        flex-direction: column;
        gap: 3px;
        border: 1px solid var(--vscode-sideBarSectionHeader-border);
        color: var(--vscode-foreground);
        background: transparent;
        text-align: left;
      }

      .map-row:hover,
      .map-row.active {
        background: var(--vscode-list-hoverBackground);
      }

      .map-row.active {
        border-color: var(--vscode-focusBorder);
      }

      .map-name {
        font-weight: 600;
      }

      .map-meta {
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
      }

      .error {
        color: var(--vscode-errorForeground);
      }
    </style>
  </head>
  <body>
    <main class="container">
      <h1>McuPinMap</h1>
      ${renderLauncherBody(state)}
    </main>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      document.addEventListener("click", (event) => {
        const button = event.target?.closest?.("button[data-action]");
        if (!button) {
          return;
        }

        vscode.postMessage({
          type: button.dataset.action,
          mapId: button.dataset.mapId
        });
      });
    </script>
  </body>
</html>`;

export const getNonce = (): string => {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";

  for (let index = 0; index < 32; index += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
};
