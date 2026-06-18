import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
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

type ReadIndexResult =
  | { kind: "ready"; index: ProjectPinMapIndex }
  | { kind: "empty" }
  | { kind: "error"; message: string };

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

  async duplicateMap(sourceMapId: string, name: string): Promise<ProjectPinMapStoreResult> {
    const root = this.workspaceRoot();
    if (!root) {
      return { kind: "no-workspace" };
    }

    const indexResult = await this.readIndex(root);
    if (indexResult.kind === "error") {
      return indexResult;
    }

    const source =
      indexResult.kind === "ready" ? await this.readOptionalMap(root, sourceMapId) : undefined;
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
      return { kind: "ready", index: parseProjectPinMapIndex(json) };
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
    const relativePath = `.pinmap/maps/${mapId}.json`;

    try {
      const json = JSON.parse(await readFile(join(root, relativePath), "utf8"));
      return {
        kind: "ready",
        map: parseProjectPinMapDocument(json)
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
    await mkdir(this.mapsDir(root), { recursive: true });
    await writeFile(this.mapPath(root, map.id), `${JSON.stringify(map, null, 2)}\n`, "utf8");
    await writeFile(this.indexPath(root), `${JSON.stringify(index, null, 2)}\n`, "utf8");
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
}
