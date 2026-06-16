import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionContext } from "vscode";
import {
  searchRemoteChipIndex,
  validateRemoteChipIndex
} from "../shared/data/remoteChipIndex";
import type { RemoteChipIndex, RemoteChipSummary } from "../shared/data/remoteChipIndex";
import type { Chip, ChipSummary } from "../shared/types";
import type { ChipRepository } from "./chipRepository";

const DEFAULT_REMOTE_INDEX_URL =
  "https://raw.githubusercontent.com/GYM-png/mcupinfunc-data/main/index.json";
const REMOTE_INDEX_CACHE_FILE = "remote-index.json";

type FetchLike = (url: string) => Promise<Response>;
type FetchJson = (url: string) => Promise<unknown>;

export type RemoteChipRegistryOptions = {
  indexUrl?: string;
  fetch?: FetchLike;
  fetchJson?: FetchJson;
};

export class RemoteChipRegistry {
  private readonly indexUrl: string;
  private readonly fetchJson: FetchJson;
  private cachedIndex: RemoteChipIndex | undefined;

  constructor(
    private readonly context: ExtensionContext,
    private readonly chipRepository: ChipRepository,
    options: RemoteChipRegistryOptions = {}
  ) {
    this.indexUrl = options.indexUrl ?? configuredRemoteIndexUrl() ?? DEFAULT_REMOTE_INDEX_URL;
    this.fetchJson = options.fetchJson ?? createFetchJson(options.fetch ?? globalThis.fetch);
  }

  async refreshIndex(): Promise<RemoteChipIndex> {
    let rawIndex: unknown;
    try {
      rawIndex = await this.fetchJson(this.indexUrl);
    } catch (error) {
      throw new Error(`Failed to fetch remote chip index from ${this.indexUrl}: ${errorMessage(error)}`);
    }

    let index: RemoteChipIndex;
    try {
      index = validateRemoteChipIndex(rawIndex);
    } catch (error) {
      throw new Error(`Invalid remote chip index from ${this.indexUrl}: ${errorMessage(error)}`);
    }

    this.cachedIndex = index;
    try {
      this.saveIndexCache(index);
    } catch {
      // Cache writes are best-effort; a valid freshly fetched index should remain usable.
    }
    return index;
  }

  async searchRemoteChips(query: string): Promise<RemoteChipSummary[]> {
    const index = await this.getIndex();
    return searchRemoteChipIndex(index, query);
  }

  async downloadRemoteChip(chipId: string): Promise<ChipSummary> {
    const index = await this.getIndex();
    const summary = index.chips.find((chip) => chip.id.toLowerCase() === chipId.toLowerCase());
    if (!summary) {
      throw new Error(`Remote chip ${chipId} was not found in the remote index.`);
    }

    let rawChip: unknown;
    try {
      rawChip = await this.fetchJson(summary.chipUrl);
    } catch (error) {
      throw new Error(`Failed to fetch remote chip ${summary.id} from ${summary.chipUrl}: ${errorMessage(error)}`);
    }

    const chip = validateRemoteChip(rawChip, summary.id);
    this.chipRepository.saveRemoteChip(chip);
    return {
      id: chip.id,
      displayName: chip.displayName,
      vendor: chip.vendor,
      family: chip.family
    };
  }

  private async getIndex(): Promise<RemoteChipIndex> {
    if (this.cachedIndex) {
      return this.cachedIndex;
    }

    try {
      return await this.refreshIndex();
    } catch (error) {
      const cachedIndex = this.readIndexCache();
      if (cachedIndex) {
        this.cachedIndex = cachedIndex;
        return cachedIndex;
      }

      throw error;
    }
  }

  private saveIndexCache(index: RemoteChipIndex): void {
    mkdirSync(this.context.globalStorageUri.fsPath, { recursive: true });
    writeFileSync(
      join(this.context.globalStorageUri.fsPath, REMOTE_INDEX_CACHE_FILE),
      `${JSON.stringify(index, null, 2)}\n`,
      "utf8"
    );
  }

  private readIndexCache(): RemoteChipIndex | undefined {
    const cachePath = join(this.context.globalStorageUri.fsPath, REMOTE_INDEX_CACHE_FILE);
    if (!existsSync(cachePath)) {
      return undefined;
    }

    try {
      return validateRemoteChipIndex(JSON.parse(readFileSync(cachePath, "utf8")));
    } catch {
      return undefined;
    }
  }
}

function createFetchJson(fetchLike: FetchLike | undefined): FetchJson {
  return async (url: string): Promise<unknown> => {
    if (!fetchLike) {
      throw new Error("fetch is not available in this runtime");
    }

    const response = await fetchLike(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return response.json();
  };
}

function configuredRemoteIndexUrl(): string | undefined {
  try {
    const vscodeModule = require("vscode") as typeof import("vscode");
    const value = vscodeModule.workspace
      .getConfiguration("mcupinmap")
      .get<string>("remoteIndexUrl");
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

function validateRemoteChip(value: unknown, expectedChipId: string): Chip {
  if (!value || typeof value !== "object") {
    throw new Error(`Remote chip ${expectedChipId} JSON must be an object.`);
  }

  const candidate = value as Partial<Chip>;
  if (
    typeof candidate.id !== "string" ||
    candidate.id.trim().length === 0 ||
    typeof candidate.displayName !== "string" ||
    candidate.displayName.trim().length === 0 ||
    typeof candidate.vendor !== "string" ||
    candidate.vendor.trim().length === 0 ||
    typeof candidate.family !== "string" ||
    candidate.family.trim().length === 0 ||
    !Array.isArray(candidate.pins) ||
    !Array.isArray(candidate.packages)
  ) {
    throw new Error(`Remote chip ${expectedChipId} JSON does not contain a valid Chip object.`);
  }

  if (candidate.id.toLowerCase() !== expectedChipId.toLowerCase()) {
    throw new Error(
      `Remote chip ${expectedChipId} JSON id ${candidate.id} does not match the remote index entry.`
    );
  }

  return candidate as Chip;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
