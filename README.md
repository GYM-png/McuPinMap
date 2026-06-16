# McuPinMap

McuPinMap is a VS Code extension for browsing MCU GPIO alternate functions and planning pin assignments.

## Features

- Lightweight extension package without bundled chip CSV data.
- Search GitHub-hosted chip data and download only the selected chip.
- Import local chip CSV files when working with private or experimental data.
- Logical Pin Map grouped by GPIO port.
- Search by pin name, alternate function, peripheral, or signal.
- Assign alternate functions to pins.
- Detect pin overlap and duplicate peripheral-signal conflicts.
- Export assignments as JSON or Markdown.

## Data Layout

Published chip data is maintained in the separate GitHub data repository:

```text
https://github.com/GYM-png/mcupinfunc-data
```

The extension reads the remote index from:

```text
https://raw.githubusercontent.com/GYM-png/mcupinfunc-data/main/index.json
```

Each chip in the data repository lives under:

```text
chips/<vendor>/<family>/<part-number>/
```

Runtime data:

```text
chip.json
```

Source CSV data:

```text
source/<PART_NUMBER>_GPIO_AF.csv
source/<PART_NUMBER>_<PACKAGE>_PINOUT.csv
```

GPIO alternate-function files use:

```text
<PART_NUMBER>_GPIO_AF.csv
```

LQFP pinout files use:

```text
<PART_NUMBER>_<PACKAGE>_PINOUT.csv
```

Examples:

```text
chips/gigadevice/gd32f4/gd32f407/source/GD32F407_GPIO_AF.csv
```

The main repository may keep legacy development fixtures under `data/chips/`, but release VSIX packages exclude `data/**`, `generated/**`, and `external-data/**`.

## CSV Format

GPIO AF CSV files must use this header:

```csv
PinName,AF0,AF1,AF2,AF3,AF4,AF5,AF6,AF7,AF8,AF9,AF10,AF11,AF12,AF13,AF14,AF15
```

When package pinout files are added, LQFP pinout CSV files use this header:

```csv
PadNumber,PinName,PinType
```

`PadNumber` must cover every pad in the package, for example `1..144` for `LQFP144`. `PinType` is required and must be one of `gpio`, `power`, `ground`, `reset`, `clock`, `boot`, or `nc`.

## Development

Install dependencies:

```powershell
npm install
```

Run tests:

```powershell
npm test
```

Build the data pack, extension host, and Webview:

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

Validate the external data checkout:

```powershell
npm run validate:remote-data
```

Build the external data repository's per-chip `chip.json` files and root `index.json`:

```powershell
npm run build:remote-data
```

Package a lightweight VSIX that excludes chip data:

```powershell
npm run package:light
```

## Build Pipeline

`npm run build` performs these steps:

- Validate `data/chips/manifest.json` and referenced CSV files.
- Generate runtime chip JSON under `generated/chips/`.
- Compile the VS Code extension host.
- Bundle the React Webview.

Generated files are intentionally ignored by Git.

## Publishing Chip Data

The local checkout of the data repository is ignored by the main repository:

```text
external-data/mcupinfunc-data/
```

To publish data updates:

1. Add or update CSV files under `external-data/mcupinfunc-data/chips/<vendor>/<family>/<part>/source/`.
2. Run `npm run validate:remote-data`.
3. Run `npm run build:remote-data`.
4. Commit and push from `external-data/mcupinfunc-data`.
5. Verify `https://raw.githubusercontent.com/GYM-png/mcupinfunc-data/main/index.json` lists the new chip.
