# Sidebar Launcher UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Activity Bar McuPinMap sidebar launcher into a compact two-section UI with an `ACTIONS` area for `+ Create Default Map` and a `PIN MAPS` area for persisted local `.pinmap` details.

**Architecture:** Keep the launcher as a lightweight extension-host HTML renderer in `src/extension/sidebarLauncher.ts`. Split string rendering into small helpers for action rows, pin map rows, and state bodies while preserving the existing webview message protocol. Tests remain string-based in `test/extension/sidebarLauncher.test.ts` and assert behavior, section structure, escaping, and removal of the lower-section `New Map` action.

**Tech Stack:** TypeScript, VS Code WebviewView HTML, Vitest, existing `ProjectPinMapSummary` types.

---

## File Structure

- Modify `src/extension/sidebarLauncher.ts`
  - Responsibility: render self-contained launcher HTML for the VS Code Activity Bar sidebar webview.
  - Add small rendering helpers inside this file only:
    - `renderSection(title, content, className?)`
    - `renderActionRow(action, icon, label)`
    - `renderPinMapRows(state)`
    - `renderEmptyPinMaps()`
  - Keep `escapeHtml`, `PinMapLauncherState`, `renderPinMapLauncherHtml`, and `getNonce` in the same file.
  - Remove `newProjectMap` from rendered launcher UI, but do not change `webviewPanel.ts` message parsing in this plan.

- Modify `test/extension/sidebarLauncher.test.ts`
  - Responsibility: verify launcher HTML output for no-workspace, empty, ready, and error states.
  - Update tests to assert the new `ACTIONS` / `PIN MAPS` structure and compact row classes.
  - Preserve escaping coverage for map fields and error messages.

No new files are required for implementation.

---

### Task 1: Update launcher rendering tests first

**Files:**
- Modify: `test/extension/sidebarLauncher.test.ts`

- [ ] **Step 1: Replace current tests with expectations for the new sectioned UI**

Replace the contents of `test/extension/sidebarLauncher.test.ts` with:

```typescript
import { describe, expect, it } from "vitest";
import { renderPinMapLauncherHtml } from "../../src/extension/sidebarLauncher";

describe("renderPinMapLauncherHtml", () => {
  it("renders the no-workspace state without webview app assets", () => {
    const html = renderPinMapLauncherHtml("abc123", { kind: "no-workspace" });

    expect(html).toContain("McuPinMap");
    expect(html).toContain("ACTIONS");
    expect(html).toContain("PIN MAPS");
    expect(html).toContain("Open a workspace folder");
    expect(html).toContain("nonce=\"abc123\"");
    expect(html).not.toContain("dist/webview/assets/main.js");
    expect(html).not.toContain("<div id=\"root\"></div>");
  });

  it("renders create default map in the actions section for empty workspaces", () => {
    const html = renderPinMapLauncherHtml("abc123", { kind: "empty" });

    expect(html).toContain("ACTIONS");
    expect(html).toContain("PIN MAPS");
    expect(html).toContain("launcher-section-actions");
    expect(html).toContain("launcher-section-pin-maps");
    expect(html).toContain('<span class="launcher-row-icon">+</span>');
    expect(html).toContain("Create Default Map");
    expect(html).toContain("data-action=\"createDefaultMap\"");
    expect(html).toContain("No local pin maps yet.");
    expect(html).not.toContain("New Map");
    expect(html).not.toContain("data-action=\"newProjectMap\"");
  });

  it("renders project maps in the lower section without lower-section management actions", () => {
    const html = renderPinMapLauncherHtml("abc123", {
      kind: "ready",
      activeMapId: "main-map",
      maps: [
        {
          id: "main-map",
          name: "Main Board",
          chipId: "gd32f407",
          assignmentCount: 3,
          updatedAt: "2026-06-18T10:20:30.000Z"
        },
        {
          id: "motor-control",
          name: "Motor Control",
          assignmentCount: 0,
          updatedAt: "2026-06-18T11:22:33.000Z"
        }
      ]
    });

    expect(html).toContain("ACTIONS");
    expect(html).toContain("PIN MAPS");
    expect(html).toContain("Create Default Map");
    expect(html).toContain("data-action=\"createDefaultMap\"");
    expect(html).toContain("Main Board");
    expect(html).toContain("Motor Control");
    expect(html).toContain("gd32f407");
    expect(html).toContain("No chip selected");
    expect(html).toContain("2026-06-18T10:20:30.000Z");
    expect(html).toContain("openProjectMap");
    expect(html).toContain("data-map-id=\"main-map\"");
    expect(html).toContain("map-row active");
    expect(html).not.toContain("New Map");
    expect(html).not.toContain("data-action=\"newProjectMap\"");
  });

  it("escapes dynamic map content and error messages", () => {
    const mapHtml = renderPinMapLauncherHtml("abc123", {
      kind: "ready",
      activeMapId: "bad-map",
      maps: [
        {
          id: "bad-map\" onclick=\"alert(1)",
          name: "<script>",
          chipId: "<bad>",
          assignmentCount: 0,
          updatedAt: "2026-06-18T10:20:30.000Z"
        }
      ]
    });
    const errorHtml = renderPinMapLauncherHtml("abc123", {
      kind: "error",
      message: "Failed <bad>"
    });

    expect(mapHtml).toContain("&lt;script&gt;");
    expect(mapHtml).toContain("&lt;bad&gt;");
    expect(mapHtml).toContain("bad-map&quot; onclick=&quot;alert(1)");
    expect(mapHtml).not.toContain("<script>");
    expect(mapHtml).not.toContain("onclick=\"alert(1)\"");
    expect(errorHtml).toContain("ACTIONS");
    expect(errorHtml).toContain("PIN MAPS");
    expect(errorHtml).toContain("Failed &lt;bad&gt;");
    expect(errorHtml).not.toContain("Failed <bad>");
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npx vitest run test/extension/sidebarLauncher.test.ts
```

