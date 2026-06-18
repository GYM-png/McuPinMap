# Project Pin Map Workspace Design

## Purpose

McuPinMap should turn the persistent activity bar entry into a useful project launcher. When a VS Code workspace is open, the extension creates and uses a `.pinmap` folder in the workspace root to store project-level Pin Map states. A project can contain multiple named maps, so users can quickly reopen saved chip and assignment configurations from the activity bar.

This design keeps chip data and project state separate. `.pinmap` stores the chip reference, selected package/view, and assignments for the project. Full chip data remains in the existing extension-managed chip library under `ExtensionContext.globalStorageUri`, populated by remote download or local CSV import.

## Goals

- Store project Pin Map configurations in `.pinmap`.
- Support multiple named maps per workspace.
- Show saved maps directly in the persistent activity bar/sidebar entry.
- Open a saved map from the sidebar and restore its selected chip, package/view, and assignments.
- Auto-save edits to the active map.
- Support creating a new map and duplicating/renaming an existing map.
- Keep export JSON/Markdown as a separate one-off export action.

## Non-Goals

- Do not copy full chip JSON data into `.pinmap`.
- Do not implement map deletion in the first version.
- Do not automatically migrate old `workspaceState` assignments into `.pinmap`.
- Do not support multiple workspace folders with separate `.pinmap` roots in the first version beyond choosing a deterministic active folder.
- Do not change remote chip download or local CSV import rules.

## File Layout

```text
.pinmap/
  index.json
  maps/
    default.json
    motor-control.json
```

`index.json` tracks the known maps and the active map.

```json
{
  "schemaVersion": 1,
  "activeMapId": "default",
  "maps": [
    {
      "id": "default",
      "name": "Default",
      "chipId": "gd32f407",
      "updatedAt": "2026-06-18T12:00:00.000Z"
    }
  ]
}
```

Each map file stores the project state needed to restore the Pin Map workspace.

```json
{
  "schemaVersion": 1,
  "id": "default",
  "name": "Default",
  "chipId": "gd32f407",
  "selectedPackageName": "LQFP100",
  "mapView": "package",
  "assignments": []
}
```

The schema is intentionally small. If a referenced `chipId` is not installed in the local chip library, the map still loads and the UI shows an install/import prompt without deleting assignments.

## Architecture

### Shared Schema

Add `src/shared/projectPinMapConfig.ts` for pure TypeScript schema definitions and helpers:

- `ProjectPinMapIndex`
- `ProjectPinMapSummary`
- `ProjectPinMapDocument`
- parse and validation functions for index and map documents
- default document creation
- map id generation from user-facing names
- duplicate-name collision handling such as `default-2`

This module should not import VS Code APIs or Node filesystem APIs, so it can be covered by Vitest.

### Extension Store

Add `src/extension/projectPinMapStore.ts` to own `.pinmap` persistence. It should:

- resolve the workspace root from `vscode.workspace.workspaceFolders`
- create `.pinmap/index.json` and `.pinmap/maps/default.json` on demand
- list maps for the sidebar
- load a map by id
- save the active map
- duplicate a map
- rename a map
- update `activeMapId`
- preserve corrupted JSON files by surfacing errors instead of overwriting them

The first version should use the first workspace folder as the active root. If no folder is open, it should return a typed error that commands and sidebar UI can present cleanly.

### Message Protocol

Extend `src/shared/protocol.ts` with project-map messages. The exact names can be adjusted during implementation, but the protocol should cover:

- extension to webview: project maps loaded, map loaded, map saved, map save failed, map metadata changed
- webview to extension: load map, create map, duplicate map, rename map, save active map

The webview continues to send assignment changes through the extension host. The extension host remains the only layer that reads or writes workspace files.

### Webview Panel

`src/extension/webviewPanel.ts` should accept an optional initial map id when opening the panel. On load, it should:

1. read the project map from `.pinmap`
2. set `selectedChipId` from the map document
3. load the chip through `ChipRepository`
4. post the chip, assignments, conflicts, and map metadata to the webview

When the user changes chip, package/view, assignments, or map metadata, the extension saves the active map document and posts save status back to the webview.

Existing `workspaceState` assignment storage should stop being the source of truth for project maps. It can remain untouched for compatibility during the first implementation, but new project-map saves should go to `.pinmap`.

### Sidebar Launcher

The persistent activity bar/sidebar should become a project map launcher:

- If no workspace folder is open, show a message that a workspace folder is required.
- If `.pinmap` does not exist, show a create-default-map action.
- If maps exist, list them directly.
- Clicking a map opens the Pin Map panel with that map active.
- Show each map's name, chip id or display name if available, and last updated time.
- Provide a new-map action. The first version can duplicate the active map when one exists; otherwise it creates an empty map.

### Webview UI

The Pin Map workspace should show the active map name near the header and expose actions for:

- rename
- duplicate
- create new map

Auto-save should run after meaningful state changes:

- selected chip changes
- selected package changes
- map view changes
- assignment added or removed
- map renamed

The UI should show save status only when helpful: saving, saved, or failed. It should avoid blocking normal assignment interaction while a save is in progress.

## Error Handling

- No workspace folder: show a clear sidebar and command error; do not create `.pinmap` outside a workspace.
- Invalid `index.json` or map JSON: show an error and leave files unchanged.
- Missing map file listed in index: show an error for that map and avoid silently deleting the index entry.
- Missing installed chip: load map metadata and assignments, show the referenced `chipId`, and prompt the user to download or import the chip.
- Save failure: keep the in-memory state in the webview and show a save error.
- Name or id collision: generate a unique id with a numeric suffix.

## Testing

Add focused Vitest coverage for:

- shared schema validation and default creation
- id generation and collision handling
- extension store create/list/load/save/duplicate/rename using temporary directories
- corrupted index/map handling
- missing workspace folder behavior
- protocol helper behavior where message construction is extracted

Run at least:

```powershell
npm test
```

If implementation changes extension build wiring, also run:

```powershell
npm run build
```

## Open Decisions For Implementation

- The first version uses the first workspace folder when multiple folders are open.
- Map deletion is postponed.
- Old `workspaceState` assignments are not migrated automatically.
- `.pinmap` is expected to be project-owned and may be committed by the user.
