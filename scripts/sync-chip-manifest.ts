import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { ChipManifest, ChipManifestEntry } from "../src/shared/types";

type ScannedChip = {
  id: string;
  vendorSlug: string;
  familySlug: string;
  chipSlug: string;
  gpioAfCsv: string;
  packages: Array<{
    name: string;
    pinoutCsv: string;
  }>;
};

const GPIO_AF_FILE = /^(.+)_GPIO_AF\.csv$/;
const LQFP_PINOUT_FILE = /^(.+)_LQFP(\d+)_PINOUT\.csv$/;

function toManifestPath(dataRoot: string, filePath: string): string {
  return relative(dataRoot, filePath).replace(/\\/g, "/");
}

function toDisplayName(slug: string): string {
  if (slug.toLowerCase() === "gigadevice") {
    return "GigaDevice";
  }

  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function readManifest(manifestPath: string): ChipManifest {
  if (!existsSync(manifestPath)) {
    return {
      schemaVersion: 1,
      dataVersion: new Date().toISOString().slice(0, 10),
      chips: []
    };
  }

  return JSON.parse(readFileSync(manifestPath, "utf8")) as ChipManifest;
}

function scanCsvFiles(dataRoot: string): ScannedChip[] {
  const gpioFiles: string[] = [];
  const pinoutFilesByChip = new Map<string, string[]>();

  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      if (entry === "manifest.json") {
        continue;
      }

      const fullPath = join(dir, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (!stats.isFile()) {
        continue;
      }

      const gpioMatch = GPIO_AF_FILE.exec(entry);
      if (gpioMatch) {
        gpioFiles.push(fullPath);
        continue;
      }

      const pinoutMatch = LQFP_PINOUT_FILE.exec(entry);
      if (pinoutMatch) {
        const chipId = pinoutMatch[1];
        const files = pinoutFilesByChip.get(chipId) ?? [];
        files.push(fullPath);
        pinoutFilesByChip.set(chipId, files);
      }
    }
  }

  walk(dataRoot);

  return gpioFiles
    .map((gpioAfPath): ScannedChip | undefined => {
      const relativePath = toManifestPath(dataRoot, gpioAfPath);
      const parts = relativePath.split("/");
      if (parts.length < 4) {
        return undefined;
      }

      const fileName = parts[parts.length - 1];
      const match = GPIO_AF_FILE.exec(fileName);
      if (!match) {
        return undefined;
      }

      const id = match[1];
      const chipPinouts = pinoutFilesByChip.get(id) ?? [];
      const packages = chipPinouts
        .map((pinoutPath) => {
          const pinoutFileName = pinoutPath.split(/[\\/]/).pop() ?? "";
          const pinoutMatch = LQFP_PINOUT_FILE.exec(pinoutFileName);
          if (!pinoutMatch) {
            return undefined;
          }

          return {
            name: `LQFP${pinoutMatch[2]}`,
            pinoutCsv: toManifestPath(dataRoot, pinoutPath)
          };
        })
        .filter((entry): entry is { name: string; pinoutCsv: string } => entry !== undefined)
        .sort((left, right) => Number(left.name.slice(4)) - Number(right.name.slice(4)));

      return {
        id,
        vendorSlug: parts[0],
        familySlug: parts[1],
        chipSlug: parts[2],
        gpioAfCsv: relativePath,
        packages
      };
    })
    .filter((chip): chip is ScannedChip => chip !== undefined)
    .sort((left, right) => left.gpioAfCsv.localeCompare(right.gpioAfCsv));
}

function mergeChip(scanned: ScannedChip, existing?: ChipManifestEntry): ChipManifestEntry {
  return {
    id: existing?.id ?? scanned.id,
    vendor: existing?.vendor ?? toDisplayName(scanned.vendorSlug),
    family: existing?.family ?? scanned.familySlug.toUpperCase(),
    displayName: existing?.displayName ?? scanned.id,
    gpioAfCsv: scanned.gpioAfCsv,
    packages: scanned.packages,
    source: existing?.source ?? `${scanned.id} GPIO AF CSV scanned from data/chips/${scanned.vendorSlug}/${scanned.familySlug}/${scanned.chipSlug}`,
    status: existing?.status ?? "draft"
  };
}

export function syncChipManifest(root: string): ChipManifest {
  const dataRoot = join(root, "data/chips");
  const manifestPath = join(dataRoot, "manifest.json");
  const existingManifest = readManifest(manifestPath);
  const existingById = new Map(existingManifest.chips.map((chip) => [chip.id, chip]));
  const scannedChips = scanCsvFiles(dataRoot);
  const manifest: ChipManifest = {
    schemaVersion: 1,
    dataVersion: existingManifest.dataVersion,
    chips: scannedChips.map((chip) => mergeChip(chip, existingById.get(chip.id)))
  };

  mkdirSync(dataRoot, { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return manifest;
}

if (require.main === module) {
  const manifest = syncChipManifest(process.cwd());
  console.log(`Synced ${manifest.chips.length} chip manifest entr${manifest.chips.length === 1 ? "y" : "ies"}.`);
}
