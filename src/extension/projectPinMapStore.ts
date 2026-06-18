import { constants, renameSync, unlinkSync } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
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

type ReadIndexResult =
  | { kind: "ready"; index: ProjectPinMapIndex }
  | { kind: "empty" }
  | { kind: "error"; message: string };

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

    const { index, map } = createDefaultProjectPinMap(this.now());
    const mapResult = await this.readOptionalMap(root, map.id);
    if (mapResult.kind === "error") {
      return mapResult;
    }

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

    const mapResult = await this.readMap(root, chosenMapId);
    if (mapResult.kind === "error") {
      return mapResult;
    }

    return {
      kind: "ready",
      index: { ...indexResult.index, activeMapId: chosenMapId },
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

    const existingMap = await this.readOptionalMap(root, savedMap.id);
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
        ? await this.readMap(root, sourceMapId)
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
    mapId: string
  ): Promise<{ kind: "ready"; map: ProjectPinMapDocument } | { kind: "error"; message: string }> {
    const idError = this.validateMapId(mapId);
    if (idError) {
      return {
        kind: "error",
        message: `Failed to read .pinmap/maps/${mapId}.json: ${idError}`
      };
    }

    const relativePath = `.pinmap/maps/${mapId}.json`;

    try {
      const json = JSON.parse(await readFile(join(root, relativePath), "utf8"));
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
        message: `Failed to read ${relativePath}: ${this.errorMessage(error)}`
      };
    }
  }

  private async readOptionalMap(
    root: string,
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
        message: `Failed to read .pinmap/maps/${mapId}.json: ${idError}`
      };
    }

    const absolutePath = this.mapPath(root, mapId);
    if (!(await this.exists(absolutePath))) {
      return { kind: "empty" };
    }

    return this.readMap(root, mapId);
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
    await this.writeJsonAtomically(this.mapPath(root, map.id), map);
    await this.writeJsonAtomically(this.indexPath(root), index);
  }

  private indexPath(root: string): string {
    return join(root, ".pinmap", "index.json");
  }

  private mapPath(root: string, mapId: string): string {
    return join(this.mapsDir(root), `${mapId}.json`);
  }

  private mapsDir(root: string): string {
    return join(root, ".pinmap", "maps");
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
