# Remote Chip Data Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert McuPinFunc into a lightweight VS Code extension that ships without chip CSV data, lets users search and download only needed chip data from a GitHub-hosted data repository, and supports importing local CSV files.

**Architecture:** Keep CSV parsing, validation, normalization, assignment, search, and package rendering inside this extension. Move chip source CSVs into a separate local ignored checkout of a GitHub data repository, generate a small remote `index.json` plus per-chip `chip.json` files for runtime consumption, and cache downloaded/imported chips under `ExtensionContext.globalStorageUri`.

**Tech Stack:** TypeScript, Node.js, VS Code Extension API, React Webview, Vitest, GitHub repository or `gh` CLI for data repository setup.

---

## Scope And Decisions

- The VSIX must not include `data/chips/**`, `generated/chips/**`, or any large chip CSV data.
- This is a migration plan. After Task 1 excludes data paths, do not publish or distribute a light VSIX until Task 4 through Task 8 prove runtime loading no longer depends on extension-installed chip data.
- The main McuPinFunc repository may keep a local data checkout under `external-data/mcupinfunc-data/`, but `.gitignore` must ignore it.
- The data repository stores all source CSVs in one GitHub repository.
- Users download only the chip they select, not the whole repository.
- Runtime chip loading should prefer local user storage, not extension install files.
- Remote downloads should fetch per-chip generated JSON by default; CSVs remain available in the data repository for maintenance and optional import/debug workflows.
- Local CSV import must use the same validators/parsers as the data build pipeline.
- Existing `data/chips/**` can remain temporarily for migration tests, but the packaging flow must exclude it.

---

## Target Repository Layout

### Main Extension Repository

```text
D:\WorkSpace\Vibe_Projects\McuPinFunc\
  external-data\
    mcupinfunc-data\        ignored local checkout of the data repo
  src\
  scripts\
  test\
  docs\
```

### Data Repository

Recommended GitHub repo name:

```text
GYM-png/mcupinfunc-data
```

Recommended contents:

```text
mcupinfunc-data/
  README.md
  index.json
  chips/
    gigadevice/
      gd32f4/
        gd32f407/
          chip.json
          source/
            GD32F407_GPIO_AF.csv
            GD32F407_LQFP100_PINOUT.csv
            GD32F407_LQFP144_PINOUT.csv
```

`index.json` schema:

```json
{
  "schemaVersion": 1,
  "dataVersion": "2026.06.04",
  "chips": [
    {
      "id": "gd32f407",
      "displayName": "GD32F407",
      "vendor": "GigaDevice",
      "family": "GD32F4",
      "packages": ["LQFP100", "LQFP144"],
      "status": "stable",
      "chipUrl": "https://raw.githubusercontent.com/GYM-png/mcupinfunc-data/main/chips/gigadevice/gd32f4/gd32f407/chip.json",
      "sourceFiles": [
        {
          "type": "gpio-af",
          "url": "https://raw.githubusercontent.com/GYM-png/mcupinfunc-data/main/chips/gigadevice/gd32f4/gd32f407/source/GD32F407_GPIO_AF.csv"
        },
        {
          "type": "pinout",
          "package": "LQFP100",
          "url": "https://raw.githubusercontent.com/GYM-png/mcupinfunc-data/main/chips/gigadevice/gd32f4/gd32f407/source/GD32F407_LQFP100_PINOUT.csv"
        }
      ]
    }
  ]
}
```

---

## File Structure To Create Or Modify

- Modify: `.gitignore`
  - Add `external-data/` and optional local cache folders.
- Modify: `.vscodeignore`
  - Ensure `data/**`, `generated/**`, and `external-data/**` are excluded from VSIX.
- Modify: `package.json`
  - Add commands for extension-only build, packaging, data-repo index build, and data-repo validation.
- Create: `src/shared/data/remoteChipIndex.ts`
  - Types and validators for remote `index.json`.
- Create: `src/shared/data/chipStorage.ts`
  - Pure helpers for chip storage path naming and metadata.
- Modify: `src/extension/chipRepository.ts`
  - Replace extension-root-only reads with user library reads from `globalStorageUri`.
