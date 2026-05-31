# McuPinFunc VS Code Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a VS Code plugin that ships bundled MCU GPIO AF data, lets users select a chip, inspect a logical Pin Map, search pins/functions/peripherals, assign functions, detect conflicts, and export the result.

**Architecture:** The extension host owns VS Code integration, bundled data loading, persistence, and export. A React Webview owns the Pin Map workspace and sends typed messages to the extension. A shared TypeScript core package owns CSV validation, normalization, indexes, search, assignments, and conflict rules so behavior is testable outside VS Code.

**Tech Stack:** TypeScript, VS Code Extension API, React, Vite, Vitest, csv-parse, Fuse.js, npm scripts.

---

## File Structure

Create this structure from the workspace root:

```text
.
  package.json
  tsconfig.json
  tsconfig.extension.json
  tsconfig.webview.json
  vite.config.ts
  vitest.config.ts
  .gitignore
  data/
    chips/
      manifest.json
      gigadevice/
        gd32f4/
          gd32f407/
            GD32F407_GPIO_AF.csv
  generated/
    chips/
      gd32f407.json
  scripts/
    build-data-pack.ts
    validate-data-pack.ts
  src/
    extension/
      extension.ts
      webviewPanel.ts
      chipRepository.ts
      exportConfig.ts
    shared/
      types.ts
      csv/
        parseGpioAfCsv.ts
        validateGpioAfCsv.ts
        validateManifest.ts
      data/
        normalizeChip.ts
        buildIndexes.ts
        searchIndex.ts
      config/
        assignmentStore.ts
        conflictEngine.ts
      protocol.ts
    webview/
      main.tsx
      App.tsx
      vscodeApi.ts
      state/
        usePinMapStore.ts
      components/
        Shell.tsx
        ChipSelector.tsx
        SearchBox.tsx
        PeripheralFilter.tsx
        LogicalPinMap.tsx
        PinDetailPanel.tsx
        AssignmentPanel.tsx
      styles.css
  test/
    fixtures/
      gpio-af-small.csv
      manifest-small.json
      invalid-missing-pinname.csv
    shared/
      parseGpioAfCsv.test.ts
      validateGpioAfCsv.test.ts
      validateManifest.test.ts
      buildIndexes.test.ts
      searchIndex.test.ts
      conflictEngine.test.ts
    extension/
      exportConfig.test.ts
```

Responsibilities:

- `data/chips/**`: Source CSV data shipped with the plugin.
- `generated/chips/**`: Build output generated from CSV and loaded at runtime.
- `scripts/**`: Data validation and build commands run locally and in CI.
- `src/shared/**`: Pure logic that can be unit tested without VS Code.
- `src/extension/**`: VS Code commands, Webview panel, bundled data loading, persistence, export.
- `src/webview/**`: React UI rendered inside the Webview.
- `test/**`: Fixtures and unit tests.

## Task 1: Initialize Project Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.extension.json`
- Create: `tsconfig.webview.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Initialize git if the workspace is not a repository**

Run:

```powershell
if (-not (Test-Path .git)) { git init }
```

Expected: `Initialized empty Git repository` when no repository exists, or no output when `.git` already exists.

- [ ] **Step 2: Create package manifest**

Write `package.json`:

```json
{
  "name": "mcupinfunc",
  "displayName": "McuPinFunc",
  "description": "VS Code Pin Map workspace for MCU GPIO alternate functions.",
  "version": "0.0.1",
  "publisher": "local-dev",
  "engines": {
    "vscode": "^1.90.0"
  },
  "categories": ["Other"],
  "activationEvents": [
    "onCommand:mcupinfunc.openPinMap"
  ],
  "main": "./dist/extension/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "mcupinfunc.openPinMap",
        "title": "McuPinFunc: Open Pin Map"
      }
    ]
  },
  "scripts": {
    "clean": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true});require('fs').rmSync('generated',{recursive:true,force:true})\"",
    "validate:data": "tsx scripts/validate-data-pack.ts",
    "build:data": "tsx scripts/build-data-pack.ts",
    "build:extension": "tsc -p tsconfig.extension.json",
    "build:webview": "vite build",
    "build": "npm run validate:data && npm run build:data && npm run build:extension && npm run build:webview",
    "test": "vitest run",
    "watch:webview": "vite build --watch"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "csv-parse": "^5.5.6",
    "fuse.js": "^7.0.0",
    "vite": "^6.0.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/vscode": "^1.90.0",
    "@vscode/test-electron": "^2.4.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.8.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 3: Create TypeScript configs**

Write `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "baseUrl": "."
  }
}
```

Write `tsconfig.extension.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node", "vscode"]
  },
  "include": ["src/extension/**/*.ts", "src/shared/**/*.ts"]
}
```

Write `tsconfig.webview.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["vite/client"]
  },
  "include": ["src/webview/**/*.ts", "src/webview/**/*.tsx", "src/shared/**/*.ts"]
}
```

- [ ] **Step 4: Create build configs**

Write `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/webview",
    emptyOutDir: true,
    rollupOptions: {
      input: "src/webview/main.tsx",
      output: {
        entryFileNames: "assets/main.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/main[extname]"
      }
    }
  }
});
```

Write `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"]
  }
});
```

Write `.gitignore`:

```gitignore
node_modules/
dist/
generated/
.vscode-test/
.superpowers/
*.vsix
```

- [ ] **Step 5: Install dependencies**

Run:

```powershell
npm install
```

Expected: `node_modules` and `package-lock.json` are created.

- [ ] **Step 6: Commit tooling**

Run:

```powershell
git add package.json package-lock.json tsconfig.json tsconfig.extension.json tsconfig.webview.json vite.config.ts vitest.config.ts .gitignore
git commit -m "chore: initialize vscode extension tooling"
```

Expected: commit succeeds.

## Task 2: Create Shared Types and Protocol

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/protocol.ts`
- Test: `test/shared/types.test.ts` is not needed because these files define compile-time contracts.

- [ ] **Step 1: Create shared domain types**

Write `src/shared/types.ts`:

```ts
export type PinType = "gpio" | "power" | "ground" | "reset" | "clock" | "boot" | "nc";

export type PinFunction = {
  af: string;
  raw: string;
  peripheral: string;
  signal: string;
  aliases: string[];
};

export type Pin = {
  name: string;
  port: string;
  number: number;
  functions: PinFunction[];
};

export type PackagePin = {
  padNumber: number;
  pinName: string;
  pinType?: PinType;
};

export type PackageLayout = {
  packageName: string;
  packageType: "LQFP";
  totalPads: number;
  orientation?: "pin1-top-left";
  pins: PackagePin[];
};

export type Chip = {
  id: string;
  displayName: string;
  vendor: string;
  family: string;
  pins: Pin[];
  packages: PackageLayout[];
};

export type ChipManifestEntry = {
  id: string;
  vendor: string;
  family: string;
  displayName: string;
  gpioAfCsv: string;
  packages: Array<{
    name: string;
    pinoutCsv: string;
  }>;
  source: string;
  status: "draft" | "stable";
};

export type ChipManifest = {
  schemaVersion: 1;
  dataVersion: string;
  chips: ChipManifestEntry[];
};

export type Assignment = {
  id: string;
  chipId: string;
  pinName: string;
  functionRaw: string;
  af: string;
  peripheral: string;
  signal: string;
};

export type Conflict = {
  id: string;
  kind: "pin-overlap" | "signal-duplicate";
  message: string;
  assignmentIds: string[];
};

export type ChipSummary = {
  id: string;
  displayName: string;
  vendor: string;
  family: string;
};
```

- [ ] **Step 2: Create Webview message protocol**

Write `src/shared/protocol.ts`:

```ts
import type { Assignment, Chip, ChipSummary, Conflict } from "./types";

export type ExtensionToWebviewMessage =
  | { type: "chipsLoaded"; chips: ChipSummary[]; selectedChipId?: string }
  | { type: "chipLoaded"; chip: Chip; assignments: Assignment[]; conflicts: Conflict[] }
  | { type: "assignmentsUpdated"; assignments: Assignment[]; conflicts: Conflict[] }
  | { type: "error"; message: string };

