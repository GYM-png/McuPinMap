# Project Pin Map Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project-level `.pinmap` storage with multiple named maps, sidebar launching, and auto-saved chip/package/view/assignment state.

**Architecture:** Keep chip data in the existing `ChipRepository`/`ChipLibrary` under `globalStorageUri`, and store only project map state in workspace `.pinmap` files. Add a pure shared schema module, an extension-host filesystem store, project-map protocol messages, sidebar map listing, and webview save/load controls.

**Tech Stack:** TypeScript, VS Code Extension API, React, Zustand, Vitest, Node `fs`/`path` APIs.

---

## File Structure

- Create `src/shared/projectPinMapConfig.ts`
  - Defines `.pinmap` types, validation, default creation, id generation, duplicate naming, and timestamp injection.
- Create `test/shared/projectPinMapConfig.test.ts`
  - Covers schema parsing, defaults, id generation, and invalid documents.
- Create `src/extension/projectPinMapStore.ts`
  - Resolves workspace roots and owns `.pinmap/index.json` plus `.pinmap/maps/*.json`.
- Create `test/extension/projectPinMapStore.test.ts`
  - Uses temporary directories to cover create/list/load/save/duplicate/rename and corrupted-file errors.
- Modify `src/shared/protocol.ts`
  - Adds project map message types.
- Modify `src/extension/webviewPanel.ts`
  - Loads a project map, saves map state instead of writing new assignments to `workspaceState`, and accepts an initial map id.
- Modify `src/extension/extension.ts`
  - Creates a shared `ProjectPinMapStore` and passes it to panel/sidebar wiring.
- Modify `src/extension/sidebarLauncher.ts`
  - Renders map list HTML for the persistent view.
- Modify `test/extension/sidebarLauncher.test.ts`
  - Verifies map list, create action, and no-workspace states.
- Modify `src/webview/state/usePinMapStore.ts`
  - Tracks active project map metadata and save status.
- Modify `src/webview/extensionMessages.ts`
  - Handles project map messages.
- Modify `src/webview/App.tsx`, `src/webview/components/Shell.tsx`, and selected controls
  - Adds map metadata UI and sends auto-save messages from meaningful state changes.
- Modify webview tests under `test/webview/`
  - Adds store/message tests for map metadata and save status.

## Data Model

Use these names consistently across all tasks.

```typescript
export type ProjectPinMapSummary = {
  id: string;
  name: string;
  chipId?: string;
  updatedAt: string;
};

export type ProjectPinMapIndex = {
  schemaVersion: 1;
  activeMapId?: string;
  maps: ProjectPinMapSummary[];
};

export type ProjectPinMapDocument = {
  schemaVersion: 1;
  id: string;
  name: string;
  chipId?: string;
  selectedPackageName?: string;
  mapView: "logical" | "package";
  assignments: Assignment[];
  updatedAt: string;
};

export type ProjectPinMapLoadState =
  | { kind: "ready"; index: ProjectPinMapIndex; activeMap?: ProjectPinMapDocument }
  | { kind: "empty"; index?: ProjectPinMapIndex }
  | { kind: "no-workspace" }
  | { kind: "error"; message: string };
```

## Task 1: Shared `.pinmap` Schema

**Files:**
- Create: `src/shared/projectPinMapConfig.ts`
- Create: `test/shared/projectPinMapConfig.test.ts`

- [ ] **Step 1: Write failing schema tests**

Create `test/shared/projectPinMapConfig.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  createDefaultProjectPinMap,
  createNextProjectPinMapId,
  parseProjectPinMapDocument,
  parseProjectPinMapIndex,
  summarizeProjectPinMap
} from "../../src/shared/projectPinMapConfig";

describe("projectPinMapConfig", () => {
  it("creates a default project map and matching index", () => {
    const now = "2026-06-18T12:00:00.000Z";
    const created = createDefaultProjectPinMap(now);

    expect(created.index).toEqual({
      schemaVersion: 1,
      activeMapId: "default",
      maps: [
        {
          id: "default",
          name: "Default",
          updatedAt: now
        }
      ]
    });
    expect(created.map).toEqual({
      schemaVersion: 1,
      id: "default",
      name: "Default",
      mapView: "package",
      assignments: [],
      updatedAt: now
    });
  });

  it("parses valid index and map documents", () => {
    expect(
      parseProjectPinMapIndex({
        schemaVersion: 1,
        activeMapId: "default",
        maps: [{ id: "default", name: "Default", chipId: "gd32f407", updatedAt: "2026-06-18T12:00:00.000Z" }]
      })
    ).toEqual({
      schemaVersion: 1,
      activeMapId: "default",
      maps: [{ id: "default", name: "Default", chipId: "gd32f407", updatedAt: "2026-06-18T12:00:00.000Z" }]
    });

    expect(
      parseProjectPinMapDocument({
        schemaVersion: 1,
        id: "default",
        name: "Default",
        chipId: "gd32f407",
        selectedPackageName: "LQFP100",
        mapView: "package",
        assignments: [],
        updatedAt: "2026-06-18T12:00:00.000Z"
      })
    ).toMatchObject({
      id: "default",
      name: "Default",
      chipId: "gd32f407",
      selectedPackageName: "LQFP100",
      mapView: "package"
    });
  });

  it("rejects invalid documents with useful messages", () => {
    expect(() => parseProjectPinMapIndex({ schemaVersion: 2, maps: [] })).toThrow(
      "Project pin map index schemaVersion must be 1."
    );
    expect(() =>
      parseProjectPinMapDocument({
        schemaVersion: 1,
        id: "default",
        name: "Default",
        mapView: "three-dimensional",
        assignments: [],
        updatedAt: "2026-06-18T12:00:00.000Z"
      })
    ).toThrow("Project pin map document mapView must be logical or package.");
  });

  it("creates stable unique ids from names", () => {
    expect(createNextProjectPinMapId("Motor Control", new Set())).toBe("motor-control");
    expect(createNextProjectPinMapId("Motor Control", new Set(["motor-control"]))).toBe("motor-control-2");
    expect(createNextProjectPinMapId("   ", new Set())).toBe("pin-map");
    expect(createNextProjectPinMapId("CON", new Set())).toBe("pin-map-con");
  });

  it("summarizes a map document for the index", () => {
    expect(
      summarizeProjectPinMap({
        schemaVersion: 1,
        id: "motor-control",
        name: "Motor Control",
        chipId: "gd32f407",
        selectedPackageName: "LQFP100",
        mapView: "package",
        assignments: [],
        updatedAt: "2026-06-18T12:00:00.000Z"
      })
    ).toEqual({
      id: "motor-control",
      name: "Motor Control",
      chipId: "gd32f407",
      updatedAt: "2026-06-18T12:00:00.000Z"
    });
  });
});
```

- [ ] **Step 2: Run schema tests and confirm failure**

Run:

```powershell
npx vitest run test/shared/projectPinMapConfig.test.ts
```

Expected: FAIL because `src/shared/projectPinMapConfig.ts` does not exist.

