# Pinout CSV Functions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support chips whose datasheets provide per-package pin definition tables with `Alternate` and `Remap` function columns instead of a standalone `AF0..AF15` GPIO AF matrix, and update the GD32 crawler to produce that format.

**Architecture:** Keep the existing runtime model centered on `Chip.pins[].functions`. Make `gpioAfCsv` optional in manifests, add `functionSource: "gpio-af-csv" | "pinout-csv"`, and parse `Alternate` / `Remap` cells from pinout CSVs only when the chip is marked as `pinout-csv`. Package layout parsing remains responsible for package geometry; a new shared parser extracts functions from the same CSV text and merges them across packages.

**Tech Stack:** TypeScript, Vitest, csv-parse, Node.js scripts, Python stdlib unittest, external data repo Python crawler.

---

## File Structure

- Modify `src/shared/types.ts`: add `FunctionSource`, make `ChipManifestEntry.gpioAfCsv` optional, and optionally expose `Chip.functionSource`.
- Create `src/shared/csv/pinoutFunctionCsv.ts`: parse optional `Alternate` and `Remap` columns from LQFP/BGA pinout CSV text into `Pin[]` with `PinFunction[]`.
- Modify `src/shared/csv/parseGpioAfCsv.ts`: export a reusable function that turns a raw function string plus an AF label into `PinFunction`.
- Modify `src/shared/csv/validateManifest.ts`: allow `gpioAfCsv` to be absent for `functionSource: "pinout-csv"` and enforce it for `gpio-af-csv`.
- Modify `scripts/build-data-pack.ts`: choose `parseGpioAfCsvText` or `parsePinoutFunctionCsvText` based on `functionSource`.
- Modify `scripts/sync-chip-manifest.ts`: discover chips that only have package pinout CSVs, infer `functionSource`, and keep existing metadata where possible.
- Modify `scripts/build-remote-chip-index.ts`: derive chip output path from package CSVs when `gpioAfCsv` is absent and omit `gpio-af` source files for pinout-source chips.
- Modify `src/extension/csvImport.ts`: allow local imports with only package pinout CSVs and prompt for metadata from the first selected CSV stem.
- Modify webview text in `src/webview/components/PinDetailPanel.tsx` only if needed to make `ALT` / `REMAP` readable; keep behavior unchanged otherwise.
- Modify TypeScript tests under `test/shared` and `test/extension`.
- Modify `external-data/mcupinfunc-data/tools/extract_pin_csv.py`: emit optional `Alternate` and `Remap` columns for legacy pin definition tables.
- Modify `external-data/mcupinfunc-data/tools/crawl_gd32_pdfs.py`: choose extraction mode and report function source.
- Modify `external-data/mcupinfunc-data/tools/test_crawl_gd32_pdfs.py`: cover crawler reporting for pinout CSV function source.
- Create `external-data/mcupinfunc-data/tools/test_extract_pin_csv.py`: cover Python extraction of `Alternate` and `Remap`.

---

### Task 1: Shared Type And Manifest Contract

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/csv/validateManifest.ts`
- Test: `test/shared/validateManifest.test.ts`

- [ ] **Step 1: Write failing manifest tests**

Add these cases to `test/shared/validateManifest.test.ts`:

```typescript
it("accepts a pinout-csv chip without GPIO AF CSV", () => {
  const result = validateManifest({
    schemaVersion: 1,
    dataVersion: "2026-06-05",
    chips: [
      {
        id: "GD32F103",
        vendor: "GigaDevice",
        family: "GD32F1",
        displayName: "GD32F103",
        functionSource: "pinout-csv",
        packages: [{ name: "LQFP100", pinoutCsv: "chips/gigadevice/gd32f1/gd32f103/source/GD32F103_LQFP100_PINOUT.csv" }],
        source: "fixture",
        status: "draft"
      }
    ]
  });

  expect(result.errors).toEqual([]);
});

it("rejects a gpio-af-csv chip without GPIO AF CSV", () => {
  const result = validateManifest({
    schemaVersion: 1,
    dataVersion: "2026-06-05",
    chips: [
      {
        id: "GD32F407",
        vendor: "GigaDevice",
        family: "GD32F4",
        displayName: "GD32F407",
        functionSource: "gpio-af-csv",
        packages: [],
        source: "fixture",
        status: "draft"
      }
    ]
  });

  expect(result.errors).toContain("Chip GD32F407 must reference a GPIO AF CSV named GD32F407_GPIO_AF.csv.");
});