export type WebviewToExtensionMessage =
  | { type: "ready" }
  | { type: "selectChip"; chipId: string }
  | { type: "assignFunction"; assignment: Assignment }
  | { type: "removeAssignment"; assignmentId: string }
  | { type: "export"; format: "json" | "markdown" };
```

- [ ] **Step 3: Verify TypeScript compiles enough to fail only on missing entry files**

Run:

```powershell
npm run build:extension
```

Expected: PASS and TypeScript emits shared files under `dist/shared`. The extension entry point is added in Task 9.

- [ ] **Step 4: Commit shared contracts**

Run:

```powershell
git add src/shared/types.ts src/shared/protocol.ts
git commit -m "feat: define shared chip and webview contracts"
```

Expected: commit succeeds.

## Task 3: Add Bundled Data Directory and Manifest

**Files:**
- Create: `data/chips/manifest.json`
- Create: `data/chips/gigadevice/gd32f4/gd32f407/GD32F407_GPIO_AF.csv`
- Modify: keep original `GPIO_AF_CSVs/GD32F407_GPIO_AF.csv` as source reference unless the project owner later removes it.

- [ ] **Step 1: Create bundled chip directory**

Run:

```powershell
New-Item -ItemType Directory -Force -Path 'data/chips/gigadevice/gd32f4/gd32f407'
Copy-Item 'GPIO_AF_CSVs/GD32F407_GPIO_AF.csv' 'data/chips/gigadevice/gd32f4/gd32f407/GD32F407_GPIO_AF.csv'
```

Expected: copied CSV exists at `data/chips/gigadevice/gd32f4/gd32f407/GD32F407_GPIO_AF.csv`.

- [ ] **Step 2: Create manifest**

Write `data/chips/manifest.json`:

```json
{
  "schemaVersion": 1,
  "dataVersion": "2026.05.31",
  "chips": [
    {
      "id": "GD32F407",
      "vendor": "GigaDevice",
      "family": "GD32F4",
      "displayName": "GD32F407",
      "gpioAfCsv": "gigadevice/gd32f4/gd32f407/GD32F407_GPIO_AF.csv",
      "packages": [],
      "source": "GD32F407 GPIO AF CSV curated in this repository",
      "status": "stable"
    }
  ]
}
```

- [ ] **Step 3: Commit bundled data seed**

Run:

```powershell
git add data/chips/manifest.json data/chips/gigadevice/gd32f4/gd32f407/GD32F407_GPIO_AF.csv
git commit -m "feat: add bundled GD32F407 data pack"
```

Expected: commit succeeds.

## Task 4: Validate Manifest and GPIO AF CSV

**Files:**
- Create: `src/shared/csv/validateManifest.ts`
- Create: `src/shared/csv/validateGpioAfCsv.ts`
- Create: `test/fixtures/manifest-small.json`
- Create: `test/fixtures/gpio-af-small.csv`
- Create: `test/fixtures/invalid-missing-pinname.csv`
- Create: `test/shared/validateManifest.test.ts`
- Create: `test/shared/validateGpioAfCsv.test.ts`

- [ ] **Step 1: Write manifest validation tests**

Write `test/shared/validateManifest.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateManifest } from "../../src/shared/csv/validateManifest";

describe("validateManifest", () => {
  it("accepts schema version 1 with one chip", () => {
    const result = validateManifest({
      schemaVersion: 1,
      dataVersion: "2026.05.31",
      chips: [
        {
          id: "GD32F407",
          vendor: "GigaDevice",
          family: "GD32F4",
          displayName: "GD32F407",
          gpioAfCsv: "gigadevice/gd32f4/gd32f407/GD32F407_GPIO_AF.csv",
          packages: [],
          source: "fixture",
          status: "stable"
        }
      ]
    });

    expect(result.errors).toEqual([]);
  });

  it("rejects a gpioAfCsv that does not match the chip id", () => {
    const result = validateManifest({
      schemaVersion: 1,
      dataVersion: "2026.05.31",
      chips: [
        {
          id: "GD32F407",
          vendor: "GigaDevice",
          family: "GD32F4",
          displayName: "GD32F407",
          gpioAfCsv: "gigadevice/gd32f4/gd32f407/GD32F405_GPIO_AF.csv",
          packages: [],
          source: "fixture",
          status: "stable"
        }
      ]
    });

    expect(result.errors).toContain("Chip GD32F407 must reference a GPIO AF CSV named GD32F407_GPIO_AF.csv.");
  });
});
```

- [ ] **Step 2: Write manifest validator**

Write `src/shared/csv/validateManifest.ts`:

```ts
import type { ChipManifest } from "../types";

export type ValidationResult = {
  errors: string[];
  warnings: string[];
};

export function validateManifest(input: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const manifest = input as Partial<ChipManifest>;

  if (manifest.schemaVersion !== 1) {
    errors.push("Manifest schemaVersion must be 1.");
  }

  if (typeof manifest.dataVersion !== "string" || manifest.dataVersion.length === 0) {
    errors.push("Manifest dataVersion must be a non-empty string.");
  }

  if (!Array.isArray(manifest.chips)) {
    errors.push("Manifest chips must be an array.");
    return { errors, warnings };
  }

  const seen = new Set<string>();
  for (const chip of manifest.chips as Array<Record<string, unknown>>) {
    const id = chip.id;
    if (typeof id !== "string" || id.length === 0) {
      errors.push("Each chip must have a non-empty id.");
      continue;
    }

    if (seen.has(id)) {
      errors.push(`Duplicate chip id ${id}.`);
    }
    seen.add(id);

    const gpioAfCsv = chip.gpioAfCsv;
    const expectedFile = `${id}_GPIO_AF.csv`;
    if (typeof gpioAfCsv !== "string" || !gpioAfCsv.endsWith(expectedFile)) {
      errors.push(`Chip ${id} must reference a GPIO AF CSV named ${expectedFile}.`);
    }

    const packages = chip.packages;
    if (!Array.isArray(packages)) {
      errors.push(`Chip ${id} packages must be an array.`);
    }
  }

  return { errors, warnings };
}
```

- [ ] **Step 3: Write GPIO AF CSV fixture files**

Write `test/fixtures/gpio-af-small.csv`:

```csv
PinName,AF0,AF1,AF2,AF3,AF4,AF5,AF6,AF7,AF8,AF9,AF10,AF11,AF12,AF13,AF14,AF15
PA9,,TIMER0_CH1,,,I2C2_SMBA,SPI1_SCK/I2S1_CK,,USART0_TX,,,,,SDIO_D2,DCI_D0,,EVENTOUT
PA10,,TIMER0_CH2,,,I2C2_TXFRAME,,,USART0_RX,,,USBFS_ID,,,DCI_D1,,EVENTOUT
```

Write `test/fixtures/invalid-missing-pinname.csv`:

```csv
Pin,AF0,AF1
PA9,,TIMER0_CH1
```

- [ ] **Step 4: Write GPIO AF validation tests**

Write `test/shared/validateGpioAfCsv.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateGpioAfCsvText } from "../../src/shared/csv/validateGpioAfCsv";

describe("validateGpioAfCsvText", () => {
  it("accepts PinName and AF0 through AF15 headers", () => {
    const csv = readFileSync("test/fixtures/gpio-af-small.csv", "utf8");
    const result = validateGpioAfCsvText(csv);

    expect(result.errors).toEqual([]);
  });

  it("rejects a missing PinName column", () => {
    const csv = readFileSync("test/fixtures/invalid-missing-pinname.csv", "utf8");
    const result = validateGpioAfCsvText(csv);

    expect(result.errors).toContain("GPIO AF CSV header must start with PinName.");
  });
});
```

- [ ] **Step 5: Write GPIO AF validator**

Write `src/shared/csv/validateGpioAfCsv.ts`:

```ts
import { parse } from "csv-parse/sync";
import type { ValidationResult } from "./validateManifest";

const AF_HEADERS = Array.from({ length: 16 }, (_, index) => `AF${index}`);

