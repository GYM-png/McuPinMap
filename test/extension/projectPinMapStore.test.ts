import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectPinMapStore, type WorkspaceFolderLike } from "../../src/extension/projectPinMapStore";
import type { ProjectPinMapDocument } from "../../src/shared/projectPinMapConfig";

const createdRoots: string[] = [];

const firstNow = "2026-06-18T12:00:00.000Z";
const secondNow = "2026-06-18T12:05:00.000Z";
const thirdNow = "2026-06-18T12:10:00.000Z";

const createRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "mcupinmap-store-"));
  createdRoots.push(root);
  return root;
};

const createStore = (
  root: string,
  timestamps: string[] = [firstNow]
): ProjectPinMapStore => {
  let index = 0;
  const folder: WorkspaceFolderLike = {
    uri: { fsPath: root },
    name: "Workspace",
    index: 0
  };

  return new ProjectPinMapStore(
    () => [folder],
    () => timestamps[Math.min(index++, timestamps.length - 1)]
  );
};

const readJson = (root: string, relativePath: string): unknown =>
  JSON.parse(readFileSync(join(root, relativePath), "utf8"));

const writeJson = (root: string, relativePath: string, value: unknown): void => {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

afterEach(() => {
  for (const root of createdRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("ProjectPinMapStore", () => {
  it("returns no-workspace when no workspace folder is available", async () => {
    const store = new ProjectPinMapStore(() => []);

    await expect(store.listMaps()).resolves.toEqual({ kind: "no-workspace" });
  });

  it("creates default index and map files", async () => {
    const root = createRoot();
    const store = createStore(root);

    const result = await store.createDefaultMap();

    expect(result).toEqual({
      kind: "ready",
      index: {
        schemaVersion: 1,
        activeMapId: "default",
        maps: [{ id: "default", name: "Default", updatedAt: firstNow }]
      },
      activeMap: {
        schemaVersion: 1,
        id: "default",
        name: "Default",
        mapView: "package",
        assignments: [],
        updatedAt: firstNow
      }
    });
    expect(readJson(root, ".pinmap/index.json")).toEqual(
      result.kind === "ready" ? result.index : undefined
    );
    expect(readJson(root, ".pinmap/maps/default.json")).toEqual(
      result.kind === "ready" ? result.activeMap : undefined
    );
  });

  it("lists and loads maps from disk", async () => {
    const root = createRoot();
    const store = createStore(root);

    await store.createDefaultMap();

    await expect(store.listMaps()).resolves.toMatchObject({
      kind: "ready",
      index: { activeMapId: "default", maps: [{ id: "default", name: "Default" }] }
    });
    await expect(store.loadMap()).resolves.toMatchObject({
      kind: "ready",
      index: { activeMapId: "default" },
      activeMap: { id: "default", name: "Default" }
    });
  });

  it("saves maps with a fresh timestamp and updates the index summary", async () => {
    const root = createRoot();
    const store = createStore(root, [firstNow, secondNow]);
    const savedMap: ProjectPinMapDocument = {
      schemaVersion: 1,
      id: "motor-control",
      name: "Motor Control",
      chipId: "gd32f407",
      selectedPackageName: "LQFP100",
      mapView: "logical",
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
      ],
      updatedAt: firstNow
    };

    const result = await store.saveMap(savedMap);

    expect(result).toMatchObject({
      kind: "ready",
      index: {
        activeMapId: "motor-control",
        maps: [
          {
            id: "motor-control",
            name: "Motor Control",
            chipId: "gd32f407",
            updatedAt: firstNow
          }
        ]
      },
      activeMap: { id: "motor-control", updatedAt: firstNow }
    });
    expect(readJson(root, ".pinmap/maps/motor-control.json")).toMatchObject({
      id: "motor-control",
      updatedAt: firstNow
    });

    const updated = await store.saveMap({ ...savedMap, name: "Motor Control Rev B" });

    expect(updated).toMatchObject({
      kind: "ready",
      index: {
        activeMapId: "motor-control",
        maps: [
          {
            id: "motor-control",
            name: "Motor Control Rev B",
            chipId: "gd32f407",
            updatedAt: secondNow
          }
        ]
      },
      activeMap: { id: "motor-control", name: "Motor Control Rev B", updatedAt: secondNow }
    });
  });

  it("duplicates and renames maps with unique ids", async () => {
    const root = createRoot();
    const store = createStore(root, [firstNow, secondNow, thirdNow]);

    await store.createDefaultMap();
    const duplicated = await store.duplicateMap("default", "Default");

    expect(duplicated).toMatchObject({
      kind: "ready",
      index: {
        activeMapId: "default-2",
        maps: [
          { id: "default", name: "Default" },
          { id: "default-2", name: "Default", updatedAt: secondNow }
        ]
      },
      activeMap: { id: "default-2", name: "Default", updatedAt: secondNow }
    });

    const renamed = await store.renameMap("default-2", "Board Bringup");

    expect(renamed).toMatchObject({
      kind: "ready",
      index: {
        activeMapId: "default-2",
        maps: [
          { id: "default", name: "Default" },
          { id: "default-2", name: "Board Bringup", updatedAt: thirdNow }
        ]
      },
      activeMap: { id: "default-2", name: "Board Bringup", updatedAt: thirdNow }
    });
  });

  it("returns an error for corrupted indexes and preserves the damaged file", async () => {
    const root = createRoot();
    const store = createStore(root);
    const indexPath = join(root, ".pinmap", "index.json");

    await store.createDefaultMap();
    rmSync(indexPath);
    const damaged = "{ not json";
    await import("node:fs/promises").then((fs) => fs.writeFile(indexPath, damaged, "utf8"));

    const result = await store.listMaps();

    expect(result).toMatchObject({
      kind: "error",
      message: expect.stringContaining("Failed to read .pinmap/index.json")
    });
    expect(readFileSync(indexPath, "utf8")).toBe(damaged);
  });

  it("duplicates to an empty New Map when no existing .pinmap is present", async () => {
    const root = createRoot();
    const store = createStore(root);

    const result = await store.duplicateMap("missing", "New Map");

    expect(result).toMatchObject({
      kind: "ready",
      index: {
        activeMapId: "new-map",
        maps: [{ id: "new-map", name: "New Map", updatedAt: firstNow }]
      },
      activeMap: {
        id: "new-map",
        name: "New Map",
        mapView: "package",
        assignments: [],
        updatedAt: firstNow
      }
    });
    expect(existsSync(join(root, ".pinmap/index.json"))).toBe(true);
    expect(existsSync(join(root, ".pinmap/maps/new-map.json"))).toBe(true);
  });

  it("rejects path traversal map ids without writing outside maps", async () => {
    const root = createRoot();
    const store = createStore(root);
    const unsafeMap: ProjectPinMapDocument = {
      schemaVersion: 1,
      id: "../escape",
      name: "Escape",
      mapView: "package",
      assignments: [],
      updatedAt: firstNow
    };

    const result = await store.saveMap(unsafeMap);

    expect(result).toMatchObject({
      kind: "error",
      message: expect.stringContaining("Invalid project pin map id ../escape")
    });
    expect(existsSync(join(root, ".pinmap/escape.json"))).toBe(false);
    expect(existsSync(join(root, "escape.json"))).toBe(false);
  });

  it("returns an error when an index contains an unsafe map id", async () => {
    const root = createRoot();
    const store = createStore(root);
    writeJson(root, ".pinmap/index.json", {
      schemaVersion: 1,
      activeMapId: "../escape",
      maps: [{ id: "../escape", name: "Escape", updatedAt: firstNow }]
    });

    const result = await store.listMaps();

    expect(result).toMatchObject({
      kind: "error",
      message: expect.stringContaining("Failed to read .pinmap/index.json")
    });
    expect(result).toMatchObject({
      kind: "error",
      message: expect.stringContaining("Invalid project pin map id ../escape")
    });
  });

  it("returns an error when duplicating an indexed source map whose file is missing", async () => {
    const root = createRoot();
    const store = createStore(root, [firstNow, secondNow]);

    await store.createDefaultMap();
    rmSync(join(root, ".pinmap/maps/default.json"));

    const result = await store.duplicateMap("default", "Default Copy");

    expect(result).toMatchObject({
      kind: "error",
      message: expect.stringContaining("Failed to read .pinmap/maps/default.json")
    });
    expect(existsSync(join(root, ".pinmap/maps/default-copy.json"))).toBe(false);
  });

  it("uses the first workspace folder only", async () => {
    const firstRoot = createRoot();
    const secondRoot = createRoot();
    const firstFolder: WorkspaceFolderLike = {
      uri: { fsPath: firstRoot },
      name: "First",
      index: 0
    };
    const secondFolder: WorkspaceFolderLike = {
      uri: { fsPath: secondRoot },
      name: "Second",
      index: 1
    };
    const store = new ProjectPinMapStore(() => [firstFolder, secondFolder], () => firstNow);

    await store.createDefaultMap();

    expect(existsSync(join(firstRoot, ".pinmap/index.json"))).toBe(true);
    expect(existsSync(join(secondRoot, ".pinmap/index.json"))).toBe(false);
  });

  it("leaves no temporary files after successful writes", async () => {
    const root = createRoot();
    const store = createStore(root);

    await store.createDefaultMap();

    expect(readdirSync(join(root, ".pinmap"))).not.toContainEqual(expect.stringMatching(/\.tmp$/));
    expect(readdirSync(join(root, ".pinmap/maps"))).not.toContainEqual(
      expect.stringMatching(/\.tmp$/)
    );
  });
});