it("rejects an unknown functionSource", () => {
  const result = validateManifest({
    schemaVersion: 1,
    dataVersion: "2026-06-05",
    chips: [
      {
        id: "GD32F103",
        vendor: "GigaDevice",
        family: "GD32F1",
        displayName: "GD32F103",
        functionSource: "legacy",
        packages: [],
        source: "fixture",
        status: "draft"
      }
    ]
  });

  expect(result.errors).toContain("Chip GD32F103 functionSource must be gpio-af-csv or pinout-csv.");
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
npm test -- test/shared/validateManifest.test.ts
```

Expected: the new tests fail because `functionSource` is not recognized and `gpioAfCsv` is still mandatory.

- [ ] **Step 3: Update shared types**

In `src/shared/types.ts`, change the relevant type section to:

```typescript
export type FunctionSource = "gpio-af-csv" | "pinout-csv";

export type Chip = {
  id: string;
  displayName: string;
  vendor: string;
  family: string;
  functionSource?: FunctionSource;
  pins: Pin[];
  packages: PackageLayout[];
};

export type ChipManifestEntry = {
  id: string;
  vendor: string;
  family: string;
  displayName: string;
  functionSource?: FunctionSource;
  gpioAfCsv?: string;
  packages: Array<{
    name: string;
    pinoutCsv: string;
  }>;
  source: string;
  status: "draft" | "stable";
};
```

- [ ] **Step 4: Update manifest validation**

In `src/shared/csv/validateManifest.ts`, replace the current `gpioAfCsv` check with:

```typescript
const functionSource = chipRecord.functionSource ?? "gpio-af-csv";
if (functionSource !== "gpio-af-csv" && functionSource !== "pinout-csv") {
  errors.push(`Chip ${id} functionSource must be gpio-af-csv or pinout-csv.`);
}

const gpioAfCsv = chipRecord.gpioAfCsv;
const expectedFile = `${id}_GPIO_AF.csv`;
if (functionSource === "gpio-af-csv") {
  if (typeof gpioAfCsv !== "string" || !gpioAfCsv.endsWith(expectedFile)) {
    errors.push(`Chip ${id} must reference a GPIO AF CSV named ${expectedFile}.`);
  }
} else if (gpioAfCsv !== undefined && typeof gpioAfCsv !== "string") {
  errors.push(`Chip ${id} gpioAfCsv must be a string when provided.`);
}
```

- [ ] **Step 5: Run the focused test and verify pass**

Run:

```powershell
npm test -- test/shared/validateManifest.test.ts
```

Expected: all tests in `validateManifest.test.ts` pass.

- [ ] **Step 6: Commit**

```powershell
git add src/shared/types.ts src/shared/csv/validateManifest.ts test/shared/validateManifest.test.ts
git commit -m "feat: allow pinout-sourced chip manifests"
```

---

### Task 2: Parse Alternate And Remap From Pinout CSV

**Files:**
- Modify: `src/shared/csv/parseGpioAfCsv.ts`
- Create: `src/shared/csv/pinoutFunctionCsv.ts`
- Test: `test/shared/pinoutFunctionCsv.test.ts`

- [ ] **Step 1: Write failing parser tests**

Create `test/shared/pinoutFunctionCsv.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { parsePinoutFunctionCsvText } from "../../src/shared/csv/pinoutFunctionCsv";

describe("parsePinoutFunctionCsvText", () => {
  it("extracts alternate and remap functions from LQFP pinout CSV rows", () => {
    const pins = parsePinoutFunctionCsvText(
      [
        "PadNumber,PinName,PinType,Alternate,Remap",
        "29,PA4,gpio,SPI0_NSS/USART1_CK/ADC01_IN4/DAC0_OUT0,SPI2_NSS/I2S2_WS",
        "30,PA5,gpio,SPI0_SCK/ADC01_IN5/DAC0_OUT1,"
      ].join("\n")
    );

    expect(pins).toEqual([
      {
        name: "PA4",
        port: "PA",
        number: 4,
        functions: [
          { af: "ALT", raw: "SPI0_NSS", peripheral: "SPI0", signal: "NSS", aliases: [] },
          { af: "ALT", raw: "USART1_CK", peripheral: "USART1", signal: "CK", aliases: [] },
          { af: "ALT", raw: "ADC01_IN4", peripheral: "ADC01", signal: "IN4", aliases: [] },
          { af: "ALT", raw: "DAC0_OUT0", peripheral: "DAC0", signal: "OUT0", aliases: [] },
          { af: "REMAP", raw: "SPI2_NSS", peripheral: "SPI2", signal: "NSS", aliases: [] },
          { af: "REMAP", raw: "I2S2_WS", peripheral: "I2S2", signal: "WS", aliases: [] }
        ]
      },
      {
        name: "PA5",
        port: "PA",
        number: 5,
        functions: [
          { af: "ALT", raw: "SPI0_SCK", peripheral: "SPI0", signal: "SCK", aliases: [] },
          { af: "ALT", raw: "ADC01_IN5", peripheral: "ADC01", signal: "IN5", aliases: [] },
          { af: "ALT", raw: "DAC0_OUT1", peripheral: "DAC0", signal: "OUT1", aliases: [] }
        ]
      }
    ]);
  });

  it("ignores non-gpio rows and non-GPIO pin names", () => {
    const pins = parsePinoutFunctionCsvText(
      [
        "PadNumber,PinName,PinType,Alternate,Remap",
        "1,VDD,power,USART1_TX,",
        "2,NRST,reset,SPI0_NSS,",
        "3,PA0-WKUP,gpio,USART1_CTS,"
      ].join("\n")
    );

    expect(pins).toEqual([]);
  });

  it("merges duplicate pin rows and deduplicates functions", () => {
    const pins = parsePinoutFunctionCsvText(
      [
        "BallName,PinName,PinType,Alternate,Remap",
        "A1,PB3,gpio,SPI2_SCK,PB3/SPI0_SCK",
        "B2,PB3,gpio,SPI2_SCK,SPI0_SCK"
      ].join("\n")
    );

    expect(pins).toHaveLength(1);
    expect(pins[0]?.functions.map((fn) => `${fn.af}:${fn.raw}`)).toEqual([
      "ALT:SPI2_SCK",
      "REMAP:PB3",
      "REMAP:SPI0_SCK"
    ]);
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
npm test -- test/shared/pinoutFunctionCsv.test.ts
```

Expected: FAIL because `src/shared/csv/pinoutFunctionCsv.ts` does not exist.

- [ ] **Step 3: Export reusable function parsing**

In `src/shared/csv/parseGpioAfCsv.ts`, export the existing helper by changing:

```typescript
function parseFunction(af: string, raw: string): PinFunction {
```

to:

```typescript
export function parseFunction(af: string, raw: string): PinFunction {
```

- [ ] **Step 4: Create the pinout function parser**

Create `src/shared/csv/pinoutFunctionCsv.ts`:

```typescript
import { parse } from "csv-parse/sync";
import type { Pin, PinFunction } from "../types";
import { parseFunction } from "./parseGpioAfCsv";

type PinoutFunctionRecord = {
  PinName?: string;
  PinType?: string;
  Alternate?: string;
  Remap?: string;
};

const GPIO_PIN_NAME = /^(P[A-Z])(\d{1,2})$/;

export function parsePinoutFunctionCsvText(csvText: string): Pin[] {
  const records = parse(csvText, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as PinoutFunctionRecord[];

  const pinsByName = new Map<string, Pin>();
  for (const record of records) {
    if (record.PinType !== "gpio" || !record.PinName) {
      continue;
    }

    const match = GPIO_PIN_NAME.exec(record.PinName);
    if (!match) {
      continue;
    }

    const pin = pinsByName.get(record.PinName) ?? {
      name: record.PinName,
      port: match[1],
      number: Number(match[2]),
      functions: []
    };

    addFunctions(pin.functions, "ALT", record.Alternate);
    addFunctions(pin.functions, "REMAP", record.Remap);
    pinsByName.set(pin.name, pin);
  }

  return [...pinsByName.values()];
}

function addFunctions(functions: PinFunction[], af: "ALT" | "REMAP", cell: string | undefined): void {
  for (const raw of splitFunctionCell(cell)) {
    if (!functions.some((fn) => fn.af === af && fn.raw === raw)) {
      functions.push(parseFunction(af, raw));
    }
  }
}

function splitFunctionCell(cell: string | undefined): string[] {
  if (!cell) {
    return [];
  }

  return cell
    .split("/")
    .map((part) => part.replace(/\(\d+\)/g, "").trim())
    .filter((part) => part.length > 0);
}
```

- [ ] **Step 5: Run parser tests**

Run:

```powershell
npm test -- test/shared/pinoutFunctionCsv.test.ts test/shared/parseGpioAfCsv.test.ts
```

Expected: both test files pass.

- [ ] **Step 6: Commit**

```powershell
git add src/shared/csv/parseGpioAfCsv.ts src/shared/csv/pinoutFunctionCsv.ts test/shared/pinoutFunctionCsv.test.ts
git commit -m "feat: parse functions from pinout csv"
```

---

### Task 3: Build Chips From Pinout CSV Functions

**Files:**
- Modify: `scripts/build-data-pack.ts`
- Modify: `src/shared/data/normalizeChip.ts`
- Test: `test/shared/buildDataPack.test.ts`
- Test: `test/shared/normalizeChip.test.ts`

- [ ] **Step 1: Write failing build test**

Add this test to `test/shared/buildDataPack.test.ts`:

```typescript
it("builds pinout-sourced chips from Alternate and Remap columns", () => {
  const root = mkdtempSync(join(tmpdir(), "mcupinfunc-pinout-source-"));
  const dataRoot = join(root, "data");
  mkdirSync(dataRoot, { recursive: true });

  writeFileSync(
    join(dataRoot, "GD32F103_LQFP4_PINOUT.csv"),
    [
      "PadNumber,PinName,PinType,Alternate,Remap",
      "1,PA4,gpio,SPI0_NSS/USART1_CK,SPI2_NSS",
      "2,PA5,gpio,SPI0_SCK,",
      "3,VDD,power,,",
      "4,VSS,ground,,"
    ].join("\n"),
    "utf8"
  );

  const chip = buildChipFromManifestEntry(
    {
      id: "GD32F103",
      vendor: "GigaDevice",
      family: "GD32F1",
      displayName: "GD32F103",
      functionSource: "pinout-csv",
      packages: [{ name: "LQFP4", pinoutCsv: "GD32F103_LQFP4_PINOUT.csv" }],
      source: "fixture",
      status: "draft"
    },
    dataRoot
  );

  expect(chip.functionSource).toBe("pinout-csv");
  expect(chip.pins.find((pin) => pin.name === "PA4")?.functions.map((fn) => `${fn.af}:${fn.raw}`)).toEqual([
    "GPIO:GPIO_OUT",
    "GPIO:GPIO_IN",
    "ALT:SPI0_NSS",
    "ALT:USART1_CK",
    "REMAP:SPI2_NSS"
  ]);
});
```

- [ ] **Step 2: Run focused build test and verify failure**

Run:

```powershell
npm test -- test/shared/buildDataPack.test.ts
```

Expected: FAIL because `buildChipFromManifestEntry` still reads `entry.gpioAfCsv`.

- [ ] **Step 3: Preserve function source in normalized chips**

In `src/shared/data/normalizeChip.ts`, include the source:

```typescript
return {
  id: entry.id,
  displayName: entry.displayName,
  vendor: entry.vendor,
  family: entry.family,
  functionSource: entry.functionSource ?? "gpio-af-csv",
  pins: pins.map(withGpioInputOutputFunctions).sort(comparePins),
  packages
};
```

- [ ] **Step 4: Update build-data-pack imports**

In `scripts/build-data-pack.ts`, add:

```typescript
import { parsePinoutFunctionCsvText } from "../src/shared/csv/pinoutFunctionCsv";
```

- [ ] **Step 5: Update `buildChipFromManifestEntry`**

Replace the pin parsing part in `scripts/build-data-pack.ts` with:

```typescript
export function buildChipFromManifestEntry(entry: ChipManifestEntry, dataRoot: string): Chip {
  const packages: PackageLayout[] = [];
  const pinoutCsvTexts: string[] = [];

  for (const packageEntry of entry.packages) {
    const pinoutCsvText = readFileSync(join(dataRoot, packageEntry.pinoutCsv), "utf8");
    pinoutCsvTexts.push(pinoutCsvText);
    if (/^LQFP\d+$/.test(packageEntry.name)) {
      packages.push(parseLqfpPinoutCsvText(pinoutCsvText, packageEntry.name));
      continue;
    }

    if (/^BGA\d+$/.test(packageEntry.name)) {
      packages.push(parseBgaPinoutCsvText(pinoutCsvText, packageEntry.name));
    }
  }

  const pins =
    (entry.functionSource ?? "gpio-af-csv") === "pinout-csv"
      ? mergePins(pinoutCsvTexts.flatMap(parsePinoutFunctionCsvText))
      : parseGpioAfCsvText(readFileSync(join(dataRoot, entry.gpioAfCsv ?? ""), "utf8"));

  return normalizeChip(entry, pins, packages);
}
```

Add this helper below the function:

```typescript
function mergePins(pins: Chip["pins"]): Chip["pins"] {
  const byName = new Map<string, Chip["pins"][number]>();
  for (const pin of pins) {
    const existing = byName.get(pin.name);
    if (!existing) {
      byName.set(pin.name, { ...pin, functions: [...pin.functions] });
      continue;
    }

    for (const fn of pin.functions) {
      if (!existing.functions.some((existingFn) => existingFn.af === fn.af && existingFn.raw === fn.raw)) {
        existing.functions.push(fn);
      }
    }
  }

  return [...byName.values()];
}
```

- [ ] **Step 6: Run build tests**

Run:

```powershell
npm test -- test/shared/buildDataPack.test.ts test/shared/normalizeChip.test.ts
```

Expected: both test files pass.

- [ ] **Step 7: Commit**

```powershell
git add scripts/build-data-pack.ts src/shared/data/normalizeChip.ts test/shared/buildDataPack.test.ts test/shared/normalizeChip.test.ts
git commit -m "feat: build chips from pinout functions"
```

---

### Task 4: Sync Manifest And Remote Index For Pinout-Only Sources

**Files:**
- Modify: `scripts/sync-chip-manifest.ts`
- Modify: `scripts/build-remote-chip-index.ts`
- Test: `test/shared/syncChipManifest.test.ts`
- Test: `test/shared/buildRemoteChipIndex.test.ts`

- [ ] **Step 1: Write failing manifest sync test**

Add this test to `test/shared/syncChipManifest.test.ts`:

```typescript
it("syncs a chip that only has package pinout CSVs as pinout-csv", () => {
  const root = mkdtempSync(join(tmpdir(), "mcupinfunc-sync-pinout-"));
  const dataRoot = join(root, "mcupinfunc-data");
  const chipDir = join(dataRoot, "chips/gigadevice/gd32f1/gd32f103/source");
  mkdirSync(chipDir, { recursive: true });
  writeFileSync(
    join(chipDir, "GD32F103_LQFP4_PINOUT.csv"),
    ["PadNumber,PinName,PinType,Alternate,Remap", "1,PA4,gpio,SPI0_NSS,SPI2_NSS", "2,VDD,power,,", "3,VSS,ground,,", "4,NRST,reset,,"].join("\n"),
    "utf8"
  );

  const manifest = syncChipManifest(root, { dataRoot });

  expect(manifest.chips).toEqual([
    expect.objectContaining({
      id: "GD32F103",
      functionSource: "pinout-csv",
      packages: [{ name: "LQFP4", pinoutCsv: "chips/gigadevice/gd32f1/gd32f103/source/GD32F103_LQFP4_PINOUT.csv" }]
    })
  ]);
  expect(manifest.chips[0]?.gpioAfCsv).toBeUndefined();
});
```

- [ ] **Step 2: Run focused sync test and verify failure**

Run:

```powershell
npm test -- test/shared/syncChipManifest.test.ts
```

Expected: FAIL because sync currently only creates entries from `_GPIO_AF.csv`.

- [ ] **Step 3: Update sync scanning model**

In `scripts/sync-chip-manifest.ts`, change `ScannedChip.gpioAfCsv` to optional:

```typescript
type ScannedChip = {
  id: string;
  vendorSlug: string;
  familySlug: string;
  chipSlug: string;
  functionSource: "gpio-af-csv" | "pinout-csv";
  gpioAfCsv?: string;
  sourcePath: string;
  packages: Array<{
    name: string;
    pinoutCsv: string;
  }>;
};
```

Update `scanCsvFiles` so it builds one `ScannedChip` for every chip id found in either `gpioFiles` or `pinoutFilesByChip`. For entries with no GPIO AF file, set `functionSource: "pinout-csv"`, `sourcePath` to the first package CSV path, and leave `gpioAfCsv` undefined. Sort by `sourcePath`.

- [ ] **Step 4: Update merge behavior**

In `mergeChip`, return:

```typescript
return {
  id: existing?.id ?? scanned.id,
  vendor: existing?.vendor ?? toDisplayName(scanned.vendorSlug),
  family: existing?.family ?? scanned.familySlug.toUpperCase(),
  displayName: existing?.displayName ?? scanned.id,
  functionSource: scanned.functionSource,
  gpioAfCsv: scanned.gpioAfCsv,
  packages: scanned.packages,
  source: existing?.source ?? `${scanned.id} ${scanned.functionSource} CSV scanned from ${scanned.sourcePath}`,
  status: existing?.status ?? "draft"
};
```

- [ ] **Step 5: Write failing remote index test**

Add a pinout-source case to `test/shared/buildRemoteChipIndex.test.ts`:

```typescript
it("builds remote index entries for pinout-csv chips without gpio-af source files", () => {
  const root = mkdtempSync(join(tmpdir(), "mcupinfunc-remote-pinout-index-"));
  const dataRoot = join(root, "mcupinfunc-data");
  const chipDir = join(dataRoot, "chips/gigadevice/gd32f1/gd32f103/source");
  mkdirSync(chipDir, { recursive: true });
  writeFileSync(
    join(chipDir, "GD32F103_LQFP4_PINOUT.csv"),
    ["PadNumber,PinName,PinType,Alternate,Remap", "1,PA4,gpio,SPI0_NSS,SPI2_NSS", "2,PA5,gpio,SPI0_SCK,", "3,VDD,power,,", "4,VSS,ground,,"].join("\n"),
    "utf8"
  );

  const index = buildRemoteChipIndex(root, {
    dataRoot,
    owner: "example",
    repo: "chips",
    branch: "dev"
  });

  expect(index.chips[0]).toMatchObject({
    id: "GD32F103",
    sourceFiles: [
      {
        type: "pinout",
        package: "LQFP4",
        url: "https://raw.githubusercontent.com/example/chips/dev/chips/gigadevice/gd32f1/gd32f103/source/GD32F103_LQFP4_PINOUT.csv"
      }
    ]
  });
  expect(existsSync(join(dataRoot, "chips/gigadevice/gd32f1/gd32f103/chip.json"))).toBe(true);
});
```

- [ ] **Step 6: Update remote index path and source files**

In `scripts/build-remote-chip-index.ts`, update `chipOutputRelativePath`:

```typescript
function chipOutputRelativePath(entry: ChipManifestEntry): string {
  const sourceFile = entry.gpioAfCsv ?? entry.packages[0]?.pinoutCsv;
  if (sourceFile) {
    const sourceDir = dirname(sourceFile).replace(/\\/g, "/");
    if (sourceDir.endsWith("/source")) {
      return `${dirname(sourceDir)}/chip.json`.replace(/\\/g, "/");
    }
  }

  return `chips/${entry.vendor.toLowerCase()}/${entry.family.toLowerCase()}/${entry.id.toLowerCase()}/chip.json`;
}
```

Update `sourceFiles` so it includes the GPIO AF entry only when `entry.gpioAfCsv` is defined:

```typescript
const files: RemoteChipSourceFile[] = [];
if (entry.gpioAfCsv) {
  files.push({ type: "gpio-af", url: rawGithubUrl(owner, repo, branch, entry.gpioAfCsv) });
}
files.push(
  ...entry.packages.map((packageEntry) => ({
    type: "pinout" as const,
    package: packageEntry.name,
    url: rawGithubUrl(owner, repo, branch, packageEntry.pinoutCsv)
  }))
);
return files;
```

- [ ] **Step 7: Run manifest and remote index tests**

Run:

```powershell
npm test -- test/shared/syncChipManifest.test.ts test/shared/buildRemoteChipIndex.test.ts
```

Expected: both test files pass.

- [ ] **Step 8: Commit**

```powershell
git add scripts/sync-chip-manifest.ts scripts/build-remote-chip-index.ts test/shared/syncChipManifest.test.ts test/shared/buildRemoteChipIndex.test.ts
git commit -m "feat: index pinout-sourced chips"
```

---

### Task 5: Local CSV Import Supports Pinout Function Source

**Files:**
- Modify: `src/extension/csvImport.ts`
- Test: `test/extension/csvImport.test.ts`

- [ ] **Step 1: Write failing import test**

Add this test to `test/extension/csvImport.test.ts`:

```typescript
it("builds an imported chip from package pinout CSVs without GPIO AF CSV", () => {
  const chip = buildImportedChip({
    id: "GD32F103",
    displayName: "GD32F103",
    vendor: "GigaDevice",
    family: "GD32F1",
    functionSource: "pinout-csv",
    packages: [
      {
        packageName: "LQFP4",
        csvText: [
          "PadNumber,PinName,PinType,Alternate,Remap",
          "1,PA4,gpio,SPI0_NSS/USART1_CK,SPI2_NSS",
          "2,PA5,gpio,SPI0_SCK,",
          "3,VDD,power,,",
          "4,VSS,ground,,"
        ].join("\n")
      }
    ]
  });

  expect(chip.functionSource).toBe("pinout-csv");
  expect(chip.pins.find((pin) => pin.name === "PA4")?.functions.map((fn) => fn.raw)).toContain("SPI2_NSS");
});
```

- [ ] **Step 2: Run focused import test and verify failure**

Run:

```powershell
npm test -- test/extension/csvImport.test.ts
```

Expected: FAIL because `CsvImportInput.gpioAfCsvText` is required.

- [ ] **Step 3: Update import input types**

In `src/extension/csvImport.ts`, update `CsvImportInput`:

```typescript
export type CsvImportInput = CsvImportMetadata & {
  functionSource?: "gpio-af-csv" | "pinout-csv";
  gpioAfCsvText?: string;
  packages?: CsvImportPackageInput[];
};
```

- [ ] **Step 4: Update imported chip building**

In `buildImportedChip`, compute `functionSource` and pins:

```typescript
const functionSource = input.functionSource ?? (input.gpioAfCsvText ? "gpio-af-csv" : "pinout-csv");
if (functionSource === "gpio-af-csv") {
  if (!input.gpioAfCsvText) {
    throw new Error("GPIO AF CSV text is required for gpio-af-csv imports.");
  }
  const gpioAfValidation = validateGpioAfCsvText(input.gpioAfCsvText);
  if (gpioAfValidation.errors.length > 0) {
    throw new Error(`Invalid GPIO AF CSV:\n${gpioAfValidation.errors.join("\n")}`);
  }
}
```

Use `parsePinoutFunctionCsvText` for `pinout-csv` imports after package validation:

```typescript
const pins =
  functionSource === "pinout-csv"
    ? mergePins((input.packages ?? []).flatMap((packageInput) => parsePinoutFunctionCsvText(packageInput.csvText)))
    : parseGpioAfCsvText(input.gpioAfCsvText ?? "");
```

Set `functionSource` in the manifest entry.

- [ ] **Step 5: Update dialog selection flow**

Change `importLocalCsvFromUris` so it uses `findSingleGpioAfCsvFile(files)` only when one exists. If no GPIO AF file exists, treat all selected files ending `_PINOUT.csv` as package CSVs, infer metadata from the first package filename stem by removing `_(LQFP\d+|BGA\d+)_PINOUT.csv`, and pass `functionSource: "pinout-csv"`.

Keep the existing error when more than one `_GPIO_AF.csv` is selected.

- [ ] **Step 6: Run import tests**

Run:

```powershell
npm test -- test/extension/csvImport.test.ts
```

Expected: all CSV import tests pass.

- [ ] **Step 7: Commit**

```powershell
git add src/extension/csvImport.ts test/extension/csvImport.test.ts
git commit -m "feat: import pinout-sourced csv chips"
```

---

### Task 6: Python Extractor Emits Alternate And Remap Columns

**Files:**
- Modify: `external-data/mcupinfunc-data/tools/extract_pin_csv.py`
- Create: `external-data/mcupinfunc-data/tools/test_extract_pin_csv.py`

- [ ] **Step 1: Write failing Python extraction tests**

Create `external-data/mcupinfunc-data/tools/test_extract_pin_csv.py`:

```python
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import extract_pin_csv as extractor


class ExtractPinCsvTest(unittest.TestCase):
    def test_extracts_alternate_and_remap_from_pin_definition_rows(self) -> None:
        text = """
        2.6.2. GD32F103Vx LQFP100 pin definitions
        Table 2-6. GD32F103Vx LQFP100 pin definitions
        GD32F103Vx LQFP100
        Pin I/O
        Pin Name Pins Functions description
        Type(1) Level(2)
        Default: PA4
        Alternate: SPI0_NSS, USART1_CK, ADC01_IN4,
        PA4 29 I/O
        DAC0_OUT0
        Remap:SPI2_NSS, I2S2_WS
        Default: PA5
        PA5 30 I/O
        Alternate: SPI0_SCK, ADC01_IN5, DAC0_OUT1
        VSS_4 31 P Default: VSS_4
        VDD_4 32 P Default: VDD_4
        2.7. Memory map
        """

        rows = extractor.extract_package_rows(text, "LQFP100", include_functions=True)
        csv_text = extractor.rows_to_csv_text(rows, "LQFP100", include_functions=True)

        self.assertIn("PadNumber,PinName,PinType,Alternate,Remap", csv_text.splitlines()[0])
        self.assertIn('29,PA4,gpio,SPI0_NSS/USART1_CK/ADC01_IN4/DAC0_OUT0,SPI2_NSS/I2S2_WS', csv_text)
        self.assertIn("30,PA5,gpio,SPI0_SCK/ADC01_IN5/DAC0_OUT1,", csv_text)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the Python test and verify failure**

Run:

```powershell
python external-data/mcupinfunc-data/tools/test_extract_pin_csv.py
```

Expected: FAIL because `include_functions` is not accepted and `PinRow` has no function fields.

- [ ] **Step 3: Extend `PinRow`**

In `external-data/mcupinfunc-data/tools/extract_pin_csv.py`, change `PinRow`:

```python
@dataclass(frozen=True)
class PinRow:
    pad_number: int | str
    pin_name: str
    pin_type: str
    alternate: str = ""
    remap: str = ""
```

- [ ] **Step 4: Add function text helpers**

Add helpers near `_clean_line`:

```python
FUNCTION_LABEL_RE = re.compile(r"^(Default|Alternate|Remap):\s*(.*)$", re.I)
FOOTNOTE_RE = re.compile(r"\(\d+\)")


def _clean_function_item(value: str) -> str:
    return FOOTNOTE_RE.sub("", value).strip()


def _function_cell(parts: list[str]) -> str:
    items: list[str] = []
    for part in parts:
        for item in part.split(","):
            cleaned = _clean_function_item(item)
            if cleaned:
                items.append(cleaned)
    return "/".join(dict.fromkeys(items))
```

- [ ] **Step 5: Track `Alternate` and `Remap` around package rows**

Update `extract_package_rows` signature:

```python
def extract_package_rows(text: str, package: str, include_functions: bool = False) -> list[PinRow]:
```

Inside the loop, maintain `current_alternate_parts`, `current_remap_parts`, and `current_function_target`. When a line matches `Alternate:` or `Remap:`, start collecting into that target. When a row is emitted, attach the collected cells to that row and clear the collectors after the row's continuation lines have been consumed. The test text above defines the minimum required behavior: `Alternate:` may appear before the row and continue after the row; `Remap:` may appear after the row.

- [ ] **Step 6: Update CSV writer**

Update `rows_to_csv_text` signature:

```python
def rows_to_csv_text(rows: Iterable[PinRow], package: str = "", include_functions: bool = False) -> str:
```

Build the header:

```python
header = [first_header, "PinName", "PinType"]
if include_functions:
    header.extend(["Alternate", "Remap"])
writer.writerow(header)
```

Write row data:

```python
values = [row.pad_number, row.pin_name, row.pin_type]
if include_functions:
    values.extend([row.alternate, row.remap])
writer.writerow(values)
```

- [ ] **Step 7: Add CLI option**

In `parse_args`, add:

```python
parser.add_argument(
    "--pinout-functions",
    action="store_true",
    help="Write Alternate and Remap columns into package pinout CSVs when present in pin definition tables.",
)
```

Pass `include_functions=args.pinout_functions` into `write_package_csvs`, and add an `include_functions` parameter to `write_package_csvs`.

- [ ] **Step 8: Run Python extractor tests**

Run:

```powershell
python external-data/mcupinfunc-data/tools/test_extract_pin_csv.py
```

Expected: the new extractor tests pass.

- [ ] **Step 9: Commit**

```powershell
git add external-data/mcupinfunc-data/tools/extract_pin_csv.py external-data/mcupinfunc-data/tools/test_extract_pin_csv.py
git commit -m "feat: extract functions into pinout csv"
```

---

### Task 7: GD32 Crawler Selects Function Source

**Files:**
- Modify: `external-data/mcupinfunc-data/tools/crawl_gd32_pdfs.py`
- Modify: `external-data/mcupinfunc-data/tools/test_crawl_gd32_pdfs.py`

- [ ] **Step 1: Write failing crawler report test**

Add this test to `external-data/mcupinfunc-data/tools/test_crawl_gd32_pdfs.py`:

```python
def test_report_includes_function_source_for_successes(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        report_path = Path(temp_dir) / "crawl-report.json"
        report = crawler.CrawlReport(
            successes=[
                crawler.CrawlSuccess(
                    part="GD32F103",
                    pdf_url="https://download.gigadevice.com/Datasheet/GD32F103xx%20Datasheet_Rev3.3.pdf",
                    packages=["LQFP100"],
                    function_source="pinout-csv",
                    written_files=["chips/gigadevice/gd32f1/gd32f103/source/GD32F103_LQFP100_PINOUT.csv"],
                )
            ]
        )

        crawler.write_report(report_path, report)

        payload = json.loads(report_path.read_text(encoding="utf-8"))
        self.assertEqual(payload["successes"][0]["function_source"], "pinout-csv")
```

- [ ] **Step 2: Run crawler tests and verify failure**

Run:

```powershell
python external-data/mcupinfunc-data/tools/test_crawl_gd32_pdfs.py
```

Expected: FAIL because `CrawlSuccess` has no `function_source`.

- [ ] **Step 3: Extend crawler success model**

In `external-data/mcupinfunc-data/tools/crawl_gd32_pdfs.py`, change `CrawlSuccess`:

```python
@dataclass(frozen=True)
class CrawlSuccess:
    part: str
    pdf_url: str
    packages: list[str]
    function_source: str
    written_files: list[str]
```

Update existing test fixtures to pass `function_source="gpio-af-csv"`.

- [ ] **Step 4: Add extraction mode helper**

Add:

```python
def infer_function_source(part: str, pdf_path: Path) -> str:
    text = read_pdf_text(pdf_path)
    if "AF0" in text and "AF15" in text:
        return "gpio-af-csv"
    return "pinout-csv"
```

Use this helper in `extract_candidate`.

- [ ] **Step 5: Update extraction call**

In `extract_candidate`, replace the write call with:

```python
function_source = infer_function_source(candidate.part, pdf_path)
written = write_package_csvs(
    pdf_path,
    packages,
    output_dir,
    candidate.part,
    write_gpio_af=function_source == "gpio-af-csv",
    include_functions=function_source == "pinout-csv",
)
```

Return `function_source=function_source` in `CrawlSuccess`.

- [ ] **Step 6: Add CLI override**

In `parse_args`, add:

```python
parser.add_argument(
    "--function-source",
    choices=["auto", "gpio-af-csv", "pinout-csv"],
    default="auto",
    help="Function extraction mode. auto uses GPIO AF tables when present and pinout functions otherwise.",
)
```

Thread this option through `crawl_and_extract` and `extract_candidate`. When it is not `auto`, use the requested mode.

- [ ] **Step 7: Run crawler tests**

Run:

```powershell
python external-data/mcupinfunc-data/tools/test_crawl_gd32_pdfs.py
```

Expected: all crawler tests pass.

- [ ] **Step 8: Commit**

```powershell
git add external-data/mcupinfunc-data/tools/crawl_gd32_pdfs.py external-data/mcupinfunc-data/tools/test_crawl_gd32_pdfs.py
git commit -m "feat: crawl gd32 pinout function sources"
```

---

### Task 8: End-To-End Verification

**Files:**
- Verify only unless tests expose a defect.

- [ ] **Step 1: Run TypeScript tests**

Run:

```powershell
npm test
```

Expected: all Vitest suites pass.

- [ ] **Step 2: Run extension build**

Run:

```powershell
npm run build:extension-only
```

Expected: extension and webview builds pass without reading bundled chip CSV data.

- [ ] **Step 3: Run data fixture validation**

Run:

```powershell
npm run validate:data
```

Expected: existing legacy/dev/test fixtures still validate.

- [ ] **Step 4: Run data fixture build**

Run:

```powershell
npm run build:data
```

Expected: existing generated chip JSON still builds.

- [ ] **Step 5: Run Python crawler tests**

Run:

```powershell
python external-data/mcupinfunc-data/tools/test_extract_pin_csv.py
python external-data/mcupinfunc-data/tools/test_crawl_gd32_pdfs.py
```

Expected: both Python unittest files pass.

- [ ] **Step 6: Smoke extract GD32F103 local PDF**

Run:

```powershell
python external-data/mcupinfunc-data/tools/extract_pin_csv.py --pdf "C:\Users\GYM\Downloads\GD32F103xx Datasheet_Rev3.3.pdf" --part GD32F103 --packages LQFP100 --repo-root external-data/mcupinfunc-data --output-dir external-data/mcupinfunc-data/staging/gd32f103-smoke --pinout-functions --no-gpio-af
```

Expected: `external-data/mcupinfunc-data/staging/gd32f103-smoke/GD32F103_LQFP100_PINOUT.csv` contains `Alternate` and `Remap` columns, including `PA4` with `SPI0_NSS` and `SPI2_NSS`.

- [ ] **Step 7: Smoke build remote data from staged chip**

Copy the staged CSV into `external-data/mcupinfunc-data/chips/gigadevice/gd32f1/gd32f103/source/` only in a disposable branch or temporary checkout. Then run:

```powershell
npm run validate:remote-data
npm run build:remote-data
```

Expected: validation passes, `chip.json` includes `functionSource: "pinout-csv"`, `PA4` includes `ALT:SPI0_NSS` and `REMAP:SPI2_NSS`, and `index.json` lists only the pinout source file for GD32F103.

- [ ] **Step 8: Check git status**

Run:

```powershell
git status --short
```

Expected: only intended source, test, and plan files are modified; no `dist/`, `generated/`, `.codegraph/`, `.cursor/`, `external-data/mcupinfunc-data/staging/`, or VSIX artifacts are staged.