export function validateGpioAfCsvText(csvText: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rows = parse(csvText, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true
  }) as string[][];

  if (rows.length === 0) {
    return { errors: ["GPIO AF CSV must contain a header row."], warnings };
  }

  const header = rows[0];
  if (header[0] !== "PinName") {
    errors.push("GPIO AF CSV header must start with PinName.");
  }

  const expected = ["PinName", ...AF_HEADERS];
  if (header.join(",") !== expected.join(",")) {
    errors.push(`GPIO AF CSV header must be exactly ${expected.join(",")}.`);
  }

  const pinNames = new Set<string>();
  for (const [index, row] of rows.slice(1).entries()) {
    const lineNumber = index + 2;
    const pinName = row[0];
    if (!/^P[A-Z][0-9]+$/.test(pinName)) {
      warnings.push(`Line ${lineNumber} pin name ${pinName} does not match GPIO pattern P<port><number>.`);
    }
    if (pinNames.has(pinName)) {
      errors.push(`Duplicate pin name ${pinName}.`);
    }
    pinNames.add(pinName);
  }

  return { errors, warnings };
}
```

- [ ] **Step 6: Run validator tests**

Run:

```powershell
npm test -- test/shared/validateManifest.test.ts test/shared/validateGpioAfCsv.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit validators**

Run:

```powershell
git add src/shared/csv/validateManifest.ts src/shared/csv/validateGpioAfCsv.ts test/fixtures test/shared/validateManifest.test.ts test/shared/validateGpioAfCsv.test.ts
git commit -m "feat: validate bundled chip data files"
```

Expected: commit succeeds.

## Task 5: Parse and Normalize GPIO AF CSV

**Files:**
- Create: `src/shared/csv/parseGpioAfCsv.ts`
- Create: `src/shared/data/normalizeChip.ts`
- Create: `test/shared/parseGpioAfCsv.test.ts`

- [ ] **Step 1: Write parser tests**

Write `test/shared/parseGpioAfCsv.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseGpioAfCsvText } from "../../src/shared/csv/parseGpioAfCsv";

describe("parseGpioAfCsvText", () => {
  it("splits slash-separated functions into separate PinFunction records", () => {
    const csv = readFileSync("test/fixtures/gpio-af-small.csv", "utf8");
    const pins = parseGpioAfCsvText(csv);
    const pa9 = pins.find((pin) => pin.name === "PA9");

    expect(pa9?.functions).toContainEqual({
      af: "AF5",
      raw: "SPI1_SCK",
      peripheral: "SPI1",
      signal: "SCK",
      aliases: ["SPI1_SCK"]
    });
    expect(pa9?.functions).toContainEqual({
      af: "AF5",
      raw: "I2S1_CK",
      peripheral: "I2S1",
      signal: "CK",
      aliases: ["I2S1_CK"]
    });
  });

  it("parses pin port and number", () => {
    const csv = readFileSync("test/fixtures/gpio-af-small.csv", "utf8");
    const pins = parseGpioAfCsvText(csv);

    expect(pins[0]).toMatchObject({ name: "PA9", port: "A", number: 9 });
  });
});
```

- [ ] **Step 2: Write parser**

Write `src/shared/csv/parseGpioAfCsv.ts`:

```ts
import { parse } from "csv-parse/sync";
import type { Pin, PinFunction } from "../types";

type CsvRecord = Record<string, string>;

export function parseGpioAfCsvText(csvText: string): Pin[] {
  const records = parse(csvText, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as CsvRecord[];

  return records.map((record) => {
    const pinName = record.PinName;
    const match = /^P([A-Z])([0-9]+)$/.exec(pinName);
    const functions: PinFunction[] = [];

    for (let afIndex = 0; afIndex <= 15; afIndex += 1) {
      const af = `AF${afIndex}`;
      const cell = record[af];
      if (!cell) {
        continue;
      }

      for (const raw of cell.split("/").map((value) => value.trim()).filter(Boolean)) {
        functions.push(parseFunction(af, raw));
      }
    }

    return {
      name: pinName,
      port: match?.[1] ?? "",
      number: Number(match?.[2] ?? -1),
      functions
    };
  });
}

function parseFunction(af: string, raw: string): PinFunction {
  const separatorIndex = raw.indexOf("_");
  if (separatorIndex === -1) {
    return {
      af,
      raw,
      peripheral: raw,
      signal: raw,
      aliases: [raw]
    };
  }

  return {
    af,
    raw,
    peripheral: raw.slice(0, separatorIndex),
    signal: raw.slice(separatorIndex + 1),
    aliases: [raw]
  };
}
```

- [ ] **Step 3: Write chip normalizer**

Write `src/shared/data/normalizeChip.ts`:

```ts
import type { Chip, ChipManifestEntry, Pin } from "../types";

export function normalizeChip(entry: ChipManifestEntry, pins: Pin[]): Chip {
  return {
    id: entry.id,
    displayName: entry.displayName,
    vendor: entry.vendor,
    family: entry.family,
    pins: pins.slice().sort(comparePins),
    packages: []
  };
}

function comparePins(left: Pin, right: Pin): number {
  if (left.port !== right.port) {
    return left.port.localeCompare(right.port);
  }
  return left.number - right.number;
}
```

- [ ] **Step 4: Run parser tests**

Run:

```powershell
npm test -- test/shared/parseGpioAfCsv.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit parser and normalizer**

Run:

```powershell
git add src/shared/csv/parseGpioAfCsv.ts src/shared/data/normalizeChip.ts test/shared/parseGpioAfCsv.test.ts
git commit -m "feat: parse and normalize GPIO AF data"
```

Expected: commit succeeds.

## Task 6: Build Search and Pin Indexes

**Files:**
- Create: `src/shared/data/buildIndexes.ts`
- Create: `src/shared/data/searchIndex.ts`
- Create: `test/shared/buildIndexes.test.ts`
- Create: `test/shared/searchIndex.test.ts`

- [ ] **Step 1: Write index tests**

Write `test/shared/buildIndexes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildChipIndexes } from "../../src/shared/data/buildIndexes";
import type { Chip } from "../../src/shared/types";

const chip: Chip = {
  id: "GD32F407",
  displayName: "GD32F407",
  vendor: "GigaDevice",
  family: "GD32F4",
  packages: [],
  pins: [
    {
      name: "PA9",
      port: "A",
      number: 9,
      functions: [{ af: "AF7", raw: "USART0_TX", peripheral: "USART0", signal: "TX", aliases: ["USART0_TX"] }]
    }
  ]
};

describe("buildChipIndexes", () => {
  it("indexes functions by pin and pins by function", () => {
    const indexes = buildChipIndexes(chip);

    expect(indexes.functionsByPin.get("PA9")?.[0].raw).toBe("USART0_TX");
    expect(indexes.pinsByFunction.get("USART0_TX")).toEqual(["PA9"]);
    expect(indexes.pinsByPeripheral.get("USART0")).toEqual(["PA9"]);
  });
});
```

- [ ] **Step 2: Write index builder**

Write `src/shared/data/buildIndexes.ts`:

```ts
import type { Chip, PinFunction } from "../types";

export type ChipIndexes = {
  functionsByPin: Map<string, PinFunction[]>;
  pinsByFunction: Map<string, string[]>;
  pinsByPeripheral: Map<string, string[]>;
};

export function buildChipIndexes(chip: Chip): ChipIndexes {
  const functionsByPin = new Map<string, PinFunction[]>();
  const pinsByFunction = new Map<string, string[]>();
  const pinsByPeripheral = new Map<string, string[]>();

  for (const pin of chip.pins) {
    functionsByPin.set(pin.name, pin.functions);
    for (const fn of pin.functions) {
      pushUnique(pinsByFunction, fn.raw, pin.name);
      pushUnique(pinsByPeripheral, fn.peripheral, pin.name);
    }
  }

  return { functionsByPin, pinsByFunction, pinsByPeripheral };
}