- Create: `src/extension/remoteChipRegistry.ts`
  - Fetch, parse, cache, and search remote `index.json`.
- Create: `src/extension/chipLibrary.ts`
  - List installed chips, install remote chip JSON, remove installed chip, load installed chip.
- Create: `src/extension/csvImport.ts`
  - Import local CSV files, validate them, normalize them to `Chip`, and save to local library.
- Modify: `src/shared/protocol.ts`
  - Add messages for online search, download, installed chip list, and CSV import results.
- Modify: `src/extension/webviewPanel.ts`
  - Handle new messages and post installed/remote states.
- Modify: `src/webview/state/usePinMapStore.ts`
  - Track installed chips, search results, download/import status, and selected chip.
- Modify: `src/webview/components/*`
  - Add UI for empty state, remote search, installed library, and import commands.
- Modify: `scripts/sync-chip-manifest.ts`
  - Accept a configurable data root for the external data repo.
- Modify: `scripts/build-data-pack.ts`
  - Accept a configurable source root and output root; support building per-chip `chip.json` into the data repo.
- Modify: `scripts/validate-data-pack.ts`
  - Accept a configurable source root.
- Create: `scripts/build-remote-chip-index.ts`
  - Build `index.json` for the data repo from CSV source files and generated chip JSON.
- Create tests under `test/shared/` and `test/extension/` for each new pure module.

---

## Task 1: Create GitHub Data Repository And Local Ignored Checkout

**Files:**
- Modify: `.gitignore`
- Modify: `.vscodeignore`
- Modify: `AGENTS.md`
- External repo: `GYM-png/mcupinfunc-data`

- [ ] **Step 1: Check current GitHub CLI availability**

Run:

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" --version
```

Expected: prints a `gh version ...` line. If the path does not exist, run:

```powershell
gh --version
```

- [ ] **Step 2: Check GitHub authentication**

Run:

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" auth status -h github.com
```

Expected: authenticated as the user's GitHub account. If auth is missing, run:

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" auth login -h github.com -p https -w
```

- [ ] **Step 3: Create the data repository**

Run:

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" repo create GYM-png/mcupinfunc-data --public --description "Chip CSV and generated data packs for McuPinFunc" --clone=false
```

Expected: repository created at `https://github.com/GYM-png/mcupinfunc-data`.

If the repo already exists, continue.

- [ ] **Step 4: Clone the data repository inside the main project**

Run:

```powershell
New-Item -ItemType Directory -Force -Path external-data
git clone https://github.com/GYM-png/mcupinfunc-data.git external-data/mcupinfunc-data
```

Expected: `external-data/mcupinfunc-data/.git` exists.

- [ ] **Step 5: Ignore the local data checkout**

Add these lines to `.gitignore`:

```gitignore
external-data/
data/
```

Keep `generated/` ignored.

- [ ] **Step 6: Exclude data paths from VSIX packaging**

Add these lines to `.vscodeignore`:

```gitignore
data/**
generated/**
external-data/**
```

Important migration note: after this step, a VSIX built before the runtime local library and remote download flow are complete may open without the data files the current runtime expects. Do not publish or distribute a light VSIX until Task 8 passes.

- [ ] **Step 7: Verify status**

Run:

```powershell
git status --short
```

Expected: `.gitignore`, `.vscodeignore`, and this plan are visible as main-repo changes; `external-data/` contents are not visible.

- [ ] **Step 8: Commit**

Run:

```powershell
git add .gitignore .vscodeignore AGENTS.md docs/superpowers/plans/2026-06-04-remote-chip-data-library.md
git commit -m "docs: plan remote chip data library"
```

---

## Task 2: Move Current Chip CSVs Into The Data Repository

**Files:**
- External repo create/modify: `external-data/mcupinfunc-data/README.md`
- External repo create/modify: `external-data/mcupinfunc-data/chips/**/source/*.csv`
- External repo create/modify: `external-data/mcupinfunc-data/index.json`
- Main repo keeps `data/chips/**` only until migration is verified.

- [ ] **Step 1: Copy existing source data into the data repo**

Run:

```powershell
Copy-Item -Recurse -Force data/chips/* external-data/mcupinfunc-data/chips-source-staging/
```

