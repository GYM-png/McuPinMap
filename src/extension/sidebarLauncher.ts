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

const renderSection = (title: string, content: string, className: string): string => `
      <section class="launcher-section ${className}" aria-label="${escapeHtml(title)}">
        <h2>${escapeHtml(title)}</h2>
        ${content}
      </section>`;

const renderActionRow = (action: string, icon: string, label: string): string => `
        <button type="button" class="launcher-row action-row" data-action="${escapeHtml(action)}">
          <span class="launcher-row-icon">${escapeHtml(icon)}</span>
          <span class="launcher-row-main">
            <span class="launcher-row-title">${escapeHtml(label)}</span>
          </span>
        </button>`;

const renderActionsSection = (state: PinMapLauncherState): string => {
  if (state.kind === "no-workspace") {
    return renderSection(
      "ACTIONS",
      `<p class="empty-state">Open a workspace folder to create project pin maps.</p>`,
      "launcher-section-actions"
    );
  }

  if (state.kind === "error") {
    return renderSection(
      "ACTIONS",
      `<p class="empty-state">Fix the project pin map state before creating maps.</p>`,
      "launcher-section-actions"
    );
  }

  return renderSection(
    "ACTIONS",
    renderActionRow("createDefaultMap", "+", "Create Default Map"),
    "launcher-section-actions"
  );
};

const renderEmptyPinMaps = (message = "No local pin maps yet."): string =>
  `<p class="empty-state">${escapeHtml(message)}</p>`;

const renderMapRow = (map: ProjectPinMapSummary, isActive: boolean): string => {
  const chipId = map.chipId ?? "No chip selected";

  return `<div class="map-row-wrapper${isActive ? " active" : ""}">
          <button type="button" class="launcher-row map-row" data-action="openProjectMap" data-map-id="${escapeHtml(map.id)}">
            <span class="launcher-row-icon" aria-hidden="true">&#9635;</span>
            <span class="launcher-row-main">
              <span class="launcher-row-title">${escapeHtml(map.name)}</span>
              <span class="launcher-row-meta">${escapeHtml(chipId)} &middot; updated ${escapeHtml(map.updatedAt)}</span>
            </span>
          </button>
          <button type="button" class="launcher-icon-action" data-action="requestRenameProjectMap" data-map-id="${escapeHtml(map.id)}" data-map-name="${escapeHtml(map.name)}" aria-label="Rename ${escapeHtml(map.name)}" title="Rename">
            <span aria-hidden="true">...</span>
          </button>
        </div>`;
};

const renderPinMapsSection = (state: PinMapLauncherState): string => {
  if (state.kind === "no-workspace") {
    return renderSection(
      "PIN MAPS",
      renderEmptyPinMaps("Open a workspace folder to load local pin maps."),
      "launcher-section-pin-maps"
    );
  }

  if (state.kind === "error") {
    return renderSection(
      "PIN MAPS",
      `<p class="error">${escapeHtml(state.message)}</p>`,
      "launcher-section-pin-maps"
    );
  }

  if (state.kind === "empty") {
    return renderSection("PIN MAPS", renderEmptyPinMaps(), "launcher-section-pin-maps");
  }

  const rows = state.maps
    .map((map) => renderMapRow(map, map.id === state.activeMapId))
    .join("");

  return renderSection(
    "PIN MAPS",
    rows.length > 0 ? `<div class="map-list">${rows}</div>` : renderEmptyPinMaps(),
    "launcher-section-pin-maps"
  );
};

const renderLauncherBody = (state: PinMapLauncherState): string =>
  `${renderActionsSection(state)}
      ${renderPinMapsSection(state)}`;

export const renderPinMapLauncherHtml = (nonce: string, state: PinMapLauncherState): string => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
    <title>McuPinMap</title>
    <style>
      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        padding: 10px 0;
        color: var(--vscode-foreground);
        background: var(--vscode-sideBar-background);
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
      }

      .container {
        display: flex;
        min-height: calc(100vh - 20px);
        flex-direction: column;
        gap: 8px;
      }

      h1 {
        margin: 0;
        padding: 0 12px 2px;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.01em;
      }

      h2 {
        margin: 0 0 4px;
        padding: 0 12px;
        color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground));
        font-size: 11px;
        font-weight: 700;
        line-height: 1.6;
        text-transform: uppercase;
      }

      p {
        margin: 0;
        color: var(--vscode-descriptionForeground);
        line-height: 1.45;
      }

      button {
        font: inherit;
      }

      .launcher-section {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 4px 0 8px;
      }

      .launcher-section + .launcher-section {
        border-top: 1px solid var(--vscode-sideBarSectionHeader-border, rgba(128, 128, 128, 0.25));
        padding-top: 8px;
      }

      .launcher-row {
        display: grid;
        width: 100%;
        grid-template-columns: 20px minmax(0, 1fr);
        align-items: center;
        gap: 4px;
        border: 0;
        border-radius: 0;
        padding: 3px 12px;
        color: var(--vscode-foreground);
        background: transparent;
        cursor: pointer;
        text-align: left;
      }

      .launcher-row:hover,
      .map-row-wrapper:hover,
      .map-row-wrapper.active {
        background: var(--vscode-list-hoverBackground);
      }

      .map-row-wrapper.active {
        color: var(--vscode-list-activeSelectionForeground, var(--vscode-foreground));
        background: var(--vscode-list-activeSelectionBackground, var(--vscode-list-hoverBackground));
      }

      .launcher-row-icon {
        display: inline-flex;
        min-width: 20px;
        align-items: center;
        justify-content: center;
        color: var(--vscode-symbolIcon-functionForeground, var(--vscode-foreground));
        font-size: 15px;
        line-height: 1;
      }

      .action-row .launcher-row-icon {
        font-size: 18px;
      }

      .launcher-row-main {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 1px;
      }

      .launcher-row-title,
      .launcher-row-meta {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .launcher-row-title {
        font-weight: 400;
      }

      .launcher-row-meta,
      .empty-state {
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
      }

      .empty-state,
      .error {
        padding: 2px 12px;
      }

      .map-list {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .map-row-wrapper {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 28px;
        align-items: stretch;
      }

      .map-row-wrapper .launcher-row:hover {
        background: transparent;
      }

      .launcher-icon-action {
        border: 0;
        padding: 0;
        color: var(--vscode-descriptionForeground);
        background: transparent;
        cursor: pointer;
        font: inherit;
      }

      .launcher-icon-action:hover {
        color: var(--vscode-foreground);
        background: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground));
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
          mapId: button.dataset.mapId,
          mapName: button.dataset.mapName
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