function pushUnique(map: Map<string, string[]>, key: string, value: string): void {
  const values = map.get(key) ?? [];
  if (!values.includes(value)) {
    values.push(value);
  }
  map.set(key, values);
}
```

- [ ] **Step 3: Write search tests**

Write `test/shared/searchIndex.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createSearchIndex } from "../../src/shared/data/searchIndex";
import type { Chip } from "../../src/shared/types";

const chip: Chip = {
  id: "GD32F407",
  displayName: "GD32F407",
  vendor: "GigaDevice",
  family: "GD32F4",
  packages: [],
  pins: [
    {
      name: "PA9",
      port: "A",
      number: 9,
      functions: [{ af: "AF7", raw: "USART0_TX", peripheral: "USART0", signal: "TX", aliases: ["USART0_TX"] }]
    }
  ]
};

describe("createSearchIndex", () => {
  it("finds a pin by pin name", () => {
    const index = createSearchIndex(chip);
    expect(index.search("PA9")).toContainEqual({ kind: "pin", pinName: "PA9", label: "PA9" });
  });

  it("finds pins by peripheral function", () => {
    const index = createSearchIndex(chip);
    expect(index.search("USART0_TX")[0]).toMatchObject({ kind: "function", pinName: "PA9", label: "USART0_TX" });
  });
});
```

- [ ] **Step 4: Write search index**

Write `src/shared/data/searchIndex.ts`:

```ts
import Fuse from "fuse.js";
import type { Chip } from "../types";

export type SearchResult = {
  kind: "pin" | "function" | "peripheral";
  pinName: string;
  label: string;
};

export function createSearchIndex(chip: Chip): { search(query: string): SearchResult[] } {
  const rows: SearchResult[] = [];

  for (const pin of chip.pins) {
    rows.push({ kind: "pin", pinName: pin.name, label: pin.name });
    for (const fn of pin.functions) {
      rows.push({ kind: "function", pinName: pin.name, label: fn.raw });
      rows.push({ kind: "peripheral", pinName: pin.name, label: fn.peripheral });
    }
  }

  const fuse = new Fuse(rows, {
    keys: ["label", "pinName"],
    threshold: 0.25,
    ignoreLocation: true
  });

  return {
    search(query: string): SearchResult[] {
      const trimmed = query.trim().toUpperCase();
      if (!trimmed) {
        return [];
      }

      const exact = rows.filter((row) => row.label.toUpperCase().includes(trimmed) || row.pinName.toUpperCase() === trimmed);
      if (exact.length > 0) {
        return dedupe(exact);
      }

      return dedupe(fuse.search(trimmed).map((result) => result.item));
    }
  };
}

function dedupe(rows: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.kind}:${row.pinName}:${row.label}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
```

- [ ] **Step 5: Run index tests**

Run:

```powershell
npm test -- test/shared/buildIndexes.test.ts test/shared/searchIndex.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit indexes**

Run:

```powershell
git add src/shared/data/buildIndexes.ts src/shared/data/searchIndex.ts test/shared/buildIndexes.test.ts test/shared/searchIndex.test.ts
git commit -m "feat: add pin and function indexes"
```

Expected: commit succeeds.

## Task 7: Add Assignment and Conflict Engine

**Files:**
- Create: `src/shared/config/conflictEngine.ts`
- Create: `src/shared/config/assignmentStore.ts`
- Create: `test/shared/conflictEngine.test.ts`

- [ ] **Step 1: Write conflict tests**

Write `test/shared/conflictEngine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { detectConflicts } from "../../src/shared/config/conflictEngine";
import type { Assignment } from "../../src/shared/types";

describe("detectConflicts", () => {
  it("detects two functions assigned to the same pin", () => {
    const assignments: Assignment[] = [
      { id: "a1", chipId: "GD32F407", pinName: "PA9", functionRaw: "USART0_TX", af: "AF7", peripheral: "USART0", signal: "TX" },
      { id: "a2", chipId: "GD32F407", pinName: "PA9", functionRaw: "SDIO_D2", af: "AF12", peripheral: "SDIO", signal: "D2" }
    ];

    expect(detectConflicts(assignments)).toEqual([
      {
        id: "pin-overlap:PA9",
        kind: "pin-overlap",
        message: "PA9 has 2 assigned functions.",
        assignmentIds: ["a1", "a2"]
      }
    ]);
  });

  it("detects duplicate peripheral signal assignments", () => {
    const assignments: Assignment[] = [
      { id: "a1", chipId: "GD32F407", pinName: "PA9", functionRaw: "USART0_TX", af: "AF7", peripheral: "USART0", signal: "TX" },
      { id: "a2", chipId: "GD32F407", pinName: "PB6", functionRaw: "USART0_TX", af: "AF7", peripheral: "USART0", signal: "TX" }
    ];

    expect(detectConflicts(assignments)[0]).toMatchObject({
      id: "signal-duplicate:USART0:TX",
      kind: "signal-duplicate"
    });
  });
});
```

- [ ] **Step 2: Write conflict engine**

Write `src/shared/config/conflictEngine.ts`:

```ts
import type { Assignment, Conflict } from "../types";

export function detectConflicts(assignments: Assignment[]): Conflict[] {
  return [...detectPinOverlaps(assignments), ...detectSignalDuplicates(assignments)];
}

function detectPinOverlaps(assignments: Assignment[]): Conflict[] {
  const byPin = groupBy(assignments, (assignment) => assignment.pinName);
  const conflicts: Conflict[] = [];

  for (const [pinName, rows] of byPin) {
    if (rows.length > 1) {
      conflicts.push({
        id: `pin-overlap:${pinName}`,
        kind: "pin-overlap",
        message: `${pinName} has ${rows.length} assigned functions.`,
        assignmentIds: rows.map((row) => row.id)
      });
    }
  }

  return conflicts;
}

function detectSignalDuplicates(assignments: Assignment[]): Conflict[] {
  const bySignal = groupBy(assignments, (assignment) => `${assignment.peripheral}:${assignment.signal}`);
  const conflicts: Conflict[] = [];

  for (const [key, rows] of bySignal) {
    if (rows.length > 1) {
      const [peripheral, signal] = key.split(":");
      conflicts.push({
        id: `signal-duplicate:${peripheral}:${signal}`,
        kind: "signal-duplicate",
        message: `${peripheral}_${signal} is assigned to ${rows.length} pins.`,
        assignmentIds: rows.map((row) => row.id)
      });
    }
  }

  return conflicts;
}

function groupBy<T>(rows: T[], getKey: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = getKey(row);
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return map;
}
```

- [ ] **Step 3: Write assignment reducer**

Write `src/shared/config/assignmentStore.ts`:

```ts
import type { Assignment } from "../types";

export function upsertAssignment(assignments: Assignment[], next: Assignment): Assignment[] {
  const withoutSameId = assignments.filter((assignment) => assignment.id !== next.id);
  return [...withoutSameId, next];
}

export function removeAssignment(assignments: Assignment[], assignmentId: string): Assignment[] {
  return assignments.filter((assignment) => assignment.id !== assignmentId);
}

export function createAssignmentId(chipId: string, pinName: string, functionRaw: string): string {
  return `${chipId}:${pinName}:${functionRaw}`;
}
```

- [ ] **Step 4: Run conflict tests**

Run:

```powershell
npm test -- test/shared/conflictEngine.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit config engine**

Run:

```powershell
git add src/shared/config/conflictEngine.ts src/shared/config/assignmentStore.ts test/shared/conflictEngine.test.ts
git commit -m "feat: detect pin assignment conflicts"
```

Expected: commit succeeds.

## Task 8: Build Data Pack Scripts

**Files:**
- Create: `scripts/validate-data-pack.ts`
- Create: `scripts/build-data-pack.ts`
- Generated at runtime: `generated/chips/gd32f407.json`

- [ ] **Step 1: Write data validation script**

Write `scripts/validate-data-pack.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateGpioAfCsvText } from "../src/shared/csv/validateGpioAfCsv";
import { validateManifest } from "../src/shared/csv/validateManifest";
import type { ChipManifest } from "../src/shared/types";