Expected: CSV files and `manifest.json` are staged for migration.

- [ ] **Step 2: Normalize the data repo directory layout**

For each chip, move files into:

```text
external-data/mcupinfunc-data/chips/<vendor>/<family>/<part>/source/
```

Example:

```text
external-data/mcupinfunc-data/chips/gigadevice/gd32f4/gd32f407/source/GD32F407_GPIO_AF.csv
```

- [ ] **Step 3: Add a data repo README**

Create `external-data/mcupinfunc-data/README.md`:

```markdown
# McuPinFunc Data

This repository stores source CSV files and generated chip data packs for McuPinFunc.

McuPinFunc downloads only the selected chip's `chip.json` at runtime. Source CSV files are kept here for maintenance, review, and local import workflows.

## Layout

`index.json` is the searchable remote chip registry.

Each chip lives under:

`chips/<vendor>/<family>/<part>/`

Runtime data:

`chip.json`

Source CSV data:

`source/<PART>_GPIO_AF.csv`
`source/<PART>_<PACKAGE>_PINOUT.csv`
```

- [ ] **Step 4: Commit and push the initial data repository**

Run from `external-data/mcupinfunc-data`:

```powershell
git status --short
git add README.md chips
git commit -m "feat: add initial chip csv data"
git push origin main
```

Expected: source CSV data is visible on GitHub, but not in the main extension repository.

---

## Task 3: Make Data Build Scripts Work Against External Data Roots

**Files:**
- Modify: `scripts/sync-chip-manifest.ts`
- Modify: `scripts/build-data-pack.ts`
- Modify: `scripts/validate-data-pack.ts`
- Create: `scripts/build-remote-chip-index.ts`
- Modify: `package.json`
- Test: `test/shared/syncChipManifest.test.ts`
- Test: `test/shared/buildDataPack.test.ts`

- [ ] **Step 1: Write failing tests for configurable data roots**

Add tests that call:

```ts
syncChipManifest(projectRoot, { dataRoot: externalDataRoot });
buildDataPack(projectRoot, { dataRoot: externalDataRoot, outputRoot: remoteOutputRoot });
```

Expected behavior:

- manifest sync reads CSVs from the provided data root.
- generated `chip.json` files are written to the provided output root.
- default behavior still works for existing `data/chips` tests.

- [ ] **Step 2: Run tests to confirm failure**

Run:

```powershell
npm test -- test/shared/syncChipManifest.test.ts test/shared/buildDataPack.test.ts
```

Expected: fails because current scripts do not accept options.

- [ ] **Step 3: Implement options**

Update function signatures:

```ts
export type DataRootOptions = {
  dataRoot?: string;
  outputRoot?: string;
};
```

Use:

```ts
const dataRoot = options.dataRoot ?? join(root, "data/chips");
const outputDir = options.outputRoot ?? join(root, "generated/chips");
```

- [ ] **Step 4: Add remote index builder**

Create `scripts/build-remote-chip-index.ts` that:

- reads the external data repo source tree,
- validates each chip,
- writes each `chip.json`,
- writes root `index.json`,
- uses raw GitHub URLs for `chipUrl` and `sourceFiles`.

Default command:

```powershell
npx tsx scripts/build-remote-chip-index.ts --data-root external-data/mcupinfunc-data --owner GYM-png --repo mcupinfunc-data --branch main
```

- [ ] **Step 5: Add npm scripts**

Add to `package.json`:

```json
{
  "scripts": {
    "build:extension-only": "npm run build:extension && npm run build:webview",
    "validate:remote-data": "tsx scripts/validate-data-pack.ts --data-root external-data/mcupinfunc-data",
    "build:remote-data": "tsx scripts/build-remote-chip-index.ts --data-root external-data/mcupinfunc-data --owner GYM-png --repo mcupinfunc-data --branch main",
    "package:light": "npm run build:extension-only && npx --yes @vscode/vsce@latest package --allow-missing-repository"
  }
}
```

- [ ] **Step 6: Verify**

Run:

```powershell
npm test -- test/shared/syncChipManifest.test.ts test/shared/buildDataPack.test.ts
npm run build:remote-data
npm run build:extension-only
```