- [ ] **Step 3: Implement schema module**

Create `src/shared/projectPinMapConfig.ts`:

```typescript
import type { Assignment } from "./types";

export type ProjectPinMapSummary = {
  id: string;
  name: string;
  chipId?: string;
  updatedAt: string;
};

export type ProjectPinMapIndex = {
  schemaVersion: 1;
  activeMapId?: string;
  maps: ProjectPinMapSummary[];
};

export type ProjectPinMapDocument = {
  schemaVersion: 1;
  id: string;
  name: string;
  chipId?: string;
  selectedPackageName?: string;
  mapView: "logical" | "package";
  assignments: Assignment[];
  updatedAt: string;
};

const reservedWindowsNames = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9"
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const optionalString = (value: unknown): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error("Optional project pin map string fields must be strings.");
  }
  return value;
};

const readString = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Project pin map ${fieldName} must be a non-empty string.`);
  }
  return value;
};

export const createNextProjectPinMapId = (name: string, existingIds: Set<string>): string => {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = reservedWindowsNames.has(normalized)
    ? `pin-map-${normalized}`
    : normalized || "pin-map";

  let candidate = base;
  let suffix = 2;
  while (existingIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
};

export const summarizeProjectPinMap = (map: ProjectPinMapDocument): ProjectPinMapSummary => ({
  id: map.id,
  name: map.name,
  chipId: map.chipId,
  updatedAt: map.updatedAt
});

export const createProjectPinMapDocument = (
  id: string,
  name: string,
  now: string
): ProjectPinMapDocument => ({
  schemaVersion: 1,
  id,
  name,
  mapView: "package",
  assignments: [],
  updatedAt: now
});

export const createDefaultProjectPinMap = (
  now: string
): { index: ProjectPinMapIndex; map: ProjectPinMapDocument } => {
  const map = createProjectPinMapDocument("default", "Default", now);
  return {
    index: {
      schemaVersion: 1,
      activeMapId: map.id,
      maps: [summarizeProjectPinMap(map)]
    },
    map
  };
};

export const parseProjectPinMapIndex = (value: unknown): ProjectPinMapIndex => {
  if (!isObject(value)) {
    throw new Error("Project pin map index must be an object.");
  }
  if (value.schemaVersion !== 1) {
    throw new Error("Project pin map index schemaVersion must be 1.");
  }
  if (!Array.isArray(value.maps)) {
    throw new Error("Project pin map index maps must be an array.");
  }

  return {
    schemaVersion: 1,
    activeMapId: optionalString(value.activeMapId),
    maps: value.maps.map((entry) => {
      if (!isObject(entry)) {
        throw new Error("Project pin map index entries must be objects.");
      }
      return {
        id: readString(entry.id, "summary id"),
        name: readString(entry.name, "summary name"),
        chipId: optionalString(entry.chipId),
        updatedAt: readString(entry.updatedAt, "summary updatedAt")
      };
    })
  };
};

export const parseProjectPinMapDocument = (value: unknown): ProjectPinMapDocument => {
  if (!isObject(value)) {
    throw new Error("Project pin map document must be an object.");
  }
  if (value.schemaVersion !== 1) {
    throw new Error("Project pin map document schemaVersion must be 1.");
  }
  if (value.mapView !== "logical" && value.mapView !== "package") {
    throw new Error("Project pin map document mapView must be logical or package.");
  }
  if (!Array.isArray(value.assignments)) {
    throw new Error("Project pin map document assignments must be an array.");
  }

  return {
    schemaVersion: 1,
    id: readString(value.id, "document id"),
    name: readString(value.name, "document name"),
    chipId: optionalString(value.chipId),
    selectedPackageName: optionalString(value.selectedPackageName),
    mapView: value.mapView,
    assignments: value.assignments as Assignment[],
    updatedAt: readString(value.updatedAt, "document updatedAt")
  };
};
```

- [ ] **Step 4: Run schema tests**

Run:

```powershell
npx vitest run test/shared/projectPinMapConfig.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit schema work**

Run:

```powershell
git status --short
git add -- src/shared/projectPinMapConfig.ts test/shared/projectPinMapConfig.test.ts
git commit -m "feat: add project pinmap schema"
```

## Task 2: Extension Workspace Store

**Files:**
- Create: `src/extension/projectPinMapStore.ts`
- Create: `test/extension/projectPinMapStore.test.ts`

- [ ] **Step 1: Write failing store tests**

Create `test/extension/projectPinMapStore.test.ts`:

```typescript
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ProjectPinMapStore,
  type WorkspaceFolderLike
} from "../../src/extension/projectPinMapStore";

const workspaceFolder = (fsPath: string): WorkspaceFolderLike => ({
  uri: { fsPath },
  name: "firmware",
  index: 0
});

describe("ProjectPinMapStore", () => {
  let root: string;
  let nowValues: string[];
  let store: ProjectPinMapStore;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "mcupinmap-project-store-"));
    nowValues = [
      "2026-06-18T12:00:00.000Z",
      "2026-06-18T12:01:00.000Z",
      "2026-06-18T12:02:00.000Z",
      "2026-06-18T12:03:00.000Z"
    ];
    store = new ProjectPinMapStore(() => [workspaceFolder(root)], () => nowValues.shift() ?? "2026-06-18T12:09:00.000Z");
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("reports no-workspace when no folder is open", () => {
    const noWorkspaceStore = new ProjectPinMapStore(() => [], () => "2026-06-18T12:00:00.000Z");

    expect(noWorkspaceStore.listMaps()).toEqual({ kind: "no-workspace" });
  });

  it("creates the default project map on demand", () => {
    const result = store.createDefaultMap();

    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") {
      throw new Error("expected ready result");
    }
    expect(result.index.activeMapId).toBe("default");
    expect(result.activeMap?.id).toBe("default");
    expect(existsSync(join(root, ".pinmap", "index.json"))).toBe(true);
    expect(existsSync(join(root, ".pinmap", "maps", "default.json"))).toBe(true);
  });

  it("lists and loads maps from disk", () => {
    store.createDefaultMap();

    expect(store.listMaps()).toMatchObject({
      kind: "ready",
      index: {
        activeMapId: "default",
        maps: [{ id: "default", name: "Default" }]
      }
    });
    expect(store.loadMap("default")).toMatchObject({
      kind: "ready",
      activeMap: {
        id: "default",
        name: "Default"
      }
    });
  });

  it("saves a map and updates the index summary", () => {
    const created = store.createDefaultMap();
    if (created.kind !== "ready" || !created.activeMap) {
      throw new Error("expected default map");
    }

    const saved = store.saveMap({
      ...created.activeMap,
      chipId: "gd32f407",
      selectedPackageName: "LQFP100",
      assignments: [
        {
          id: "gd32f407:PA15:SPI0_NSS",
          chipId: "gd32f407",
          pinName: "PA15",
          functionRaw: "SPI0_NSS",
          af: "AF5",
          peripheral: "SPI0",
          signal: "NSS"
        }
      ]
    });

    expect(saved.kind).toBe("ready");
    if (saved.kind !== "ready" || !saved.activeMap) {
      throw new Error("expected saved map");
    }
    expect(saved.activeMap.updatedAt).toBe("2026-06-18T12:01:00.000Z");
    expect(saved.index.maps[0]).toMatchObject({
      id: "default",
      chipId: "gd32f407",
      updatedAt: "2026-06-18T12:01:00.000Z"
    });
  });

  it("duplicates and renames maps with unique ids", () => {
    store.createDefaultMap();

    const duplicated = store.duplicateMap("default", "Motor Control");
    expect(duplicated.kind).toBe("ready");
    if (duplicated.kind !== "ready" || !duplicated.activeMap) {
      throw new Error("expected duplicated map");
    }
    expect(duplicated.activeMap).toMatchObject({
      id: "motor-control",
      name: "Motor Control"
    });

    const renamed = store.renameMap("motor-control", "Motor Control Board");
    expect(renamed.kind).toBe("ready");
    if (renamed.kind !== "ready" || !renamed.activeMap) {
      throw new Error("expected renamed map");
    }
    expect(renamed.activeMap).toMatchObject({
      id: "motor-control",
      name: "Motor Control Board"
    });
  });

  it("preserves corrupted JSON by returning an error", () => {
    mkdirSync(join(root, ".pinmap"), { recursive: true });
    writeFileSync(join(root, ".pinmap", "index.json"), "{", "utf8");

    expect(store.listMaps()).toMatchObject({
      kind: "error",
      message: expect.stringContaining("Failed to read .pinmap/index.json")
    });
    expect(readFileSync(join(root, ".pinmap", "index.json"), "utf8")).toBe("{");
  });
});
```

- [ ] **Step 2: Run store tests and confirm failure**

Run:

```powershell
npx vitest run test/extension/projectPinMapStore.test.ts
```

Expected: FAIL because `src/extension/projectPinMapStore.ts` does not exist.

- [ ] **Step 3: Implement the store**

Create `src/extension/projectPinMapStore.ts`:

```typescript
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { join } from "node:path";
import {
  createDefaultProjectPinMap,
  createNextProjectPinMapId,
  createProjectPinMapDocument,
  parseProjectPinMapDocument,
  parseProjectPinMapIndex,
  summarizeProjectPinMap,
  type ProjectPinMapDocument,
  type ProjectPinMapIndex
} from "../shared/projectPinMapConfig";

export type WorkspaceFolderLike = {
  uri: { fsPath: string };
  name: string;
  index: number;
};

export type ProjectPinMapStoreResult =
  | { kind: "ready"; index: ProjectPinMapIndex; activeMap?: ProjectPinMapDocument }
  | { kind: "empty"; index?: ProjectPinMapIndex }
  | { kind: "no-workspace" }
  | { kind: "error"; message: string };

type NowProvider = () => string;
type WorkspaceFolderProvider = () => readonly WorkspaceFolderLike[] | undefined;

export class ProjectPinMapStore {
  public constructor(
    private readonly getWorkspaceFolders: WorkspaceFolderProvider,
    private readonly now: NowProvider = () => new Date().toISOString()
  ) {}

  public listMaps(): ProjectPinMapStoreResult {
    return this.withWorkspace((root) => {
      if (!existsSync(this.indexPath(root))) {
        return { kind: "empty" };
      }
      return { kind: "ready", index: this.readIndex(root) };
    });
  }

  public createDefaultMap(): ProjectPinMapStoreResult {
    return this.withWorkspace((root) => {
      const created = createDefaultProjectPinMap(this.now());
      this.ensureDirectories(root);
      this.writeIndex(root, created.index);
      this.writeMap(root, created.map);
      return { kind: "ready", index: created.index, activeMap: created.map };
    });
  }

  public loadMap(mapId?: string): ProjectPinMapStoreResult {
    return this.withWorkspace((root) => {
      if (!existsSync(this.indexPath(root))) {
        return { kind: "empty" };
      }

      const index = this.readIndex(root);
      const activeMapId = mapId ?? index.activeMapId ?? index.maps[0]?.id;
      if (!activeMapId) {
        return { kind: "ready", index };
      }

      const activeMap = this.readMap(root, activeMapId);
      return {
        kind: "ready",
        index: { ...index, activeMapId },
        activeMap
      };
    });
  }

  public saveMap(map: ProjectPinMapDocument): ProjectPinMapStoreResult {
    return this.withWorkspace((root) => {
      const index = existsSync(this.indexPath(root))
        ? this.readIndex(root)
        : { schemaVersion: 1 as const, activeMapId: map.id, maps: [] };
      const savedMap = { ...map, updatedAt: this.now() };
      const summary = summarizeProjectPinMap(savedMap);
      const nextMaps = index.maps.some((entry) => entry.id === savedMap.id)
        ? index.maps.map((entry) => (entry.id === savedMap.id ? summary : entry))
        : [...index.maps, summary];
      const nextIndex = {
        schemaVersion: 1 as const,
        activeMapId: savedMap.id,
        maps: nextMaps
      };

      this.ensureDirectories(root);
      this.writeMap(root, savedMap);
      this.writeIndex(root, nextIndex);

      return { kind: "ready", index: nextIndex, activeMap: savedMap };
    });
  }

  public duplicateMap(sourceMapId: string | undefined, name: string): ProjectPinMapStoreResult {
    return this.withWorkspace((root) => {
      const index = existsSync(this.indexPath(root))
        ? this.readIndex(root)
        : { schemaVersion: 1 as const, maps: [] };
      const sourceId = sourceMapId ?? index.activeMapId ?? index.maps[0]?.id;
      const source = sourceId && existsSync(this.mapPath(root, sourceId))
        ? this.readMap(root, sourceId)
        : undefined;
      const existingIds = new Set(index.maps.map((entry) => entry.id));
      const id = createNextProjectPinMapId(name, existingIds);
      const duplicated = {
        ...(source ?? createProjectPinMapDocument(id, name, this.now())),
        id,
        name,
        updatedAt: this.now()
      };
      const nextIndex = {
        schemaVersion: 1 as const,
        activeMapId: id,
        maps: [...index.maps, summarizeProjectPinMap(duplicated)]
      };

      this.ensureDirectories(root);
      this.writeMap(root, duplicated);
      this.writeIndex(root, nextIndex);
      return { kind: "ready", index: nextIndex, activeMap: duplicated };
    });
  }

  public renameMap(mapId: string, name: string): ProjectPinMapStoreResult {
    return this.withWorkspace((root) => {
      const map = this.readMap(root, mapId);
      return this.saveMap({ ...map, name });
    });
  }

  private withWorkspace(action: (root: string) => ProjectPinMapStoreResult): ProjectPinMapStoreResult {
    const root = this.getWorkspaceFolders()?.[0]?.uri.fsPath;
    if (!root) {
      return { kind: "no-workspace" };
    }

    try {
      return action(root);
    } catch (error) {
      return {
        kind: "error",
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private ensureDirectories(root: string): void {
    mkdirSync(this.mapsDirectory(root), { recursive: true });
  }

  private indexPath(root: string): string {
    return join(root, ".pinmap", "index.json");
  }

  private mapsDirectory(root: string): string {
    return join(root, ".pinmap", "maps");
  }

  private mapPath(root: string, mapId: string): string {
    return join(this.mapsDirectory(root), `${mapId}.json`);
  }

  private readIndex(root: string): ProjectPinMapIndex {
    try {
      return parseProjectPinMapIndex(JSON.parse(readFileSync(this.indexPath(root), "utf8")));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read .pinmap/index.json: ${message}`);
    }
  }

  private readMap(root: string, mapId: string): ProjectPinMapDocument {
    try {
      return parseProjectPinMapDocument(JSON.parse(readFileSync(this.mapPath(root, mapId), "utf8")));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read .pinmap/maps/${mapId}.json: ${message}`);
    }
  }

  private writeIndex(root: string, index: ProjectPinMapIndex): void {
    writeFileSync(this.indexPath(root), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  }

  private writeMap(root: string, map: ProjectPinMapDocument): void {
    writeFileSync(this.mapPath(root, map.id), `${JSON.stringify(map, null, 2)}\n`, "utf8");
  }
}
```

- [ ] **Step 4: Run store tests**

Run:

```powershell
npx vitest run test/extension/projectPinMapStore.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit store work**

Run:

```powershell
git status --short
git add -- src/extension/projectPinMapStore.ts test/extension/projectPinMapStore.test.ts
git commit -m "feat: persist project pinmap files"
```

## Task 3: Project Map Protocol and Webview Store State

**Files:**
- Modify: `src/shared/protocol.ts`
- Modify: `src/webview/state/usePinMapStore.ts`
- Modify: `src/webview/extensionMessages.ts`
- Modify: `test/webview/usePinMapStore.test.ts`
- Modify: `test/webview/appMessages.test.ts`

- [ ] **Step 1: Write failing webview state tests**

Append to `test/webview/usePinMapStore.test.ts`:

```typescript
describe("usePinMapStore project map state", () => {
  it("tracks the active project map and save status", () => {
    const store = usePinMapStore.getState();

    store.setProjectMap({
      id: "default",
      name: "Default",
      chipId: "gd32f407",
      updatedAt: "2026-06-18T12:00:00.000Z"
    });
    store.setProjectMapSaveStatus("saving");
    expect(usePinMapStore.getState().activeProjectMap).toEqual({
      id: "default",
      name: "Default",
      chipId: "gd32f407",
      updatedAt: "2026-06-18T12:00:00.000Z"
    });
    expect(usePinMapStore.getState().projectMapSaveStatus).toBe("saving");

    store.setProjectMapSaveStatus("saved");
    expect(usePinMapStore.getState().projectMapSaveStatus).toBe("saved");
  });
});
```

Append to `test/webview/appMessages.test.ts`:

```typescript
it("loads project map metadata and save status messages", () => {
  let error = "previous error";

  handleExtensionMessage(
    {
      type: "projectMapLoaded",
      map: {
        id: "default",
        name: "Default",
        chipId: "gd32f407",
        updatedAt: "2026-06-18T12:00:00.000Z"
      }
    },
    () => {
      error = "";
    },
    (message) => {
      error = message;
    }
  );

  expect(error).toBe("");
  expect(usePinMapStore.getState().activeProjectMap?.name).toBe("Default");
  expect(usePinMapStore.getState().projectMapSaveStatus).toBe("saved");

  handleExtensionMessage(
    { type: "projectMapSaveStarted" },
    () => undefined,
    (message) => {
      error = message;
    }
  );
  expect(usePinMapStore.getState().projectMapSaveStatus).toBe("saving");

  handleExtensionMessage(
    {
      type: "projectMapSaveFailed",
      message: "disk is read only"
    },
    () => undefined,
    (message) => {
      error = message;
    }
  );
  expect(error).toBe("disk is read only");
  expect(usePinMapStore.getState().projectMapSaveStatus).toBe("failed");
});
```

- [ ] **Step 2: Run webview tests and confirm failure**

Run:

```powershell
npx vitest run test/webview/usePinMapStore.test.ts test/webview/appMessages.test.ts
```

Expected: FAIL because protocol/store fields do not exist.

- [ ] **Step 3: Extend protocol types**

Modify `src/shared/protocol.ts`:

```typescript
import type {
  Assignment,
  Chip,
  ChipSummary,
  Conflict
} from "./types";
import type { RemoteChipSummary } from "./data/remoteChipIndex";
import type {
  ProjectPinMapDocument,
  ProjectPinMapSummary
} from "./projectPinMapConfig";

export type ExtensionToWebviewMessage =
  | { type: "chipsLoaded"; chips: ChipSummary[]; selectedChipId?: string }
  | { type: "remoteChipSearchResults"; query: string; chips: RemoteChipSummary[] }
  | { type: "chipDownloadStarted"; chipId: string }
  | { type: "chipDownloadCompleted"; chip: ChipSummary }
  | { type: "chipImportCancelled" }
  | { type: "chipImportCompleted"; chip: ChipSummary }
  | { type: "installedChipsLoaded"; chips: ChipSummary[]; selectedChipId?: string }
  | { type: "projectMapsLoaded"; maps: ProjectPinMapSummary[]; activeMapId?: string }
  | { type: "projectMapLoaded"; map: ProjectPinMapSummary }
  | { type: "projectMapSaveStarted" }
  | { type: "projectMapSaved"; map: ProjectPinMapSummary }
  | { type: "projectMapSaveFailed"; message: string }
  | { type: "chipLoaded"; chip: Chip; assignments: Assignment[]; conflicts: Conflict[] }
  | { type: "assignmentsUpdated"; assignments: Assignment[]; conflicts: Conflict[] }
  | { type: "error"; message: string };

export type WebviewToExtensionMessage =
  | { type: "ready" }
  | { type: "selectProjectMap"; mapId: string }
  | { type: "createProjectMap"; name: string }
  | { type: "duplicateProjectMap"; sourceMapId?: string; name: string }
  | { type: "renameProjectMap"; mapId: string; name: string }
  | { type: "saveProjectMap"; map: ProjectPinMapDocument }
  | { type: "selectChip"; chipId: string }
  | { type: "searchRemoteChips"; query: string }
  | { type: "downloadRemoteChip"; chipId: string }
  | { type: "importLocalCsv" }
  | { type: "refreshInstalledChips" }
  | { type: "removeInstalledChip"; chipId: string }
  | { type: "assignFunction"; assignment: Assignment }
  | { type: "removeAssignment"; assignmentId: string }
  | { type: "export"; format: "json" | "markdown" };
```

- [ ] **Step 4: Extend Zustand store**

Modify `src/webview/state/usePinMapStore.ts`:

```typescript
import type {
  ProjectPinMapSummary
} from "../../shared/projectPinMapConfig";
```

Add types and fields:

```typescript
export type ProjectMapSaveStatus = "idle" | "saving" | "saved" | "failed";

type PinMapState = {
  // existing fields
  projectMaps: ProjectPinMapSummary[];
  activeProjectMap?: ProjectPinMapSummary;
  projectMapSaveStatus: ProjectMapSaveStatus;
  setProjectMaps: (maps: ProjectPinMapSummary[], activeMapId?: string) => void;
  setProjectMap: (map: ProjectPinMapSummary) => void;
  setProjectMapSaveStatus: (status: ProjectMapSaveStatus) => void;
  // existing actions
};
```

Add initial state and actions:

```typescript
projectMaps: [],
projectMapSaveStatus: "idle",
setProjectMaps: (projectMaps, activeMapId) =>
  set((state) => ({
    projectMaps,
    activeProjectMap:
      projectMaps.find((map) => map.id === activeMapId) ??
      (state.activeProjectMap && projectMaps.find((map) => map.id === state.activeProjectMap?.id)) ??
      projectMaps[0]
  })),
setProjectMap: (activeProjectMap) =>
  set((state) => ({
    activeProjectMap,
    projectMaps: state.projectMaps.some((map) => map.id === activeProjectMap.id)
      ? state.projectMaps.map((map) => (map.id === activeProjectMap.id ? activeProjectMap : map))
      : [...state.projectMaps, activeProjectMap]
  })),
setProjectMapSaveStatus: (projectMapSaveStatus) => set({ projectMapSaveStatus }),
```

- [ ] **Step 5: Handle project map messages**

Modify `src/webview/extensionMessages.ts`:

```typescript
case "projectMapsLoaded":
  store.setProjectMaps(message.maps, message.activeMapId);
  clearError();
  break;

case "projectMapLoaded":
  store.setProjectMap(message.map);
  store.setProjectMapSaveStatus("saved");
  clearError();
  break;

case "projectMapSaveStarted":
  store.setProjectMapSaveStatus("saving");
  break;

case "projectMapSaved":
  store.setProjectMap(message.map);
  store.setProjectMapSaveStatus("saved");
  clearError();
  break;

case "projectMapSaveFailed":
  store.setProjectMapSaveStatus("failed");
  setError(message.message);
  break;
```

- [ ] **Step 6: Run targeted tests**

Run:

```powershell
npx vitest run test/webview/usePinMapStore.test.ts test/webview/appMessages.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit protocol/store work**

Run:

```powershell
git status --short
git add -- src/shared/protocol.ts src/webview/state/usePinMapStore.ts src/webview/extensionMessages.ts test/webview/usePinMapStore.test.ts test/webview/appMessages.test.ts
git commit -m "feat: track project pinmap state"
```

## Task 4: Wire Project Store into Extension Host

**Files:**
- Modify: `src/extension/extension.ts`
- Modify: `src/extension/webviewPanel.ts`
- Modify: `test/extension/sidebarContribution.test.ts` only if TypeScript compile exposes signature expectations in tests

- [ ] **Step 1: Add compile-level failing references**

Modify `src/extension/extension.ts` to instantiate the store and pass it through:

```typescript
import * as vscode from "vscode";
import { ChipRepository } from "./chipRepository";
import { ProjectPinMapStore } from "./projectPinMapStore";
import { openPinMapPanel, PinMapViewProvider } from "./webviewPanel";

export function activate(context: vscode.ExtensionContext): void {
  const chipRepository = new ChipRepository(context);
  const projectPinMapStore = new ProjectPinMapStore(() => vscode.workspace.workspaceFolders);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      PinMapViewProvider.viewType,
      new PinMapViewProvider(context, chipRepository, projectPinMapStore)
    ),
    vscode.commands.registerCommand("mcupinmap.openPinMap", () => {
      openPinMapPanel(context, chipRepository, projectPinMapStore);
    })
  );
}
```

- [ ] **Step 2: Run extension typecheck and confirm failure**

Run:

```powershell
npm run build:extension
```

Expected: FAIL because `openPinMapPanel` and `PinMapViewProvider` signatures still accept only `context` and `chipRepository`.

- [ ] **Step 3: Update panel signatures**

Modify `src/extension/webviewPanel.ts` imports and public signatures:

```typescript
import { ProjectPinMapStore, type ProjectPinMapStoreResult } from "./projectPinMapStore";
import type { ProjectPinMapDocument } from "../shared/projectPinMapConfig";
```

Change signatures:

```typescript
type OpenPinMapPanelOptions = {
  mapId?: string;
};

export const openPinMapPanel = (
  context: vscode.ExtensionContext,
  chipRepository: ChipRepository,
  projectPinMapStore: ProjectPinMapStore,
  options: OpenPinMapPanelOptions = {}
): void => {
  if (currentPinMapPanel) {
    currentPinMapPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  // keep existing createWebviewPanel body
  initializePinMapWebview(panel.webview, context, chipRepository, projectPinMapStore, options);
};

export class PinMapViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "mcupinmap.pinMapView";

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly chipRepository: ChipRepository,
    private readonly projectPinMapStore: ProjectPinMapStore
  ) {}
}
```

Update initializer signature:

```typescript
const initializePinMapWebview = (
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  chipRepository: ChipRepository,
  projectPinMapStore: ProjectPinMapStore,
  options: OpenPinMapPanelOptions
): void => {
```

- [ ] **Step 4: Add project map load helpers**

Inside `initializePinMapWebview`, replace the `workspaceState` assignment initialization:

```typescript
let installedChips = chipRepository.listChips();
let selectedChipId: string | undefined = installedChips[0]?.id;
let activeProjectMap: ProjectPinMapDocument | undefined;
let assignments: Assignment[] = [];
```

Add helpers:

```typescript
const postProjectStoreError = (result: ProjectPinMapStoreResult): boolean => {
  if (result.kind === "no-workspace") {
    postMessage({ type: "error", message: "Open a workspace folder before using project Pin Map files." });
    return true;
  }
  if (result.kind === "error") {
    postMessage({ type: "error", message: result.message });
    return true;
  }
  return false;
};

const postProjectMapsLoaded = (result: ProjectPinMapStoreResult): void => {
  if (result.kind === "ready") {
    postMessage({
      type: "projectMapsLoaded",
      maps: result.index.maps,
      activeMapId: result.index.activeMapId
    });
  }
};

const activateProjectMap = (map: ProjectPinMapDocument): void => {
  activeProjectMap = map;
  selectedChipId = map.chipId;
  assignments = map.assignments;
  postMessage({ type: "projectMapLoaded", map: summarizeProjectPinMap(map) });
};
```

Import `summarizeProjectPinMap` from `../shared/projectPinMapConfig`.

- [ ] **Step 5: Load project maps on ready**

In the `"ready"` case, use this sequence:

```typescript
case "ready": {
  refreshInstalledChips();
  const projectResult = projectPinMapStore.loadMap(options.mapId);
  if (postProjectStoreError(projectResult)) {
    postMessage({ type: "chipsLoaded", chips: installedChips, selectedChipId });
    postInstalledChipsLoaded();
    break;
  }
  if (projectResult.kind === "empty") {
    postMessage({ type: "chipsLoaded", chips: installedChips, selectedChipId });
    postInstalledChipsLoaded();
    postChipLoaded();
    break;
  }
  postProjectMapsLoaded(projectResult);
  if (projectResult.kind === "ready" && projectResult.activeMap) {
    activateProjectMap(projectResult.activeMap);
  }
  postMessage({ type: "chipsLoaded", chips: installedChips, selectedChipId });
  postInstalledChipsLoaded();
  postChipLoaded();
  break;
}
```

- [ ] **Step 6: Save project map after state-changing messages**

Add helper:

```typescript
const saveActiveProjectMap = async (patch: Partial<ProjectPinMapDocument>): Promise<void> => {
  if (!activeProjectMap) {
    return;
  }
  postMessage({ type: "projectMapSaveStarted" });
  const nextMap: ProjectPinMapDocument = {
    ...activeProjectMap,
    ...patch,
    chipId: selectedChipId,
    assignments: selectedChipId ? assignments.filter((assignment) => assignment.chipId === selectedChipId) : []
  };
  const result = projectPinMapStore.saveMap(nextMap);
  if (result.kind === "ready" && result.activeMap) {
    activateProjectMap(result.activeMap);
    postMessage({ type: "projectMapSaved", map: summarizeProjectPinMap(result.activeMap) });
    postProjectMapsLoaded(result);
    return;
  }
  postMessage({
    type: "projectMapSaveFailed",
    message:
      result.kind === "error"
        ? result.message
        : "Unable to save the active project Pin Map."
  });
};
```

After `selectedChipId = message.chipId` in `"selectChip"`, call:

```typescript
await saveActiveProjectMap({ chipId: selectedChipId });
```

After assignment persistence in `"assignFunction"` and `"removeAssignment"`, replace `await persistAssignments(nextAssignments)` with:

```typescript
assignments = nextAssignments;
await saveActiveProjectMap({ assignments: getSelectedAssignments() });
```

Keep `postAssignmentsUpdated()` after save succeeds. If save fails, still post the save failure message and keep in-memory assignments.

- [ ] **Step 7: Handle create/duplicate/rename/select map messages**

Add switch cases:

```typescript
case "selectProjectMap": {
  const result = projectPinMapStore.loadMap(message.mapId);
  if (postProjectStoreError(result)) {
    break;
  }
  postProjectMapsLoaded(result);
  if (result.kind === "ready" && result.activeMap) {
    activateProjectMap(result.activeMap);
    postChipLoaded();
  }
  break;
}

case "createProjectMap":
case "duplicateProjectMap": {
  const result =
    message.type === "createProjectMap"
      ? projectPinMapStore.duplicateMap(undefined, message.name)
      : projectPinMapStore.duplicateMap(message.sourceMapId ?? activeProjectMap?.id, message.name);
  if (postProjectStoreError(result)) {
    break;
  }
  postProjectMapsLoaded(result);
  if (result.kind === "ready" && result.activeMap) {
    activateProjectMap(result.activeMap);
    postChipLoaded();
  }
  break;
}

case "renameProjectMap": {
  const result = projectPinMapStore.renameMap(message.mapId, message.name);
  if (postProjectStoreError(result)) {
    break;
  }
  postProjectMapsLoaded(result);
  if (result.kind === "ready" && result.activeMap) {
    activateProjectMap(result.activeMap);
    postMessage({ type: "projectMapSaved", map: summarizeProjectPinMap(result.activeMap) });
  }
  break;
}

case "saveProjectMap": {
  activeProjectMap = message.map;
  await saveActiveProjectMap(message.map);
  break;
}
```

- [ ] **Step 8: Run extension build**

Run:

```powershell
npm run build:extension
```

Expected: PASS.

- [ ] **Step 9: Commit extension host wiring**

Run:

```powershell
git status --short
git add -- src/extension/extension.ts src/extension/webviewPanel.ts
git commit -m "feat: load and save project pinmaps"
```

## Task 5: Sidebar Project Map Launcher

**Files:**
- Modify: `src/extension/sidebarLauncher.ts`
- Modify: `src/extension/webviewPanel.ts`
- Modify: `test/extension/sidebarLauncher.test.ts`

- [ ] **Step 1: Write failing sidebar tests**

Replace `test/extension/sidebarLauncher.test.ts` with:

```typescript
import { describe, expect, it } from "vitest";
import { renderPinMapLauncherHtml } from "../../src/extension/sidebarLauncher";

describe("renderPinMapLauncherHtml", () => {
  it("renders a no-workspace state", () => {
    const html = renderPinMapLauncherHtml("abc123", { kind: "no-workspace" });

    expect(html).toContain("Open a workspace folder");
    expect(html).toContain("nonce=\"abc123\"");
    expect(html).not.toContain("dist/webview/assets/main.js");
  });

  it("renders create action when no .pinmap exists", () => {
    const html = renderPinMapLauncherHtml("abc123", { kind: "empty" });

    expect(html).toContain("Create Default Map");
    expect(html).toContain("createDefaultMap");
  });

  it("renders project maps and posts map ids", () => {
    const html = renderPinMapLauncherHtml("abc123", {
      kind: "ready",
      activeMapId: "default",
      maps: [
        {
          id: "default",
          name: "Default",
          chipId: "gd32f407",
          updatedAt: "2026-06-18T12:00:00.000Z"
        }
      ]
    });

    expect(html).toContain("Default");
    expect(html).toContain("gd32f407");
    expect(html).toContain("openProjectMap");
    expect(html).toContain("default");
    expect(html).toContain("New Map");
  });
});
```

- [ ] **Step 2: Run sidebar tests and confirm failure**

Run:

```powershell
npx vitest run test/extension/sidebarLauncher.test.ts
```

Expected: FAIL because `renderPinMapLauncherHtml` still takes only a nonce.

- [ ] **Step 3: Replace sidebar renderer**

Modify `src/extension/sidebarLauncher.ts`:

```typescript
import type { ProjectPinMapSummary } from "../shared/projectPinMapConfig";

export type PinMapLauncherState =
  | { kind: "no-workspace" }
  | { kind: "error"; message: string }
  | { kind: "empty" }
  | { kind: "ready"; maps: ProjectPinMapSummary[]; activeMapId?: string };

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const renderBody = (state: PinMapLauncherState): string => {
  if (state.kind === "no-workspace") {
    return `<p>Open a workspace folder to use project Pin Map files.</p>`;
  }
  if (state.kind === "error") {
    return `<p class="error">${escapeHtml(state.message)}</p>`;
  }
  if (state.kind === "empty") {
    return `<p>No project Pin Map folder exists yet.</p><button type="button" data-action="createDefaultMap">Create Default Map</button>`;
  }

  return `
    <div class="map-list">
      ${state.maps
        .map(
          (map) => `
            <button type="button" class="map-row${map.id === state.activeMapId ? " is-active" : ""}" data-action="openProjectMap" data-map-id="${escapeHtml(map.id)}">
              <span>${escapeHtml(map.name)}</span>
              <small>${escapeHtml(map.chipId ?? "No chip selected")} / ${escapeHtml(map.updatedAt)}</small>
            </button>
          `
        )
        .join("")}
    </div>
    <button type="button" data-action="newProjectMap">New Map</button>
  `;
};

export const renderPinMapLauncherHtml = (nonce: string, state: PinMapLauncherState): string => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
    <title>McuPinMap</title>
    <style>
      body { box-sizing: border-box; margin: 0; padding: 12px; color: var(--vscode-foreground); background: var(--vscode-sideBar-background); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); }
      .container { display: flex; min-height: calc(100vh - 24px); flex-direction: column; gap: 10px; }
      h1 { margin: 0; font-size: 15px; font-weight: 600; }
      p { margin: 0; color: var(--vscode-descriptionForeground); line-height: 1.45; }
      button { width: 100%; border: 0; border-radius: 2px; padding: 8px 10px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); cursor: pointer; font: inherit; text-align: left; }
      button:hover { background: var(--vscode-button-hoverBackground); }
      .map-list { display: flex; flex-direction: column; gap: 6px; }
      .map-row { display: flex; flex-direction: column; gap: 3px; color: var(--vscode-foreground); background: var(--vscode-list-inactiveSelectionBackground); }
      .map-row.is-active { outline: 1px solid var(--vscode-focusBorder); }
      small { color: var(--vscode-descriptionForeground); overflow-wrap: anywhere; }
      .error { color: var(--vscode-errorForeground); }
    </style>
  </head>
  <body>
    <main class="container">
      <h1>McuPinMap</h1>
      ${renderBody(state)}
    </main>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      document.querySelectorAll("[data-action]").forEach((element) => {
        element.addEventListener("click", () => {
          const action = element.getAttribute("data-action");
          const mapId = element.getAttribute("data-map-id");
          vscode.postMessage({ type: action, mapId });
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

- [ ] **Step 4: Wire sidebar provider to store**

Modify `src/extension/webviewPanel.ts` `resolveWebviewView`:

```typescript
const toLauncherState = (result: ProjectPinMapStoreResult): PinMapLauncherState => {
  if (result.kind === "ready") {
    return {
      kind: "ready",
      maps: result.index.maps,
      activeMapId: result.index.activeMapId
    };
  }
  if (result.kind === "empty") {
    return { kind: "empty" };
  }
  if (result.kind === "no-workspace") {
    return { kind: "no-workspace" };
  }
  return { kind: "error", message: result.message };
};
```

Import `PinMapLauncherState`:

```typescript
import { getNonce, renderPinMapLauncherHtml, type PinMapLauncherState } from "./sidebarLauncher";
```

Use store state:

```typescript
webviewView.webview.html = renderPinMapLauncherHtml(
  getNonce(),
  toLauncherState(this.projectPinMapStore.listMaps())
);
```

Handle sidebar messages:

```typescript
(message: { type?: string; mapId?: string }) => {
  if (message.type === "openProjectMap" && message.mapId) {
    openPinMapPanel(this.context, this.chipRepository, this.projectPinMapStore, { mapId: message.mapId });
  }
  if (message.type === "createDefaultMap") {
    const result = this.projectPinMapStore.createDefaultMap();
    if (result.kind === "ready" && result.activeMap) {
      openPinMapPanel(this.context, this.chipRepository, this.projectPinMapStore, { mapId: result.activeMap.id });
    }
    webviewView.webview.html = renderPinMapLauncherHtml(getNonce(), toLauncherState(this.projectPinMapStore.listMaps()));
  }
  if (message.type === "newProjectMap") {
    const result = this.projectPinMapStore.duplicateMap(undefined, "New Map");
    if (result.kind === "ready" && result.activeMap) {
      openPinMapPanel(this.context, this.chipRepository, this.projectPinMapStore, { mapId: result.activeMap.id });
    }
    webviewView.webview.html = renderPinMapLauncherHtml(getNonce(), toLauncherState(this.projectPinMapStore.listMaps()));
  }
}
```

- [ ] **Step 5: Run tests and extension build**

Run:

```powershell
npx vitest run test/extension/sidebarLauncher.test.ts test/extension/projectPinMapStore.test.ts
npm run build:extension
```

Expected: PASS.

- [ ] **Step 6: Commit sidebar launcher**

Run:

```powershell
git status --short
git add -- src/extension/sidebarLauncher.ts src/extension/webviewPanel.ts test/extension/sidebarLauncher.test.ts
git commit -m "feat: list project pinmaps in sidebar"
```

## Task 6: Webview Map Controls and Auto-Save Messages

**Files:**
- Modify: `src/webview/App.tsx`
- Modify: `src/webview/components/Shell.tsx`
- Modify: `src/webview/components/ChipSelector.tsx`
- Modify: `src/webview/components/PackageMap.tsx`
- Modify: `src/webview/components/AssignmentPanel.tsx`
- Modify: `src/webview/state/usePinMapStore.ts`
- Modify: webview CSS file used by current app styles
- Modify: `test/webview/appMessages.test.ts`
- Modify: `test/webview/usePinMapStore.test.ts`

- [ ] **Step 1: Add helper to build save payload**

In `src/webview/state/usePinMapStore.ts`, add:

```typescript
createProjectMapDocument: () => ProjectPinMapDocument | undefined;
```

Implementation:

```typescript
createProjectMapDocument: () => {
  const state = get();
  if (!state.activeProjectMap) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    id: state.activeProjectMap.id,
    name: state.activeProjectMap.name,
    chipId: state.selectedChipId,
    selectedPackageName: state.selectedPackageName,
    mapView: state.mapView,
    assignments: state.assignments,
    updatedAt: state.activeProjectMap.updatedAt
  };
}
```

- [ ] **Step 2: Add failing save payload test**

Append to `test/webview/usePinMapStore.test.ts`:

```typescript
it("creates a project map document from current workspace state", () => {
  const store = usePinMapStore.getState();

  store.setProjectMap({
    id: "default",
    name: "Default",
    chipId: "gd32f407",
    updatedAt: "2026-06-18T12:00:00.000Z"
  });
  store.setChips([{ id: "gd32f407", displayName: "GD32F407", vendor: "GigaDevice", family: "GD32F4" }], "gd32f407");
  store.setChip(createChip([lqfp100]));
  store.setAssignments(
    [
      {
        id: "gd32f407:PA0:USART1_CTS",
        chipId: "gd32f407",
        pinName: "PA0",
        functionRaw: "USART1_CTS",
        af: "AF7",
        peripheral: "USART1",
        signal: "CTS"
      }
    ],
    []
  );

  expect(store.createProjectMapDocument()).toEqual({
    schemaVersion: 1,
    id: "default",
    name: "Default",
    chipId: "gd32f407",
    selectedPackageName: "LQFP100",
    mapView: "package",
    assignments: [
      {
        id: "gd32f407:PA0:USART1_CTS",
        chipId: "gd32f407",
        pinName: "PA0",
        functionRaw: "USART1_CTS",
        af: "AF7",
        peripheral: "USART1",
        signal: "CTS"
      }
    ],
    updatedAt: "2026-06-18T12:00:00.000Z"
  });
});
```

- [ ] **Step 3: Run targeted test and confirm failure**

Run:

```powershell
npx vitest run test/webview/usePinMapStore.test.ts
```

Expected: FAIL until `createProjectMapDocument` is implemented.

- [ ] **Step 4: Implement save trigger helper**

Create a local helper in components that need auto-save:

```typescript
const postProjectMapSave = (): void => {
  const map = usePinMapStore.getState().createProjectMapDocument();
  if (map) {
    vscode.postMessage({ type: "saveProjectMap", map });
  }
};
```

Use it after state changes that are handled inside webview. For changes sent to extension first, such as `selectChip`, `assignFunction`, and `removeAssignment`, rely on the extension host switch cases from Task 4 to save after applying the change.

- [ ] **Step 5: Update package/view controls**

Find current package/view control code in `src/webview/components/PackageMap.tsx` and call `postProjectMapSave()` after `setMapView` or `setSelectedPackageName` actions. Keep the existing behavior intact.

Expected pattern:

```tsx
onClick={() => {
  usePinMapStore.getState().setMapView("logical");
  postProjectMapSave();
}}
```

For package select:

```tsx
onChange={(event) => {
  usePinMapStore.getState().setSelectedPackageName(event.target.value);
  postProjectMapSave();
}}
```

- [ ] **Step 6: Add map header controls**

Modify `src/webview/components/Shell.tsx` props:

```typescript
type ShellProps = PropsWithChildren<{
  sidebar: JSX.Element;
  detail: JSX.Element;
  error?: string;
  projectMapHeader?: JSX.Element;
}>;
```

Render inside `.workspace-header-actions` before reset layout:

```tsx
{projectMapHeader}
```

In `src/webview/App.tsx`, derive map state and render controls:

```tsx
const activeProjectMap = usePinMapStore((state) => state.activeProjectMap);
const projectMapSaveStatus = usePinMapStore((state) => state.projectMapSaveStatus);

const projectMapHeader = activeProjectMap ? (
  <div className="project-map-header" aria-label="Project map">
    <span>{activeProjectMap.name}</span>
    <small>{projectMapSaveStatus}</small>
    <button
      type="button"
      className="secondary-action"
      onClick={() => {
        const name = window.prompt("Rename project map", activeProjectMap.name);
        if (name?.trim()) {
          vscode.postMessage({ type: "renameProjectMap", mapId: activeProjectMap.id, name: name.trim() });
        }
      }}
    >
      Rename
    </button>
    <button
      type="button"
      className="secondary-action"
      onClick={() => {
        const name = window.prompt("Duplicate project map as", `${activeProjectMap.name} Copy`);
        if (name?.trim()) {
          vscode.postMessage({ type: "duplicateProjectMap", sourceMapId: activeProjectMap.id, name: name.trim() });
        }
      }}
    >
      Duplicate
    </button>
    <button
      type="button"
      className="secondary-action"
      onClick={() => {
        const name = window.prompt("New project map name", "New Map");
        if (name?.trim()) {
          vscode.postMessage({ type: "createProjectMap", name: name.trim() });
        }
      }}
    >
      New
    </button>
  </div>
) : null;
```

Pass it to `Shell`:

```tsx
<Shell error={error} projectMapHeader={projectMapHeader} sidebar={...} detail={...}>
```

- [ ] **Step 7: Add compact styles**

Modify the current webview CSS file used by the app with:

```css
.project-map-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.project-map-header span {
  font-weight: 600;
}

.project-map-header small {
  color: var(--vscode-descriptionForeground);
}
```

- [ ] **Step 8: Run webview tests and build**

Run:

```powershell
npx vitest run test/webview/usePinMapStore.test.ts test/webview/appMessages.test.ts
npm run build:webview
```

Expected: PASS.

- [ ] **Step 9: Commit webview controls**

Run:

```powershell
git status --short
git add -- src/webview test/webview
git commit -m "feat: add project pinmap webview controls"
```

## Task 7: End-to-End Verification and Cleanup

**Files:**
- Inspect: all changed files
- No planned new files

- [ ] **Step 1: Run all tests**

Run:

```powershell
npm test
```

Expected: PASS for all Vitest files.

- [ ] **Step 2: Run full build**

Run:

```powershell
npm run build
```

Expected: PASS. This validates legacy fixture data plus extension and webview builds.

- [ ] **Step 3: Inspect git status**

Run:

```powershell
git status --short
```

Expected: clean, or only intentional task files before the final commit.

- [ ] **Step 4: Manual VS Code smoke test**

Run the existing extension debug flow:

1. Open `D:\WorkSpace\Vibe_Projects\McuPinFunc` in VS Code.
2. Select `Run Extension and Open Pin Map`.
3. Press `F5`.
4. In the Extension Development Host, open a folder workspace that can contain `.pinmap`.
5. Open the McuPinMap activity bar view.
6. Click `Create Default Map`.
7. Confirm `.pinmap/index.json` and `.pinmap/maps/default.json` appear in that workspace.
8. Select a chip, select a package, assign a function, close and reopen the panel from the sidebar.
9. Confirm the same map, chip, package, and assignments restore.
10. Duplicate the map, rename it, and confirm both maps are listed in the sidebar.

- [ ] **Step 5: Final commit if cleanup changes were made**

If Step 1-4 required fixes, commit them:

```powershell
git status --short
git add -- <only-the-files-fixed-in-this-task>
git commit -m "fix: stabilize project pinmap workflow"
```

If no fixes were required, do not create an empty commit.

## Self-Review Notes

- Spec coverage:
  - `.pinmap` index/map schema: Task 1.
  - workspace filesystem store: Task 2.
  - multiple maps and active map id: Tasks 1, 2, 5, 6.
  - sidebar launcher list and create flow: Task 5.
  - panel load/save and chip repository boundary: Task 4.
  - auto-save and map controls: Task 6.
  - no chip JSON copying: Task 1 schema and Task 4 store usage keep only chip id/state.
  - no automatic old `workspaceState` migration: Task 4 removes new writes to that path and leaves old state untouched.
  - tests and verification: each task has targeted Vitest commands, Task 7 has `npm test` and `npm run build`.
- Type consistency:
  - `ProjectPinMapSummary`, `ProjectPinMapIndex`, and `ProjectPinMapDocument` originate in Task 1 and are reused by later tasks.
  - Message names in Task 3 are the same names used by Tasks 4 and 6.
  - Store result names in Task 2 are the same names used by Task 5 sidebar rendering.