const root = process.cwd();
const manifestPath = join(root, "data/chips/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ChipManifest;
const manifestResult = validateManifest(manifest);
const errors = [...manifestResult.errors];
const warnings = [...manifestResult.warnings];

for (const chip of manifest.chips) {
  const csvPath = join(root, "data/chips", chip.gpioAfCsv);
  const csvText = readFileSync(csvPath, "utf8");
  const csvResult = validateGpioAfCsvText(csvText);
  errors.push(...csvResult.errors.map((error) => `${chip.id}: ${error}`));
  warnings.push(...csvResult.warnings.map((warning) => `${chip.id}: ${warning}`));
}

for (const warning of warnings) {
  console.warn(`Warning: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`Error: ${error}`);
  }
  process.exit(1);
}

console.log(`Validated ${manifest.chips.length} chip data file(s).`);
```

- [ ] **Step 2: Write data build script**

Write `scripts/build-data-pack.ts`:

```ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseGpioAfCsvText } from "../src/shared/csv/parseGpioAfCsv";
import { normalizeChip } from "../src/shared/data/normalizeChip";
import type { ChipManifest } from "../src/shared/types";

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, "data/chips/manifest.json"), "utf8")) as ChipManifest;
const outputDir = join(root, "generated/chips");
mkdirSync(outputDir, { recursive: true });

for (const entry of manifest.chips) {
  const csvText = readFileSync(join(root, "data/chips", entry.gpioAfCsv), "utf8");
  const pins = parseGpioAfCsvText(csvText);
  const chip = normalizeChip(entry, pins);
  const outputPath = join(outputDir, `${entry.id.toLowerCase()}.json`);
  writeFileSync(outputPath, JSON.stringify(chip, null, 2), "utf8");
  console.log(`Built ${entry.id} -> ${outputPath}`);
}
```

- [ ] **Step 3: Run data validation and build**

Run:

```powershell
npm run validate:data
npm run build:data
```

Expected: validation reports `Validated 1 chip data file(s).`; build creates `generated/chips/gd32f407.json`.

- [ ] **Step 4: Commit data scripts**

Run:

```powershell
git add scripts/validate-data-pack.ts scripts/build-data-pack.ts
git commit -m "feat: build bundled chip data indexes"
```

Expected: commit succeeds.

## Task 9: Implement Extension Host Data Loading

**Files:**
- Create: `src/extension/chipRepository.ts`
- Create: `src/extension/extension.ts`

- [ ] **Step 1: Write chip repository**

Write `src/extension/chipRepository.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionContext } from "vscode";
import type { Chip, ChipManifest, ChipSummary } from "../shared/types";

export class ChipRepository {
  private readonly extensionRoot: string;

  constructor(context: ExtensionContext) {
    this.extensionRoot = context.extensionUri.fsPath;
  }

  listChips(): ChipSummary[] {
    const manifest = this.readManifest();
    return manifest.chips.map((chip) => ({
      id: chip.id,
      displayName: chip.displayName,
      vendor: chip.vendor,
      family: chip.family
    }));
  }

  loadChip(chipId: string): Chip {
    const chipPath = join(this.extensionRoot, "generated/chips", `${chipId.toLowerCase()}.json`);
    return JSON.parse(readFileSync(chipPath, "utf8")) as Chip;
  }

  private readManifest(): ChipManifest {
    const manifestPath = join(this.extensionRoot, "data/chips/manifest.json");
    return JSON.parse(readFileSync(manifestPath, "utf8")) as ChipManifest;
  }
}
```

- [ ] **Step 2: Write extension activation**

Write `src/extension/extension.ts`:

```ts
import * as vscode from "vscode";
import { ChipRepository } from "./chipRepository";
import { openPinMapPanel } from "./webviewPanel";

export function activate(context: vscode.ExtensionContext): void {
  const chipRepository = new ChipRepository(context);

  context.subscriptions.push(
    vscode.commands.registerCommand("mcupinfunc.openPinMap", () => {
      openPinMapPanel(context, chipRepository);
    })
  );
}

export function deactivate(): void {}
```

- [ ] **Step 3: Run extension build to expose missing webviewPanel**

Run:

```powershell
npm run build:extension
```

Expected: FAIL with `Cannot find module './webviewPanel'`.

- [ ] **Step 4: Commit repository and activation**

Run:

```powershell
git add src/extension/chipRepository.ts src/extension/extension.ts
git commit -m "feat: load bundled chips from extension host"
```

Expected: commit succeeds.

## Task 10: Implement Webview Panel Shell

**Files:**
- Create: `src/extension/webviewPanel.ts`
- Create: `src/webview/main.tsx`
- Create: `src/webview/App.tsx`
- Create: `src/webview/vscodeApi.ts`
- Create: `src/webview/styles.css`

- [ ] **Step 1: Write Webview panel**

Write `src/extension/webviewPanel.ts`:

```ts
import * as vscode from "vscode";
import type { WebviewToExtensionMessage } from "../shared/protocol";
import { detectConflicts } from "../shared/config/conflictEngine";
import { removeAssignment, upsertAssignment } from "../shared/config/assignmentStore";
import type { Assignment } from "../shared/types";
import type { ChipRepository } from "./chipRepository";

export function openPinMapPanel(context: vscode.ExtensionContext, chipRepository: ChipRepository): void {
  const panel = vscode.window.createWebviewPanel(
    "mcupinfunc.pinMap",
    "McuPinFunc Pin Map",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist", "webview")]
    }
  );

  let assignments: Assignment[] = context.workspaceState.get("mcupinfunc.assignments", []);
  let selectedChipId = chipRepository.listChips()[0]?.id;

  panel.webview.html = getHtml(context, panel.webview);

  panel.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
    if (message.type === "ready") {
      panel.webview.postMessage({ type: "chipsLoaded", chips: chipRepository.listChips(), selectedChipId });
      if (selectedChipId) {
        const chip = chipRepository.loadChip(selectedChipId);
        panel.webview.postMessage({ type: "chipLoaded", chip, assignments, conflicts: detectConflicts(assignments) });
      }
      return;
    }

    if (message.type === "selectChip") {
      selectedChipId = message.chipId;
      assignments = assignments.filter((assignment) => assignment.chipId === selectedChipId);
      context.workspaceState.update("mcupinfunc.assignments", assignments);
      const chip = chipRepository.loadChip(selectedChipId);
      panel.webview.postMessage({ type: "chipLoaded", chip, assignments, conflicts: detectConflicts(assignments) });
      return;
    }

    if (message.type === "assignFunction") {
      assignments = upsertAssignment(assignments, message.assignment);
      context.workspaceState.update("mcupinfunc.assignments", assignments);
      panel.webview.postMessage({ type: "assignmentsUpdated", assignments, conflicts: detectConflicts(assignments) });
      return;
    }

    if (message.type === "removeAssignment") {
      assignments = removeAssignment(assignments, message.assignmentId);
      context.workspaceState.update("mcupinfunc.assignments", assignments);
      panel.webview.postMessage({ type: "assignmentsUpdated", assignments, conflicts: detectConflicts(assignments) });
    }
  });
}

function getHtml(context: vscode.ExtensionContext, webview: vscode.Webview): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "dist", "webview", "assets", "main.js"));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "dist", "webview", "assets", "main.css"));
  const nonce = String(Date.now());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <title>McuPinFunc</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
}
```

- [ ] **Step 2: Write Webview API helper**

Write `src/webview/vscodeApi.ts`:

```ts
import type { WebviewToExtensionMessage } from "../shared/protocol";

declare const acquireVsCodeApi: () => {
  postMessage(message: WebviewToExtensionMessage): void;
};

export const vscode = acquireVsCodeApi();
```

- [ ] **Step 3: Write React entry**

Write `src/webview/main.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Write `src/webview/App.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { ExtensionToWebviewMessage } from "../shared/protocol";
import type { Assignment, Chip, ChipSummary, Conflict } from "../shared/types";
import { vscode } from "./vscodeApi";

export function App() {
  const [chips, setChips] = useState<ChipSummary[]>([]);
  const [chip, setChip] = useState<Chip | undefined>();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  useEffect(() => {
    const listener = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      const message = event.data;
      if (message.type === "chipsLoaded") {
        setChips(message.chips);
      }
      if (message.type === "chipLoaded") {
        setChip(message.chip);
        setAssignments(message.assignments);
        setConflicts(message.conflicts);
      }
      if (message.type === "assignmentsUpdated") {
        setAssignments(message.assignments);
        setConflicts(message.conflicts);
      }
    };

    window.addEventListener("message", listener);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", listener);
  }, []);

  return (
    <main className="app">
      <aside className="sidebar">
        <h1>McuPinFunc</h1>
        <p>{chips.length} bundled chip(s)</p>
      </aside>
      <section className="workspace">
        <h2>{chip?.displayName ?? "Loading chip data..."}</h2>
        <p>{chip ? `${chip.pins.length} pins loaded` : "Waiting for extension host"}</p>
        <p>{assignments.length} assignment(s), {conflicts.length} conflict(s)</p>
      </section>
    </main>
  );
}
```

Write `src/webview/styles.css`:

```css
body {
  margin: 0;
  background: #f4efe5;
  color: #172832;
  font-family: "Segoe UI", sans-serif;
}

.app {
  display: grid;
  grid-template-columns: 260px 1fr;
  min-height: 100vh;
}

.sidebar {
  background: #152a38;
  color: #eaf6f9;
  padding: 20px;
}

.workspace {
  padding: 24px;
}
```

- [ ] **Step 4: Build extension and webview**

Run:

```powershell
npm run build
```

Expected: PASS and `dist/extension/extension.js`, `dist/webview/assets` exist.

- [ ] **Step 5: Commit Webview shell**

Run:

```powershell
git add src/extension/webviewPanel.ts src/webview/main.tsx src/webview/App.tsx src/webview/vscodeApi.ts src/webview/styles.css
git commit -m "feat: open pin map webview"
```

Expected: commit succeeds.

## Task 11: Build Pin Map UI State and Components

**Files:**
- Create: `src/webview/state/usePinMapStore.ts`
- Create: `src/webview/components/Shell.tsx`
- Create: `src/webview/components/ChipSelector.tsx`
- Create: `src/webview/components/SearchBox.tsx`
- Create: `src/webview/components/PeripheralFilter.tsx`
- Create: `src/webview/components/LogicalPinMap.tsx`
- Create: `src/webview/components/PinDetailPanel.tsx`
- Create: `src/webview/components/AssignmentPanel.tsx`
- Modify: `src/webview/App.tsx`
- Modify: `src/webview/styles.css`

- [ ] **Step 1: Write Zustand store**

Write `src/webview/state/usePinMapStore.ts`:

```ts
import { create } from "zustand";
import { createSearchIndex, type SearchResult } from "../../shared/data/searchIndex";
import type { Assignment, Chip, ChipSummary, Conflict, Pin } from "../../shared/types";

type PinMapState = {
  chips: ChipSummary[];
  chip?: Chip;
  selectedPinName?: string;
  query: string;
  searchResults: SearchResult[];
  assignments: Assignment[];
  conflicts: Conflict[];
  setChips(chips: ChipSummary[]): void;
  setChip(chip: Chip, assignments: Assignment[], conflicts: Conflict[]): void;
  setAssignments(assignments: Assignment[], conflicts: Conflict[]): void;
  selectPin(pinName: string): void;
  setQuery(query: string): void;
  selectedPin(): Pin | undefined;
};

export const usePinMapStore = create<PinMapState>((set, get) => ({
  chips: [],
  query: "",
  searchResults: [],
  assignments: [],
  conflicts: [],
  setChips: (chips) => set({ chips }),
  setChip: (chip, assignments, conflicts) => set({ chip, assignments, conflicts, selectedPinName: chip.pins[0]?.name }),
  setAssignments: (assignments, conflicts) => set({ assignments, conflicts }),
  selectPin: (pinName) => set({ selectedPinName: pinName }),
  setQuery: (query) => {
    const chip = get().chip;
    const searchResults = chip ? createSearchIndex(chip).search(query) : [];
    set({ query, searchResults });
  },
  selectedPin: () => {
    const state = get();
    return state.chip?.pins.find((pin) => pin.name === state.selectedPinName);
  }
}));
```

- [ ] **Step 2: Write shell and controls**

Write `src/webview/components/Shell.tsx`:

```tsx
import type { ReactNode } from "react";

export function Shell(props: { sidebar: ReactNode; map: ReactNode; detail: ReactNode }) {
  return (
    <main className="pinmap-shell">
      <aside className="pinmap-sidebar">{props.sidebar}</aside>
      <section className="pinmap-map">{props.map}</section>
      <aside className="pinmap-detail">{props.detail}</aside>
    </main>
  );
}
```

Write `src/webview/components/ChipSelector.tsx`:

```tsx
import { vscode } from "../vscodeApi";
import { usePinMapStore } from "../state/usePinMapStore";

export function ChipSelector() {
  const chips = usePinMapStore((state) => state.chips);
  const chip = usePinMapStore((state) => state.chip);

  return (
    <label className="field">
      <span>Chip</span>
      <select value={chip?.id ?? ""} onChange={(event) => vscode.postMessage({ type: "selectChip", chipId: event.target.value })}>
        {chips.map((item) => (
          <option key={item.id} value={item.id}>{item.displayName}</option>
        ))}
      </select>
    </label>
  );
}
```

Write `src/webview/components/SearchBox.tsx`:

```tsx
import { usePinMapStore } from "../state/usePinMapStore";

export function SearchBox() {
  const query = usePinMapStore((state) => state.query);
  const setQuery = usePinMapStore((state) => state.setQuery);

  return (
    <label className="field">
      <span>Search pin / function</span>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="PA9 or USART0_TX" />
    </label>
  );
}
```

Write `src/webview/components/PeripheralFilter.tsx`:

```tsx
import { usePinMapStore } from "../state/usePinMapStore";

export function PeripheralFilter() {
  const chip = usePinMapStore((state) => state.chip);
  const setQuery = usePinMapStore((state) => state.setQuery);
  const peripherals = Array.from(new Set(chip?.pins.flatMap((pin) => pin.functions.map((fn) => fn.peripheral)) ?? [])).sort();

  return (
    <div className="peripheral-list">
      <h3>Peripherals</h3>
      {peripherals.slice(0, 24).map((peripheral) => (
        <button key={peripheral} onClick={() => setQuery(peripheral)}>{peripheral}</button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Write map, detail, and assignment components**

Write `src/webview/components/LogicalPinMap.tsx`:

```tsx
import { usePinMapStore } from "../state/usePinMapStore";

export function LogicalPinMap() {
  const chip = usePinMapStore((state) => state.chip);
  const selectedPinName = usePinMapStore((state) => state.selectedPinName);
  const selectPin = usePinMapStore((state) => state.selectPin);
  const searchResults = usePinMapStore((state) => state.searchResults);
  const assignments = usePinMapStore((state) => state.assignments);
  const conflicts = usePinMapStore((state) => state.conflicts);

  if (!chip) {
    return <div className="empty">Loading chip data...</div>;
  }

  const highlightedPins = new Set(searchResults.map((result) => result.pinName));
  const assignedPins = new Set(assignments.map((assignment) => assignment.pinName));
  const conflictAssignmentIds = new Set(conflicts.flatMap((conflict) => conflict.assignmentIds));
  const conflictPins = new Set(assignments.filter((assignment) => conflictAssignmentIds.has(assignment.id)).map((assignment) => assignment.pinName));
  const ports = chip.pins.reduce((map, pin) => {
    map.set(pin.port, [...(map.get(pin.port) ?? []), pin]);
    return map;
  }, new Map<string, typeof chip.pins>());

  return (
    <div>
      <div className="map-header">
        <h2>Logical Pin Map</h2>
        <span>{chip.pins.length} pins</span>
      </div>
      <div className="ports">
        {Array.from(ports.entries()).map(([port, pins]) => (
          <section className="port-card" key={port}>
            <h3>Port {port}</h3>
            <div className="pin-grid">
              {pins.map((pin) => {
                const className = [
                  "pin",
                  pin.name === selectedPinName ? "selected" : "",
                  highlightedPins.has(pin.name) ? "highlighted" : "",
                  assignedPins.has(pin.name) ? "assigned" : "",
                  conflictPins.has(pin.name) ? "conflict" : ""
                ].filter(Boolean).join(" ");
                return <button className={className} key={pin.name} onClick={() => selectPin(pin.name)}>{pin.name}</button>;
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
```

Write `src/webview/components/PinDetailPanel.tsx`:

```tsx
import { createAssignmentId } from "../../shared/config/assignmentStore";
import type { PinFunction } from "../../shared/types";
import { usePinMapStore } from "../state/usePinMapStore";
import { vscode } from "../vscodeApi";

export function PinDetailPanel() {
  const chip = usePinMapStore((state) => state.chip);
  const pin = usePinMapStore((state) => state.selectedPin());

  if (!chip || !pin) {
    return <div className="empty">Select a pin</div>;
  }

  const assign = (fn: PinFunction) => {
    vscode.postMessage({
      type: "assignFunction",
      assignment: {
        id: createAssignmentId(chip.id, pin.name, fn.raw),
        chipId: chip.id,
        pinName: pin.name,
        functionRaw: fn.raw,
        af: fn.af,
        peripheral: fn.peripheral,
        signal: fn.signal
      }
    });
  };

  return (
    <div>
      <h2>{pin.name}</h2>
      <p>{pin.functions.length} alternate function(s)</p>
      <div className="function-list">
        {pin.functions.map((fn) => (
          <button className="function-row" key={`${fn.af}:${fn.raw}`} onClick={() => assign(fn)}>
            <strong>{fn.af} {fn.raw}</strong>
            <span>{fn.peripheral} / {fn.signal}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

Write `src/webview/components/AssignmentPanel.tsx`:

```tsx
import { usePinMapStore } from "../state/usePinMapStore";
import { vscode } from "../vscodeApi";

export function AssignmentPanel() {
  const assignments = usePinMapStore((state) => state.assignments);
  const conflicts = usePinMapStore((state) => state.conflicts);

  return (
    <section className="assignment-panel">
      <h3>Selection Set</h3>
      {assignments.map((assignment) => (
        <div className="assignment-row" key={assignment.id}>
          <span>{assignment.pinName} -> {assignment.functionRaw}</span>
          <button onClick={() => vscode.postMessage({ type: "removeAssignment", assignmentId: assignment.id })}>Remove</button>
        </div>
      ))}
      {conflicts.map((conflict) => (
        <div className="conflict-row" key={conflict.id}>{conflict.message}</div>
      ))}
    </section>
  );
}
```

- [ ] **Step 4: Wire components into App**

Replace `src/webview/App.tsx` with:

```tsx
import { useEffect } from "react";
import type { ExtensionToWebviewMessage } from "../shared/protocol";
import { AssignmentPanel } from "./components/AssignmentPanel";
import { ChipSelector } from "./components/ChipSelector";
import { LogicalPinMap } from "./components/LogicalPinMap";
import { PeripheralFilter } from "./components/PeripheralFilter";
import { PinDetailPanel } from "./components/PinDetailPanel";
import { SearchBox } from "./components/SearchBox";
import { Shell } from "./components/Shell";
import { usePinMapStore } from "./state/usePinMapStore";
import { vscode } from "./vscodeApi";

export function App() {
  const setChips = usePinMapStore((state) => state.setChips);
  const setChip = usePinMapStore((state) => state.setChip);
  const setAssignments = usePinMapStore((state) => state.setAssignments);

  useEffect(() => {
    const listener = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      const message = event.data;
      if (message.type === "chipsLoaded") {
        setChips(message.chips);
      }
      if (message.type === "chipLoaded") {
        setChip(message.chip, message.assignments, message.conflicts);
      }
      if (message.type === "assignmentsUpdated") {
        setAssignments(message.assignments, message.conflicts);
      }
    };

    window.addEventListener("message", listener);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", listener);
  }, [setAssignments, setChip, setChips]);

  return (
    <Shell
      sidebar={<><h1>McuPinFunc</h1><ChipSelector /><SearchBox /><PeripheralFilter /><AssignmentPanel /></>}
      map={<LogicalPinMap />}
      detail={<PinDetailPanel />}
    />
  );
}
```

- [ ] **Step 5: Replace styles**

Replace `src/webview/styles.css` with:

```css
body {
  margin: 0;
  background: #f4efe5;
  color: #172832;
  font-family: "Segoe UI", sans-serif;
}

button, input, select {
  font: inherit;
}

.pinmap-shell {
  display: grid;
  grid-template-columns: 260px minmax(420px, 1fr) 320px;
  min-height: 100vh;
}

.pinmap-sidebar {
  background: #152a38;
  color: #eaf6f9;
  padding: 18px;
}

.pinmap-map {
  padding: 20px;
}

.pinmap-detail {
  background: #fffaf0;
  border-left: 1px solid #e3d7bf;
  padding: 18px;
}

.field {
  display: grid;
  gap: 6px;
  margin: 14px 0;
}

.field input, .field select {
  border: 0;
  border-radius: 10px;
  padding: 10px;
}

.peripheral-list {
  display: grid;
  gap: 8px;
  margin-top: 18px;
}

.peripheral-list button {
  border: 0;
  border-radius: 10px;
  padding: 8px;
  text-align: left;
}

.map-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.ports {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.port-card {
  background: #fffaf0;
  border: 1px solid #e3d7bf;
  border-radius: 14px;
  padding: 12px;
}

.pin-grid {
  display: grid;
  gap: 6px;
  grid-template-columns: repeat(4, 1fr);
}

.pin {
  background: #fff;
  border: 1px solid #d7c9af;
  border-radius: 8px;
  cursor: pointer;
  padding: 8px;
}

.pin.highlighted {
  background: #fff0bd;
}

.pin.assigned {
  background: #dff3e6;
}

.pin.conflict {
  background: #fde0dc;
}

.pin.selected {
  background: #1f6f8b;
  color: white;
}

.function-list {
  display: grid;
  gap: 8px;
}

.function-row {
  background: white;
  border: 1px solid #e3d7bf;
  border-radius: 10px;
  display: grid;
  gap: 4px;
  padding: 10px;
  text-align: left;
}

.assignment-panel {
  margin-top: 20px;
}

.assignment-row, .conflict-row {
  background: #203b4b;
  border-radius: 10px;
  margin: 8px 0;
  padding: 10px;
}

.assignment-row {
  display: grid;
  gap: 8px;
}

.conflict-row {
  background: #e55d4a;
  color: white;
}

.empty {
  color: #50636d;
  padding: 20px;
}
```

- [ ] **Step 6: Build UI**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit Pin Map UI**

Run:

```powershell
git add src/webview
git commit -m "feat: render logical pin map workspace"
```

Expected: commit succeeds.

## Task 12: Add Export

**Files:**
- Create: `src/extension/exportConfig.ts`
- Modify: `src/extension/webviewPanel.ts`
- Create: `test/extension/exportConfig.test.ts`

- [ ] **Step 1: Write export tests**

Write `test/extension/exportConfig.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderAssignmentsAsMarkdown } from "../../src/extension/exportConfig";
import type { Assignment } from "../../src/shared/types";

describe("renderAssignmentsAsMarkdown", () => {
  it("renders a table of assignments", () => {
    const assignments: Assignment[] = [
      { id: "a1", chipId: "GD32F407", pinName: "PA9", functionRaw: "USART0_TX", af: "AF7", peripheral: "USART0", signal: "TX" }
    ];

    expect(renderAssignmentsAsMarkdown(assignments)).toContain("| PA9 | AF7 | USART0_TX | USART0 | TX |");
  });
});
```

- [ ] **Step 2: Write export helpers**

Write `src/extension/exportConfig.ts`:

```ts
import type { Assignment } from "../shared/types";

export function renderAssignmentsAsJson(assignments: Assignment[]): string {
  return JSON.stringify({ assignments }, null, 2);
}

export function renderAssignmentsAsMarkdown(assignments: Assignment[]): string {
  const rows = assignments
    .map((assignment) => `| ${assignment.pinName} | ${assignment.af} | ${assignment.functionRaw} | ${assignment.peripheral} | ${assignment.signal} |`)
    .join("\n");

  return [
    "# McuPinFunc Assignments",
    "",
    "| Pin | AF | Function | Peripheral | Signal |",
    "|---|---|---|---|---|",
    rows
  ].join("\n");
}
```

- [ ] **Step 3: Handle export messages in Webview panel**

Modify `src/extension/webviewPanel.ts` imports:

```ts
import { renderAssignmentsAsJson, renderAssignmentsAsMarkdown } from "./exportConfig";
```

Add this branch inside `onDidReceiveMessage` after `removeAssignment` handling:

```ts
    if (message.type === "export") {
      const content = message.format === "json"
        ? renderAssignmentsAsJson(assignments)
        : renderAssignmentsAsMarkdown(assignments);
      const document = await vscode.workspace.openTextDocument({
        content,
        language: message.format === "json" ? "json" : "markdown"
      });
      await vscode.window.showTextDocument(document);
    }
```

Change the message callback to async:

```ts
  panel.webview.onDidReceiveMessage(async (message: WebviewToExtensionMessage) => {
```

- [ ] **Step 4: Add export buttons**

Modify `src/webview/components/AssignmentPanel.tsx` by adding buttons before the closing `</section>`:

```tsx
      <div className="export-actions">
        <button onClick={() => vscode.postMessage({ type: "export", format: "json" })}>Export JSON</button>
        <button onClick={() => vscode.postMessage({ type: "export", format: "markdown" })}>Export Markdown</button>
      </div>
```

Add CSS:

```css
.export-actions {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}
```

- [ ] **Step 5: Run export tests and build**

Run:

```powershell
npm test -- test/extension/exportConfig.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit export**

Run:

```powershell
git add src/extension/exportConfig.ts src/extension/webviewPanel.ts src/webview/components/AssignmentPanel.tsx src/webview/styles.css test/extension/exportConfig.test.ts
git commit -m "feat: export pin assignments"
```

Expected: commit succeeds.

## Task 13: Add Package Pinout Validator for Future LQFP Data

**Files:**
- Create: `src/shared/csv/validateLqfpPinoutCsv.ts`
- Create: `test/fixtures/lqfp-pinout-small.csv`
- Create: `test/shared/validateLqfpPinoutCsv.test.ts`

- [ ] **Step 1: Write LQFP fixture**

Write `test/fixtures/lqfp-pinout-small.csv`:

```csv
PadNumber,PinName,PinType
1,PE2,gpio
2,PE3,gpio
3,VSS,ground
4,VDD,power
```

- [ ] **Step 2: Write validator tests**

Write `test/shared/validateLqfpPinoutCsv.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateLqfpPinoutCsvText } from "../../src/shared/csv/validateLqfpPinoutCsv";

describe("validateLqfpPinoutCsvText", () => {
  it("accepts continuous pad numbers", () => {
    const csv = readFileSync("test/fixtures/lqfp-pinout-small.csv", "utf8");
    expect(validateLqfpPinoutCsvText(csv, 4).errors).toEqual([]);
  });

  it("rejects missing pad numbers", () => {
    const csv = "PadNumber,PinName,PinType\n1,PE2,gpio\n3,VSS,ground\n";
    expect(validateLqfpPinoutCsvText(csv, 3).errors).toContain("PadNumber must cover every value from 1 to 3.");
  });
});
```

- [ ] **Step 3: Write LQFP validator**

Write `src/shared/csv/validateLqfpPinoutCsv.ts`:

```ts
import { parse } from "csv-parse/sync";
import type { ValidationResult } from "./validateManifest";

const VALID_PIN_TYPES = new Set(["gpio", "power", "ground", "reset", "clock", "boot", "nc"]);

export function validateLqfpPinoutCsvText(csvText: string, totalPads: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const records = parse(csvText, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as Array<Record<string, string>>;

  const padNumbers = new Set<number>();
  for (const record of records) {
    const padNumber = Number(record.PadNumber);
    if (!Number.isInteger(padNumber) || padNumber < 1 || padNumber > totalPads) {
      errors.push(`Invalid PadNumber ${record.PadNumber}.`);
      continue;
    }
    padNumbers.add(padNumber);

    if (!record.PinName) {
      errors.push(`PadNumber ${padNumber} must have a PinName.`);
    }

    if (record.PinType && !VALID_PIN_TYPES.has(record.PinType)) {
      warnings.push(`PadNumber ${padNumber} has unknown PinType ${record.PinType}.`);
    }
  }

  if (padNumbers.size !== totalPads) {
    errors.push(`PadNumber must cover every value from 1 to ${totalPads}.`);
  }

  return { errors, warnings };
}
```

- [ ] **Step 4: Run LQFP validator tests**

Run:

```powershell
npm test -- test/shared/validateLqfpPinoutCsv.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit LQFP validator**

Run:

```powershell
git add src/shared/csv/validateLqfpPinoutCsv.ts test/fixtures/lqfp-pinout-small.csv test/shared/validateLqfpPinoutCsv.test.ts
git commit -m "feat: validate lqfp pinout data"
```

Expected: commit succeeds.

## Task 14: Final Verification and Documentation

**Files:**
- Create: `README.md`
- Verify: all source and tests.

- [ ] **Step 1: Write README**

Write `README.md`:

```markdown
# McuPinFunc

McuPinFunc is a VS Code extension for browsing MCU GPIO alternate functions and planning pin assignments.

## Features

- Bundled chip data pack.
- Logical Pin Map grouped by GPIO port.
- Search by pin, function, or peripheral.
- Assign alternate functions to pins.
- Detect pin overlap and duplicate peripheral-signal conflicts.
- Export assignments as JSON or Markdown.

## Data Layout

Chip data is stored under:

```text
data/chips/<vendor>/<family>/<part-number>/
```

GPIO AF files use:

```text
<PART_NUMBER>_GPIO_AF.csv
```

LQFP pinout files use:

```text
<PART_NUMBER>_<PACKAGE>_PINOUT.csv
```

The bundled chip list is declared in `data/chips/manifest.json`.

## Development

```powershell
npm install
npm test
npm run build
```
```

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm test
npm run build
```

Expected: both commands PASS.

- [ ] **Step 3: Inspect git diff**

Run:

```powershell
git status --short
git diff --stat
```

Expected: only intended files are modified or untracked.

- [ ] **Step 4: Commit documentation**

Run:

```powershell
git add README.md
git commit -m "docs: document mcupinfunc development workflow"
```

Expected: commit succeeds.

- [ ] **Step 5: Record final status**

Run:

```powershell
git log --oneline -5
git status --short
```

Expected: recent commits include the implementation tasks and `git status --short` is empty.

## Self-Review

Spec coverage:

- Bundled CSV data pack is covered by Tasks 3, 4, and 8.
- CSV naming and manifest rules are covered by Tasks 3, 4, 8, and 13.
- Logical Pin Map is covered by Task 11.
- Pin/function/peripheral search is covered by Tasks 6 and 11.
- Assignment and conflict detection are covered by Tasks 7, 10, and 11.
- Persistence is covered by Task 10 through `workspaceState`.
- Export is covered by Task 12.
- LQFP pinout future support is covered by Task 13 without adding BGA complexity.
- Documentation and verification are covered by Task 14.

Type consistency:

- `Chip`, `Pin`, `PinFunction`, `Assignment`, and `Conflict` are defined in Task 2 and reused consistently.
- `WebviewToExtensionMessage` and `ExtensionToWebviewMessage` are defined in Task 2 and reused by extension and webview tasks.
- `createAssignmentId`, `upsertAssignment`, and `removeAssignment` are defined in Task 7 and reused by Tasks 10 and 11.

Execution notes:

- Execute tasks in order.
- Run the specified verification command before each commit.
- Vite is configured to emit `dist/webview/assets/main.js` and `dist/webview/assets/main.css`, matching the Webview HTML in Task 10.