Expected: tests pass, remote data repo receives generated `chip.json` and `index.json`, extension builds without needing bundled data.

- [ ] **Step 7: Commit**

Run:

```powershell
git add scripts package.json package-lock.json test/shared
git commit -m "feat: build remote chip data index"
```

---

## Task 4: Add Runtime Local Chip Library

**Files:**
- Create: `src/shared/data/chipStorage.ts`
- Create: `src/extension/chipLibrary.ts`
- Modify: `src/extension/chipRepository.ts`
- Test: `test/extension/chipLibrary.test.ts`
- Test: `test/extension/chipRepository.test.ts`

- [ ] **Step 1: Write failing tests**

Cover:

- empty library returns no chips,
- saved chip appears in `listChips()`,
- saved chip can be loaded by id,
- invalid JSON is ignored or reported with a clear error,
- chip ids are normalized to lowercase file names.

- [ ] **Step 2: Implement storage helper**

Use `context.globalStorageUri.fsPath` as the root.

Recommended layout:

```text
globalStorage/
  chips/
    gd32f407.json
  imports/
    my-custom-chip.json
  remote-index.json
```

- [ ] **Step 3: Implement `ChipLibrary`**

Methods:

```ts
listInstalledChips(): Promise<ChipSummary[]>;
loadInstalledChip(chipId: string): Promise<Chip>;
saveRemoteChip(chip: Chip): Promise<void>;
saveImportedChip(chip: Chip): Promise<void>;
removeChip(chipId: string): Promise<void>;
```

- [ ] **Step 4: Refactor `ChipRepository`**

`ChipRepository` should delegate to `ChipLibrary` and stop reading:

```text
data/chips/manifest.json
generated/chips/<chip>.json
```

- [ ] **Step 5: Verify**

Run:

```powershell
npm test -- test/extension/chipLibrary.test.ts test/extension/chipRepository.test.ts
npm run build:extension-only
```

Expected: runtime repository no longer requires packaged chip data.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/extension src/shared/data test/extension
git commit -m "feat: load chips from local user library"
```

---

## Task 5: Add Remote Search And Per-Chip Download

**Files:**
- Create: `src/shared/data/remoteChipIndex.ts`
- Create: `src/extension/remoteChipRegistry.ts`
- Modify: `src/shared/protocol.ts`
- Modify: `src/extension/webviewPanel.ts`
- Test: `test/shared/remoteChipIndex.test.ts`
- Test: `test/extension/remoteChipRegistry.test.ts`

- [ ] **Step 1: Define remote index types**

Add:

```ts
export type RemoteChipIndex = {
  schemaVersion: 1;
  dataVersion: string;
  chips: RemoteChipSummary[];
};

