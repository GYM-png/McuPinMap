import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { buildChipFromManifestEntry } from "./build-data-pack";
import { syncChipManifest } from "./sync-chip-manifest";
import type { ChipManifestEntry } from "../src/shared/types";

export type RemoteChipIndexEntry = {
  id: string;
  displayName: string;
  vendor: string;
  family: string;
  packages: string[];
  status: "draft" | "stable";
  chipUrl: string;
  sourceFiles: RemoteChipSourceFile[];
};

export type RemoteChipSourceFile =
  | {
      type: "gpio-af";
      url: string;
    }
  | {
      type: "pinout";
      package: string;
      url: string;
    };

export type RemoteChipIndex = {
  schemaVersion: 1;
  dataVersion: string;
  chips: RemoteChipIndexEntry[];
};

export type BuildRemoteChipIndexOptions = {
  dataRoot?: string;
  outputRoot?: string;
  owner?: string;
  repo?: string;
  branch?: string;
};

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }

  return value;
}

function toUrlPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").split("/").map(encodeURIComponent).join("/");
}

function rawGithubUrl(owner: string, repo: string, branch: string, filePath: string): string {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${toUrlPath(filePath)}`;
}

function chipOutputRelativePath(entry: ChipManifestEntry): string {
  const sourceDir = dirname(entry.gpioAfCsv).replace(/\\/g, "/");
  if (sourceDir.endsWith("/source")) {
    return `${dirname(sourceDir)}/chip.json`.replace(/\\/g, "/");
  }

  return `chips/${entry.vendor.toLowerCase()}/${entry.family.toLowerCase()}/${entry.id.toLowerCase()}/chip.json`;
}

function sourceFiles(entry: ChipManifestEntry, owner: string, repo: string, branch: string): RemoteChipSourceFile[] {
  return [
    {
      type: "gpio-af",
      url: rawGithubUrl(owner, repo, branch, entry.gpioAfCsv)
    },
    ...entry.packages.map((packageEntry) => ({
      type: "pinout" as const,
      package: packageEntry.name,
      url: rawGithubUrl(owner, repo, branch, packageEntry.pinoutCsv)
    }))
  ];
}

export function buildRemoteChipIndex(root: string, options: BuildRemoteChipIndexOptions = {}): RemoteChipIndex {
  const dataRoot = options.dataRoot ?? join(root, "data/chips");
  const outputRoot = options.outputRoot ?? dataRoot;
  const owner = options.owner ?? "GYM-png";
  const repo = options.repo ?? "mcupinfunc-data";
  const branch = options.branch ?? "main";

  const manifest = syncChipManifest(root, { dataRoot });
  const index: RemoteChipIndex = {
    schemaVersion: 1,
    dataVersion: manifest.dataVersion,
    chips: []
  };

  for (const entry of manifest.chips) {
    const chip = buildChipFromManifestEntry(entry, dataRoot);
    const chipRelativePath = chipOutputRelativePath(entry);
    const chipOutputPath = join(outputRoot, chipRelativePath);
    mkdirSync(dirname(chipOutputPath), { recursive: true });
    writeFileSync(chipOutputPath, `${JSON.stringify(chip, null, 2)}\n`, "utf8");

    index.chips.push({
      id: entry.id,
      displayName: entry.displayName,
      vendor: entry.vendor,
      family: entry.family,
      packages: entry.packages.map((packageEntry) => packageEntry.name),
      status: entry.status,
      chipUrl: rawGithubUrl(owner, repo, branch, relative(outputRoot, chipOutputPath)),
      sourceFiles: sourceFiles(entry, owner, repo, branch)
    });
  }

  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(join(outputRoot, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  console.log(`Built remote chip index with ${index.chips.length} chip entr${index.chips.length === 1 ? "y" : "ies"}.`);
  return index;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  buildRemoteChipIndex(process.cwd(), {
    dataRoot: readOption(args, "--data-root"),
    outputRoot: readOption(args, "--output-root"),
    owner: readOption(args, "--owner"),
    repo: readOption(args, "--repo"),
    branch: readOption(args, "--branch")
  });
}
