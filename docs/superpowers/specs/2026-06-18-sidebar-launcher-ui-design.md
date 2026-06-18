# Sidebar Launcher UI Design

Date: 2026-06-18

## Goal

Redesign the McuPinMap Activity Bar sidebar launcher so it matches the compact VS Code sidebar style shown in the reference: small icon plus feature title rows, split into two vertical areas.

This design applies only to the Activity Bar sidebar launcher webview that currently renders `Create Default Map` and persisted project pin maps. It does not change the main Pin Map workspace React UI or its left panel.

## Requirements

- Keep plugin UI copy in English.
- Use two vertical sections:
  - Upper section: feature/action entries.
  - Lower section: persisted local `.pinmap` details only.
- Move the current `Create Default Map` entry into the upper section.
- Render `Create Default Map` as a compact row with a `+` icon and text label.
- When local `.pinmap` state exists, render map details in the lower section.
- Reserve the upper section for future feature entries, but implement only `Create Default Map` now.
- Do not add management actions such as rename, duplicate, or extra new-map controls to the lower section.
- Do not introduce a new icon library or large UI dependency.

## Recommended Approach

Use a compact tree-like list layout, similar to native VS Code sidebar sections.

The launcher body will render:

1. An `ACTIONS` section.
2. A `PIN MAPS` section.

The `ACTIONS` section always contains the `Create Default Map` row when the workspace state allows creating maps. The row uses a small fixed-width icon column and a title column.

The `PIN MAPS` section is responsible only for local persisted map state:

- If maps exist, show one compact row per map.
- If no maps exist, show a short empty state.
- If there is no workspace, show the existing no-workspace guidance in the new sectioned layout.
- If there is a store error, show the error in the new sectioned layout.

## Visual Structure

```text
McuPinMap

ACTIONS
+  Create Default Map

PIN MAPS
▣  Default Map
   GD32F407 · updated 2026-06-18
▣  Motor Control
   No chip selected · updated 2026-06-18
```

The final glyph for map rows can be a lightweight text or CSS-based icon. The `+` glyph for `Create Default Map` is required.

## Interaction

- Clicking `Create Default Map` posts the existing `createDefaultMap` message.
- Clicking a map row posts the existing `openProjectMap` message with the selected map id.
- Active map rows use the existing active state concept, updated to the new row styling.
- Hover states use VS Code theme variables.

No new message type is required for this redesign.

## Implementation Scope

Primary files:

- `src/extension/sidebarLauncher.ts`
- `test/extension/sidebarLauncher.test.ts`

The implementation should reuse existing data from `PinMapLauncherState`:

- `kind`
- `maps`
- `activeMapId`
- `message`
- map `name`, `chipId`, and `updatedAt`

No shared data model changes are required.

## Styling Notes

- Use VS Code theme variables such as:
  - `--vscode-sideBar-background`
  - `--vscode-foreground`
  - `--vscode-descriptionForeground`
  - `--vscode-list-hoverBackground`
  - `--vscode-list-activeSelectionBackground` or existing focus/active variables where appropriate
- Keep row padding compact.
- Keep icons aligned in a fixed-width column.
- Use uppercase section labels: `ACTIONS`, `PIN MAPS`.
- Preserve readable metadata with smaller, muted text.

## Error and Empty States

- `no-workspace`: show guidance to open a workspace, within the sectioned shell.
- `error`: show the escaped error message with error styling, within the sectioned shell.
- `empty`: show `Create Default Map` in `ACTIONS`, and an empty state in `PIN MAPS` such as `No local pin maps yet.`
- `ready`: show `Create Default Map` in `ACTIONS`, and map rows in `PIN MAPS`.

## Testing

Update existing sidebar launcher tests to cover:

- The launcher renders `ACTIONS` and `PIN MAPS` sections.
- `Create Default Map` still renders and posts `createDefaultMap`.
- Ready state renders map rows with names, chip metadata, and active state.
- Empty state does not render map rows and still exposes the create action.
- HTML escaping remains intact for map names, ids, chip ids, timestamps, and errors.

Recommended verification command:

```powershell
npm test
```

## Out of Scope

- Main Pin Map workspace UI changes.
- New icon packages.
- Rename, duplicate, delete, or map management actions in the lower section.
- Remote data, chip library, or package view changes.
- VSIX packaging changes.
