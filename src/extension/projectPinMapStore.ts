import { constants, renameSync, unlinkSync } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
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

type ReadIndexResult =
  | { kind: "ready"; index: ProjectPinMapIndex }
  | { kind: "empty" }
  | { kind: "error"; message: string };

type MapPathEntry = {
  relativePath: string;
  absolutePath: string;
};

const safeMapIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const windowsReservedBasenames = new Set([
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

export class ProjectPinMapStore {
  constructor(
    private readonly getWorkspaceFolders: () => readonly WorkspaceFolderLike[] | undefined,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async listMaps(): Promise<ProjectPinMapStoreResult> {
    const root = this.workspaceRoot();
    if (!root) {
      return { kind: "no-workspace" };
    }

    const indexResult = await this.readIndex(root);
    if (indexResult.kind === "empty") {
      return { kind: "empty" };
    }
    if (indexResult.kind === "error") {
      return indexResult;
    }

    return { kind: "ready", index: indexResult.index };
  }

  async createDefaultMap(): Promise<ProjectPinMapStoreResult> {
    const root = this.workspaceRoot();
    if (!root) {
      return { kind: "no-workspace" };
    }

    const indexResult = await this.readIndex(root);
    if (indexResult.kind === "error") {
      return indexResult;
    }

    const existingIndex =
      indexResult.kind === "ready" ? indexResult.index : { schemaVersion: 1 as const, maps: [] };
    const existingIds = new Set(existingIndex.maps.map((map) => map.id));
    let id = createNextProjectPinMapId("Default", existingIds);
    let mapResult = await this.readOptionalMap(root, indexResult, id);
    while (mapResult.kind === "ready") {
      existingIds.add(id);
      id = createNextProjectPinMapId("Default", existingIds);
      mapResult = await this.readOptionalMap(root, indexResult, id);
    }
    if (mapResult.kind === "error") {
      return mapResult;
    }

    const map = createProjectPinMapDocument(id, "Default", this.now());
    const index = this.upsertMapSummary(existingIndex, map);
    await this.writeMapAndIndex(root, index, map);

    return { kind: "ready", index, activeMap: map };
  }

  async loadMap(mapId?: string): Promise<ProjectPinMapStoreResult> {
    const root = this.workspaceRoot();
    if (!root) {
      return { kind: "no-workspace" };
    }

    const indexResult = await this.readIndex(root);
    if (indexResult.kind === "empty") {
      return { kind: "empty" };
    }
    if (indexResult.kind === "error") {
      return indexResult;
    }

    const chosenMapId = mapId ?? indexResult.index.activeMapId ?? indexResult.index.maps[0]?.id;
    if (!chosenMapId) {
      return { kind: "empty", index: indexResult.index };
    }

    const idError = this.validateMapId(chosenMapId);
    if (idError) {
      return { kind: "error", message: idError };
    }

    const mapResult = await this.readMap(root, indexResult.index, chosenMapId);
    if (mapResult.kind === "error") {
      return mapResult;
    }

    return {
      kind: "ready",
      index: { ...indexResult.index, activeMapId: chosenMapId },
      activeMap: mapResult.map
    };
  }

  async selectMap(mapId: string): Promise<ProjectPinMapStoreResult> {
    const root = this.workspaceRoot();
    if (!root) {
      return { kind: "no-workspace" };
    }

    const indexResult = await this.readIndex(root);
    if (indexResult.kind !== "ready") {
      return indexResult;
    }

    const idError = this.validateMapId(mapId);
    if (idError) {
      return { kind: "error", message: idError };
    }

    const mapResult = await this.readMap(root, indexResult.index, mapId);
    if (mapResult.kind === "error") {
      return mapResult;
    }

    const nextIndex = parseProjectPinMapIndex({
      ...indexResult.index,
      activeMapId: mapId
    });
    await this.writeJsonAtomically(this.indexPath(root), nextIndex);

    return {
      kind: "ready",
      index: nextIndex,
      activeMap: mapResult.map
    };
  }

  async saveMap(map: ProjectPinMapDocument): Promise<ProjectPinMapStoreResult> {
    const root = this.workspaceRoot();
    if (!root) {
      return { kind: "no-workspace" };
    }

    const indexResult = await this.readIndex(root);
    if (indexResult.kind === "error") {
      return indexResult;
    }

    const savedMap = parseProjectPinMapDocument({ ...map, updatedAt: this.now() });
    const idError = this.validateMapId(savedMap.id);
    if (idError) {
      return { kind: "error", message: idError };
    }

    const existingMap = await this.readOptionalMap(root, indexResult, savedMap.id);
    if (existingMap.kind === "error") {
      return existingMap;
    }

    const index = this.upsertMapSummary(
      indexResult.kind === "ready" ? indexResult.index : { schemaVersion: 1, maps: [] },
      savedMap
    );
    await this.writeMapAndIndex(root, index, savedMap);

    return { kind: "ready", index, activeMap: savedMap };
  }

  async duplicateMap(
    sourceMapId: string | undefined,
    name: string
  ): Promise<ProjectPinMapStoreResult> {
    const root = this.workspaceRoot();
    if (!root) {
      return { kind: "no-workspace" };
    }

    const indexResult = await this.readIndex(root);
    if (indexResult.kind === "error") {
      return indexResult;
    }

    const source =
      sourceMapId && indexResult.kind === "ready" && indexResult.index.maps.length > 0
        ? await this.readMap(root, indexResult.index, sourceMapId)
        : undefined;
    if (source?.kind === "error") {
      return source;
    }

    const existingIds =
      indexResult.kind === "ready"
        ? new Set(indexResult.index.maps.map((map) => map.id))
        : new Set<string>();
    const now = this.now();
    const id = createNextProjectPinMapId(name, existingIds);
    const duplicated = parseProjectPinMapDocument(
      source?.kind === "ready"
        ? { ...source.map, id, name, updatedAt: now }
        : createProjectPinMapDocument(id, name, now)
    );
    const index = this.upsertMapSummary(
      indexResult.kind === "ready" ? indexResult.index : { schemaVersion: 1, maps: [] },
      duplicated
    );

    await this.writeMapAndIndex(root, index, duplicated);

    return { kind: "ready", index, activeMap: duplicated };
  }

  async renameMap(mapId: string, name: string): Promise<ProjectPinMapStoreResult> {
    const loaded = await this.loadMap(mapId);
    if (loaded.kind !== "ready" || !loaded.activeMap) {
      return loaded;
    }

    return this.saveMap({ ...loaded.activeMap, name });
  }

  private workspaceRoot(): string | undefined {
    return this.getWorkspaceFolders()?.[0]?.uri.fsPath;
  }

  private async readIndex(root: string): Promise<ReadIndexResult> {
    const absolutePath = this.indexPath(root);
    if (!(await this.exists(absolutePath))) {
      return { kind: "empty" };
    }

    try {
      const json = JSON.parse(await readFile(absolutePath, "utf8"));
      const index = parseProjectPinMapIndex(json);
      const idError = this.validateIndexMapIds(index);
      if (idError) {
        throw new Error(idError);
      }

      return { kind: "ready", index };
    } catch (error) {
      return {
        kind: "error",
        message: `Failed to read .pinmap/index.json: ${this.errorMessage(error)}`
      };
    }
  }

  private async readMap(
    root: string,
    index: ProjectPinMapIndex,
    mapId: string
  ): Promise<{ kind: "ready"; map: ProjectPinMapDocument } | { kind: "error"; message: string }> {
    const idError = this.validateMapId(mapId);
    if (idError) {
      return {
        kind: "error",
        message: `Failed to read ${this.preferredMapRelativePath(index, mapId)}: ${idError}`
      };
    }

    const mapPath = await this.resolveReadableMapPath(root, index, mapId);

    try {
      const json = JSON.parse(await readFile(mapPath.absolutePath, "utf8"));
      const map = parseProjectPinMapDocument(json);
      const mapIdError = this.validateMapId(map.id);
      if (mapIdError) {
        throw new Error(mapIdError);
      }

      return {
        kind: "ready",
        map
      };
    } catch (error) {
      return {
        kind: "error",
        message: `Failed to read ${mapPath.relativePath}: ${this.errorMessage(error)}`
      };
    }
  }

  private async readOptionalMap(
    root: string,
    indexResult: ReadIndexResult,
    mapId: string
  ): Promise<
    | { kind: "ready"; map: ProjectPinMapDocument }
    | { kind: "empty" }
    | { kind: "error"; message: string }
  > {
    const idError = this.validateMapId(mapId);
    if (idError) {
      return {
        kind: "error",
        message: `Failed to read ${this.preferredMapRelativePathForResult(indexResult, mapId)}: ${idError}`
      };
    }

    const index =
      indexResult.kind === "ready" ? indexResult.index : { schemaVersion: 1 as const, maps: [] };
    const mapPath = await this.resolveReadableMapPath(root, index, mapId);
    if (!(await this.exists(mapPath.absolutePath))) {
      return { kind: "empty" };
    }

    return this.readMap(root, index, mapId);
  }

  private upsertMapSummary(
    index: ProjectPinMapIndex,
    map: ProjectPinMapDocument
  ): ProjectPinMapIndex {
    const summary = summarizeProjectPinMap(map);
    const existingIndex = index.maps.findIndex((item) => item.id === map.id);
    const maps =
      existingIndex === -1
        ? [...index.maps, summary]
        : index.maps.map((item, itemIndex) => (itemIndex === existingIndex ? summary : item));

    return parseProjectPinMapIndex({
      schemaVersion: 1,
      activeMapId: map.id,
      maps
    });
  }

  private async writeMapAndIndex(
    root: string,
    index: ProjectPinMapIndex,
    map: ProjectPinMapDocument
  ): Promise<void> {
    const idError = this.validateMapId(map.id);
    if (idError) {
      throw new Error(idError);
    }

    await mkdir(this.mapsDir(root), { recursive: true });
    await this.writeJsonAtomically(this.mapPath(root, index, map.id), map);
    await this.writeJsonAtomically(this.indexPath(root), index);
  }

  private indexPath(root: string): string {
    return join(root, ".pinmap", "index.json");
  }

  private mapPath(root: string, index: ProjectPinMapIndex, mapId: string): string {
    return join(root, this.preferredMapRelativePath(index, mapId));
  }

  private mapsDir(root: string): string {
    return join(root, ".pinmap", "maps");
  }

  private async resolveReadableMapPath(
    root: string,
    index: ProjectPinMapIndex,
    mapId: string
  ): Promise<MapPathEntry> {
    const preferred = this.mapPathEntry(root, this.preferredMapRelativePath(index, mapId));
    if (await this.exists(preferred.absolutePath)) {
      return preferred;
    }

    const legacy = this.mapPathEntry(root, `.pinmap/maps/${mapId}.json`);
    if (await this.exists(legacy.absolutePath)) {
      return legacy;
    }

    return preferred;
  }

  private preferredMapRelativePathForResult(indexResult: ReadIndexResult, mapId: string): string {
    const index =
      indexResult.kind === "ready" ? indexResult.index : { schemaVersion: 1 as const, maps: [] };
    return this.preferredMapRelativePath(index, mapId);
  }

  private preferredMapRelativePath(index: ProjectPinMapIndex, mapId: string): string {
    const mapIndex = index.maps.findIndex((map) => map.id === mapId);
    const pathIndex = mapIndex === -1 ? index.maps.length : mapIndex;
    const suffix = pathIndex === 0 ? "" : `-${pathIndex + 1}`;
    return `.pinmap/maps/map${suffix}.json`;
  }

  private mapPathEntry(root: string, relativePath: string): MapPathEntry {
    return {
      relativePath,
      absolutePath: join(root, relativePath)
    };
  }

  private async writeJsonAtomically(path: string, value: unknown): Promise<void> {
    const tempPath = join(dirname(path), `${basename(path)}.${process.pid}.${Date.now()}.tmp`);

    try {
      await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
      renameSync(tempPath, path);
    } catch (error) {
      try {
        unlinkSync(tempPath);
      } catch {
        // Best-effort cleanup; the original write error is more useful to callers.
      }

      throw error;
    }
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private validateIndexMapIds(index: ProjectPinMapIndex): string | undefined {
    if (index.activeMapId !== undefined) {
      const activeMapIdError = this.validateMapId(index.activeMapId);
      if (activeMapIdError) {
        return activeMapIdError;
      }
    }

    for (const map of index.maps) {
      const mapIdError = this.validateMapId(map.id);
      if (mapIdError) {
        return mapIdError;
      }
    }

    return undefined;
  }

  private validateMapId(mapId: string): string | undefined {
    if (!safeMapIdPattern.test(mapId) || windowsReservedBasenames.has(mapId)) {
      return `Invalid project pin map id ${mapId}.`;
    }

    return undefined;
  }
}