Expected: FAIL. The old renderer does not output `ACTIONS`, `PIN MAPS`, `launcher-section-actions`, the `+` icon row, or the new empty state, and still outputs `New Map` in ready state.

- [ ] **Step 3: Commit failing tests only**

Do not commit failing tests. This project should keep commits green. Proceed to Task 2 before committing.

---

### Task 2: Implement the sectioned launcher renderer

**Files:**
- Modify: `src/extension/sidebarLauncher.ts`
- Test: `test/extension/sidebarLauncher.test.ts`

- [ ] **Step 1: Replace the launcher body helpers and CSS**

In `src/extension/sidebarLauncher.ts`, replace the current `renderLauncherBody` implementation and the CSS inside `renderPinMapLauncherHtml` with the following complete file content:

```typescript
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
  const meta = `${chipId} · updated ${map.updatedAt}`;

  return `<button type="button" class="launcher-row map-row${isActive ? " active" : ""}" data-action="openProjectMap" data-map-id="${escapeHtml(map.id)}">
          <span class="launcher-row-icon" aria-hidden="true">▣</span>
          <span class="launcher-row-main">
            <span class="launcher-row-title">${escapeHtml(map.name)}</span>
            <span class="launcher-row-meta">${escapeHtml(meta)}</span>
          </span>
        </button>`;
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
      .launcher-row.active {
        background: var(--vscode-list-hoverBackground);
      }

      .launcher-row.active {
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
```

- [ ] **Step 2: Run the focused test and verify it passes**

Run:

```powershell
npx vitest run test/extension/sidebarLauncher.test.ts
```

Expected: PASS for all tests in `sidebarLauncher.test.ts`.

- [ ] **Step 3: Commit the renderer and tests**

Run:

```powershell
git status --short
git add -- src/extension/sidebarLauncher.ts test/extension/sidebarLauncher.test.ts
git commit -m "feat: redesign sidebar launcher ui"
```

Expected: commit succeeds and includes only the renderer and its tests.

---

### Task 3: Run full verification

**Files:**
- No source changes expected.

- [ ] **Step 1: Run all tests**

Run:

```powershell
npm test
```

Expected: all Vitest suites pass.

- [ ] **Step 2: Inspect git status**

Run:

```powershell
git status --short
```

Expected: no uncommitted task-related changes. If there are only planned local tool files such as `.superpowers/`, do not commit them unless they are explicitly part of the task.

- [ ] **Step 3: Report completion with evidence**

Report:

```text
Implemented sidebar launcher UI redesign.
Verification: npm test passed.
Commit: report the hash shown by `git log -1 --oneline` for `feat: redesign sidebar launcher ui`
```

If tests fail, do not report completion. Use superpowers:systematic-debugging before fixing the failure.
