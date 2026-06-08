import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChipRepository } from "../../src/extension/chipRepository";
import { RemoteChipRegistry } from "../../src/extension/remoteChipRegistry";
import type { RemoteChipIndex } from "../../src/shared/data/remoteChipIndex";
import type { Chip } from "../../src/shared/types";

const remoteIndex: RemoteChipIndex = {
  schemaVersion: 1,
  dataVersion: "2026-06-04",
  chips: [
    {
      id: "GD32F407",
      displayName: "GD32F407",
      vendor: "GigaDevice",
      family: "GD32F4",
      packages: ["LQFP100"],
      status: "stable",
      chipUrl: "https://example.com/gd32f407.json",
      sourceFiles: [
        {
          type: "gpio-af",
          url: "https://example.com/GD32F407_GPIO_AF.csv"
        }
      ]
    }
  ]
};

const remoteChip: Chip = {
  id: "GD32F407",
  displayName: "GD32F407",
  vendor: "GigaDevice",
  family: "GD32F4",
  pins: [],
  packages: []
};

const context = (storageRoot: string) =>
  ({
    globalStorageUri: { fsPath: storageRoot }
  }) as never;

const response = (body: unknown, ok = true): Response =>
  ({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Server Error",
    json: async () => body
  }) as Response;

describe("RemoteChipRegistry", () => {
  let storageRoot: string;
  let repository: ChipRepository;

  beforeEach(() => {
    storageRoot = mkdtempSync(join(tmpdir(), "mcupinfunc-remote-registry-"));
    repository = new ChipRepository(context(storageRoot));
  });

  afterEach(() => {
    rmSync(storageRoot, { recursive: true, force: true });
  });

  it("fetches, validates, caches, and searches a remote index", async () => {
    const fetchJson = vi.fn(async (url: string) => {
      expect(url).toBe("https://example.com/index.json");
      return remoteIndex;
    });
    const registry = new RemoteChipRegistry(context(storageRoot), repository, {
      indexUrl: "https://example.com/index.json",
      fetchJson
    });

    expect(await registry.searchRemoteChips("lqfp100")).toEqual(remoteIndex.chips);
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(JSON.parse(readFileSync(join(storageRoot, "remote-index.json"), "utf8"))).toEqual(
      remoteIndex
    );
  });

  it("keeps a valid fetched index usable when cache writing fails", async () => {
    mkdirSync(join(storageRoot, "remote-index.json"));
    const fetchJson = vi.fn(async () => remoteIndex);
    const registry = new RemoteChipRegistry(context(storageRoot), repository, {
      indexUrl: "https://example.com/index.json",
      fetchJson
    });

    expect(await registry.searchRemoteChips("gd32f407")).toEqual(remoteIndex.chips);
  });

  it("refreshes the remote index before falling back to a persisted cache", async () => {
    writeFileSync(join(storageRoot, "remote-index.json"), JSON.stringify(remoteIndex), "utf8");
    const updatedIndex: RemoteChipIndex = {
      ...remoteIndex,
      dataVersion: "2026-06-08",
      chips: [
        ...remoteIndex.chips,
        {
          id: "GD32H757",
          displayName: "GD32H757",
          vendor: "GigaDevice",
          family: "GD32H7",
          packages: ["LQFP176"],
          status: "stable",
          chipUrl: "https://example.com/gd32h757.json",
          sourceFiles: [
            {
              type: "gpio-af",
              url: "https://example.com/GD32H757_GPIO_AF.csv"
            }
          ]
        }
      ]
    };
    const fetchJson = vi.fn(async () => updatedIndex);
    const registry = new RemoteChipRegistry(context(storageRoot), repository, {
      indexUrl: "https://example.com/index.json",
      fetchJson
    });

    expect((await registry.searchRemoteChips("gd32h757")).map((chip) => chip.id)).toEqual([
      "GD32H757"
    ]);
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(JSON.parse(readFileSync(join(storageRoot, "remote-index.json"), "utf8"))).toEqual(
      updatedIndex
    );
  });

  it("falls back to a persisted cached index when refreshing fails", async () => {
    writeFileSync(join(storageRoot, "remote-index.json"), JSON.stringify(remoteIndex), "utf8");
    const fetchJson = vi.fn(async () => {
      throw new Error("offline");
    });
    const registry = new RemoteChipRegistry(context(storageRoot), repository, {
      indexUrl: "https://example.com/index.json",
      fetchJson
    });

    expect(await registry.searchRemoteChips("gd32f407")).toEqual(remoteIndex.chips);
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it("ignores an invalid persisted cache and refreshes from the network", async () => {
    writeFileSync(join(storageRoot, "remote-index.json"), "{", "utf8");
    const fetchJson = vi.fn(async () => remoteIndex);
    const registry = new RemoteChipRegistry(context(storageRoot), repository, {
      indexUrl: "https://example.com/index.json",
      fetchJson
    });

    expect(await registry.searchRemoteChips("gd32f407")).toEqual(remoteIndex.chips);
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it("downloads a remote chip and saves it to the local chip library", async () => {
    const fetchJson = vi.fn(async (url: string) => {
      if (url.endsWith("index.json")) {
        return remoteIndex;
      }

      expect(url).toBe("https://example.com/gd32f407.json");
      return remoteChip;
    });
    const registry = new RemoteChipRegistry(context(storageRoot), repository, {
      indexUrl: "https://example.com/index.json",
      fetchJson
    });

    expect(await registry.downloadRemoteChip("GD32F407")).toEqual({
      id: "GD32F407",
      displayName: "GD32F407",
      vendor: "GigaDevice",
      family: "GD32F4"
    });
    expect(repository.listChips()).toEqual([
      {
        id: "GD32F407",
        displayName: "GD32F407",
        vendor: "GigaDevice",
        family: "GD32F4"
      }
    ]);
    expect(repository.loadChip("GD32F407")).toEqual(remoteChip);
  });

  it("rejects downloaded chip JSON whose id does not match the index entry", async () => {
    const fetchJson = vi.fn(async (url: string) => {
      if (url.endsWith("index.json")) {
        return remoteIndex;
      }

      return { ...remoteChip, id: "GD32H759" };
    });
    const registry = new RemoteChipRegistry(context(storageRoot), repository, {
      indexUrl: "https://example.com/index.json",
      fetchJson
    });

    await expect(registry.downloadRemoteChip("GD32F407")).rejects.toThrow(
      "Remote chip GD32F407 JSON id GD32H759 does not match the remote index entry."
    );
    expect(repository.listChips()).toEqual([]);
  });

  it("reports missing remote chip ids", async () => {
    const registry = new RemoteChipRegistry(context(storageRoot), repository, {
      indexUrl: "https://example.com/index.json",
      fetchJson: async () => remoteIndex
    });

    await expect(registry.downloadRemoteChip("GD32H759")).rejects.toThrow(
      "Remote chip GD32H759 was not found in the remote index."
    );
  });

  it("reports fetch failures with the requested url", async () => {
    const registry = new RemoteChipRegistry(context(storageRoot), repository, {
      indexUrl: "https://example.com/index.json",
      fetchJson: async (url) => {
        throw new Error(`boom ${url}`);
      }
    });

    await expect(registry.refreshIndex()).rejects.toThrow(
      "Failed to fetch remote chip index from https://example.com/index.json: boom https://example.com/index.json"
    );
  });

  it("can use a response-based fetch implementation", async () => {
    const registry = new RemoteChipRegistry(context(storageRoot), repository, {
      indexUrl: "https://example.com/index.json",
      fetch: async () => response(remoteIndex)
    });

    expect(await registry.refreshIndex()).toEqual(remoteIndex);
  });
});
