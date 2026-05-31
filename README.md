# McuPinFunc

McuPinFunc is a VS Code extension for browsing MCU GPIO alternate functions and planning pin assignments.

## Features

- Bundled chip data packs, so users can query supported chips without downloading CSV files manually.
- Logical Pin Map grouped by GPIO port.
- Search by pin name, alternate function, peripheral, or signal.
- Assign alternate functions to pins.
- Detect pin overlap and duplicate peripheral-signal conflicts.
- Export assignments as JSON or Markdown.

## Data Layout

Chip data is stored under:

```text
data/chips/<vendor>/<family>/<part-number>/
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
data/chips/gigadevice/gd32f4/gd32f407/GD32F407_GPIO_AF.csv
```

Optional package pinout CSV files, such as `GD32F407_LQFP144_PINOUT.csv`, must be declared in the chip entry's `packages` list before they are bundled and validated. The bundled chip list is declared in `data/chips/manifest.json`.

## CSV Format

GPIO AF CSV files must use this header:

```csv
PinName,AF0,AF1,AF2,AF3,AF4,AF5,AF6,AF7,AF8,AF9,AF10,AF11,AF12,AF13,AF14,AF15
```

When package pinout files are added, LQFP pinout CSV files use this header:

```csv
PadNumber,PinName,PinType
```

`PadNumber` must cover every pad in the package, for example `1..144` for `LQFP144`. `PinType` is optional and supports values such as `gpio`, `power`, `ground`, `reset`, `clock`, `boot`, and `nc`.

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

Validate bundled chip data only:

```powershell
npm run validate:data
```

## Build Pipeline

`npm run build` performs these steps:

- Validate `data/chips/manifest.json` and referenced CSV files.
- Generate runtime chip JSON under `generated/chips/`.
- Compile the VS Code extension host.
- Bundle the React Webview.

Generated files are intentionally ignored by Git.
