# McuPinMap

[中文文档](README.zh-CN.md)

McuPinMap is a lightweight VS Code extension for exploring MCU GPIO alternate
functions and planning pin assignments. It focuses on the logical Pin Map first:
choose a chip, inspect what each IO can do, search for peripheral signals, assign
functions, and export the result for firmware or hardware notes.

## Screenshot

<p align="center">
  <img src="docs/pictures/example.gif" alt="McuPinMap Pin Map workspace" width="70%" />
</p>

## Features

- Browse GPIO alternate functions by chip.
- Search by pin name, alternate function, peripheral, or signal.
- View pins grouped by GPIO port in a logical Pin Map.
- Inspect package pinout data for LQFP and BGA packages.
- Assign alternate functions to pins.
- Detect duplicate pin usage and duplicate peripheral-signal assignments.
- Export assignments as JSON or Markdown.
- Download curated chip data on demand instead of bundling CSV data in the VSIX.
- Import local CSV data for private, experimental, or vendor-specific chips.

## Usage

Open the Pin Map workspace from VS Code:

1. Install or run the McuPinMap extension.
2. Open the command palette with `Ctrl+Shift+P`.
3. Run `McuPinMap: Open Pin Map`.

You can also open the McuPinMap activity bar view and use the Pin Map entry
there. In development, choose `Run Extension and Open Pin Map` from the VS Code
Run and Debug panel to start an Extension Development Host and open the Pin Map
automatically.

Once the workspace is open:

1. Select or download a chip from the chip library.
2. Search for a pin, peripheral, signal, or alternate function.
3. Review supported functions in the Pin Detail panel.
4. Assign functions to pins and resolve any reported conflicts.
5. Export the assignment plan as JSON or Markdown.

## Data Model

The extension package is intentionally small. Curated chip source data is kept in
the external data repository:

```text
https://github.com/GYM-png/mcupinfunc-data
```

By default, McuPinMap reads the remote chip index from:

```text
https://raw.githubusercontent.com/GYM-png/mcupinfunc-data/main/index.json
```

The URL can be changed with the VS Code setting:

```text
mcupinmap.remoteIndexUrl
```

Chip source data is organized as:

```text
chips/<vendor>/<family>/<part-number>/source/
```

Runtime chip data is generated as `chip.json` next to the source directory in
the data repository. Downloaded chips are cached in VS Code global storage for
the extension.

The main repository may keep legacy development fixtures under `data/chips/`,
but release VSIX packages exclude `data/**`, `generated/**`, and
`external-data/**`.

## CSV Formats

GPIO alternate-function CSV files use a fixed `AF0` to `AF15` table:

```csv
PinName,AF0,AF1,AF2,AF3,AF4,AF5,AF6,AF7,AF8,AF9,AF10,AF11,AF12,AF13,AF14,AF15
```

LQFP pinout CSV files use:

```csv
PadNumber,PinName,PinType
```

BGA pinout CSV files use:

```csv
BallName,PinName,PinType
```

`PinType` must be one of:

```text
gpio, power, ground, reset, clock, boot, nc
```

## Development

Install dependencies:

```powershell
npm install
```

Run tests:

```powershell
npm test
```

Build the legacy fixture data, extension host, and Webview:

```powershell
npm run build
```

Build only the extension host and Webview:

```powershell
npm run build:extension-only
```

Validate legacy fixture chip data:

```powershell
npm run validate:data
```

Package a lightweight VSIX without bundled chip data:

```powershell
npm run package:light
```

## External Data Workflow

Use a local checkout of the data repository at:

```text
external-data/mcupinfunc-data/
```

Validate the external data checkout:

```powershell
npm run validate:remote-data
```

Build per-chip `chip.json` files and the root `index.json`:

```powershell
npm run build:remote-data
```

Verify release data when the data repository tooling is available:

```powershell
npm run verify:remote-data
```

## Project Layout

```text
src/extension/    VS Code extension host integration
src/shared/       Shared validation, parsing, indexing, search, and assignment logic
src/webview/      React and Zustand Webview UI
scripts/          Data validation and build scripts
test/             Vitest test suites
resources/        Extension icons and static assets
```

Do not commit local build output, dependency folders, generated chip data, or
the external data checkout.

## Debugging in VS Code

Use the launch configurations under `.vscode/`:

- `Run Extension`
- `Run Extension and Open Pin Map`

The second configuration starts the Extension Development Host and attempts to
open the Pin Map view automatically. If it does not open, run
`McuPinMap: Open Pin Map` from the command palette.

## License

MIT