export type RemoteChipSummary = {
  id: string;
  displayName: string;
  vendor: string;
  family: string;
  packages: string[];
  status: "draft" | "stable";
  chipUrl: string;
  sourceFiles: RemoteChipSourceFile[];
};
```

- [ ] **Step 2: Write validation tests**

Cover:

- accepts schema version `1`,
- rejects unsupported schema versions,
- rejects missing `chipUrl`,
- rejects non-HTTPS URLs except localhost test fixtures,
- searches by id, display name, vendor, family, and package.

- [ ] **Step 3: Implement remote registry**

Default index URL setting:

```text
mcupinfunc.remoteIndexUrl
```

Default value:

```text
https://raw.githubusercontent.com/GYM-png/mcupinfunc-data/main/index.json
```

Methods:

```ts
refreshIndex(): Promise<RemoteChipIndex>;
search(query: string): Promise<RemoteChipSummary[]>;
downloadChip(id: string): Promise<Chip>;
```

- [ ] **Step 4: Add extension messages**

Add Webview to Extension:

```ts
| { type: "searchRemoteChips"; query: string }
| { type: "downloadRemoteChip"; chipId: string }
| { type: "refreshInstalledChips" }
```

Add Extension to Webview:

```ts
| { type: "remoteChipSearchResults"; chips: RemoteChipSummary[] }
| { type: "chipDownloadStarted"; chipId: string }
| { type: "chipDownloadCompleted"; chip: ChipSummary }
| { type: "installedChipsLoaded"; chips: ChipSummary[]; selectedChipId?: string }
```

- [ ] **Step 5: Wire downloads to local library**

When `downloadRemoteChip` is received:

1. fetch chip JSON,
2. validate shape and schema compatibility,
3. save through `ChipLibrary.saveRemoteChip`,
4. reload installed chips,
5. select the downloaded chip.

- [ ] **Step 6: Verify**

Run:

```powershell
npm test -- test/shared/remoteChipIndex.test.ts test/extension/remoteChipRegistry.test.ts
npm run build:extension-only
```

- [ ] **Step 7: Commit**

Run:

```powershell
git add src/shared src/extension test package.json package-lock.json
git commit -m "feat: download remote chip data on demand"
```

---

## Task 6: Add Local CSV Import

**Files:**
- Create: `src/extension/csvImport.ts`
- Modify: `src/shared/protocol.ts`
- Modify: `src/extension/webviewPanel.ts`
- Test: `test/extension/csvImport.test.ts`

- [ ] **Step 1: Write import tests**

Cover:

- imports one GPIO AF CSV with no package data,
- imports GPIO AF plus LQFP pinout CSV,
- imports GPIO AF plus BGA pinout CSV,
- rejects invalid GPIO AF CSV with validator message,
- rejects package CSV whose package name does not match the selected type,
- produces a normalized `Chip` saved to local library.

- [ ] **Step 2: Implement import command**

Use VS Code file picker in extension host:

```ts
vscode.window.showOpenDialog({
  canSelectFiles: true,
  canSelectFolders: false,
  canSelectMany: true,
  filters: { CSV: ["csv"] }
});
```

- [ ] **Step 3: Ask for chip metadata**

Use input boxes for:

- chip id,
- display name,
- vendor,
- family,
- package names for selected pinout CSVs.

- [ ] **Step 4: Parse and save**

Use existing functions:

```ts
validateGpioAfCsvText
validateLqfpPinoutCsvText
validateBgaPinoutCsvText
parseGpioAfCsvText
parseLqfpPinoutCsvText
parseBgaPinoutCsvText
normalizeChip
```

- [ ] **Step 5: Add messages**

Add Webview to Extension:

```ts
| { type: "importLocalCsv" }
```

Add Extension to Webview:

```ts
| { type: "chipImportCompleted"; chip: ChipSummary }
```

- [ ] **Step 6: Verify**

Run:

```powershell
npm test -- test/extension/csvImport.test.ts
npm run build:extension-only
```

- [ ] **Step 7: Commit**

Run:

```powershell
git add src/extension src/shared test/extension
git commit -m "feat: import local chip csv data"
```

---

## Task 7: Update Webview UX For Empty Library, Search, Download, And Import

**Files:**
- Modify: `src/webview/App.tsx`
- Modify: `src/webview/state/usePinMapStore.ts`
- Modify: `src/webview/components/*`
- Modify: `src/webview/styles.css`
- Test: existing webview tests if present, otherwise add focused store tests.

- [ ] **Step 1: Define UI states**

States:

- no installed chips,
- loading installed chips,
- remote search idle,
- remote search loading,
- remote search results,
- downloading chip,
- import in progress,
- chip loaded.

- [ ] **Step 2: Implement empty state**

When no chip is installed, show primary actions:

- search online chip data,
- import local CSV.

Avoid showing “No bundled chips are available.”

- [ ] **Step 3: Implement remote search panel**

Controls:

- search input,
- result list,
- package badges,
- download button,
- installed indicator.

- [ ] **Step 4: Implement installed chip library**

Controls:

- installed chip selector,
- remove chip action,
- refresh installed chips action.

- [ ] **Step 5: Verify UI build**

Run:

```powershell
npm run build:webview
npm run build:extension-only
```

Expected: webview compiles and handles empty library without throwing.

- [ ] **Step 6: Manual Extension Host check**

Run:

```powershell
npm run build:extension-only
code --extensionDevelopmentPath "D:\WorkSpace\Vibe_Projects\McuPinFunc"
```

In Extension Development Host:

- run `McuPinFunc: Open Pin Map`,
- confirm empty library state,
- search remote chip,
- download one chip,
- select it,
- import local CSV,
- confirm imported chip appears.

- [ ] **Step 7: Commit**

Run:

```powershell
git add src/webview src/shared/protocol.ts src/extension/webviewPanel.ts test
git commit -m "feat: add chip data library UI"
```

---

## Task 8: Light VSIX Packaging Verification

**Files:**
- Modify: `.vscodeignore`
- Modify: `package.json`
- No chip data should be included.

- [ ] **Step 1: Build light package**

Run:

```powershell
npm run package:light -- --out mcupinfunc-light-0.0.1.vsix
```

Expected: VSIX is created.

- [ ] **Step 2: Inspect package contents**

Run:

```powershell
npx --yes @vscode/vsce@latest ls --packagePath mcupinfunc-light-0.0.1.vsix
```

Expected included paths:

```text
dist/**
package.json
README.md
```

Expected excluded paths:

```text
data/**
generated/**
external-data/**
src/**
scripts/**
test/**
docs/**
node_modules/**
```

- [ ] **Step 3: Install and smoke test**

Run:

```powershell
code --install-extension .\mcupinfunc-light-0.0.1.vsix --force
```

Then open VS Code and verify:

- extension opens without bundled chip data,
- online search works,
- downloading one chip makes the Pin Map usable,
- local CSV import works.

- [ ] **Step 4: Final verification**

Run:

```powershell
npm test
npm run build:extension-only
git status --short
```

Expected: tests pass, build passes, no untracked task-related files except intentionally ignored `external-data/`.

- [ ] **Step 5: Commit**

Run:

```powershell
git add .vscodeignore package.json package-lock.json
git commit -m "chore: package extension without chip data"
```

---

## Task 9: Publish Data Updates Workflow

**Files:**
- External repo: `external-data/mcupinfunc-data/**`
- Main repo scripts from earlier tasks.

- [ ] **Step 1: Add or update CSVs in the data repo**

Put files under:

```text
external-data/mcupinfunc-data/chips/<vendor>/<family>/<part>/source/
```

- [ ] **Step 2: Build remote data**

Run from main extension repo:

```powershell
npm run build:remote-data
```

Expected:

- per-chip `chip.json` files updated,
- root `index.json` updated,
- source CSV files remain in data repo.

- [ ] **Step 3: Commit and push data repo**

Run from `external-data/mcupinfunc-data`:

```powershell
git status --short
git add .
git commit -m "data: add <chip-id>"
git push origin main
```

- [ ] **Step 4: Verify one raw URL**

Open:

```text
https://raw.githubusercontent.com/GYM-png/mcupinfunc-data/main/index.json
```

Expected: new chip appears in `chips`.

---

## Rollback Plan

If remote loading causes a release blocker:

1. keep the data repository intact,
2. revert only runtime repository changes,
3. restore `ChipRepository` extension-root reads,
4. temporarily remove `data/**` and `generated/**` from `.vscodeignore`,
5. run `npm run build`,
6. package a data-bundled VSIX.

Do not delete `external-data/mcupinfunc-data`; it is ignored and can remain as the source for the next attempt.

---

## Verification Checklist

- [ ] `external-data/` is ignored by the main repo.
- [ ] VSIX does not include `data/**`, `generated/**`, or `external-data/**`.
- [ ] Empty install opens with a useful “search/download/import” state.
- [ ] User can search GitHub-hosted `index.json`.
- [ ] Downloading one chip fetches only that chip's `chip.json`.
- [ ] Downloaded chips survive VS Code restart through `globalStorageUri`.
- [ ] Local CSV import validates before saving.
- [ ] Existing Pin Map assignment, conflict detection, package view, search, and export work after a chip is loaded.
- [ ] `npm test` passes.
- [ ] `npm run build:extension-only` passes.
- [ ] `npm run package:light` creates a small VSIX.

---

## Recommended Execution Order

1. Create and ignore the data repository checkout.
2. Move current CSVs into the data repository.
3. Build data-repo index and per-chip JSON generation.
4. Refactor runtime loading to local user library.
5. Add remote search and per-chip download.
6. Add local CSV import.
7. Update Webview UX.
8. Verify light VSIX packaging.
9. Document the data publishing workflow in README files.
