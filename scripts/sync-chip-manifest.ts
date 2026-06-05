import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { ChipManifest, ChipManifestEntry } from "../src/shared/types";

type ScannedChip = {
  id: string;
  vendorSlug: string;
  familySlug: string;
  chipSlug: string;
  functionSource: "gpio-af-csv" | "pinout-csv";
  gpioAfCsv?: string;
  sourcePath: string;
  packages: Array<{
    name: string;
    pinoutCsv: string;
  }>;
};

export type SyncChipManifestOptions = {
  dataRoot?: string;
};

const GPIO_AF_FILE = /^(.+)_GPIO_AF\.csv$/;
const PACKAGE_PINOUT_FILE = /^(.+)_(LQFP|BGA)(\d+)_PINOUT\.csv$/;

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

function readChipPathParts(relativePath: string): { vendorSlug: string; familySlug: string; chipSlug: string } | undefined {
  const parts = relativePath.split("/");
  if (parts[0] === "chips") {
    if (parts.length !== 6 || parts[4] !== "source") {
      return undefined;
    }

    return {
      vendorSlug: parts[1],
      familySlug: parts[2],
      chipSlug: parts[3]
    };
  }

  if (parts.length >= 4) {
    return {
      vendorSlug: parts[0],
      familySlug: parts[1],
      chipSlug: parts[2]
    };
  }

  return undefined;
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
  const gpioFilesByChip = new Map<string, string>();
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
        gpioFilesByChip.set(gpioMatch[1], fullPath);
        continue;
      }

      const pinoutMatch = PACKAGE_PINOUT_FILE.exec(entry);
      if (pinoutMatch) {
        const chipId = pinoutMatch[1];
        const files = pinoutFilesByChip.get(chipId) ?? [];
        files.push(fullPath);
        pinoutFilesByChip.set(chipId, files);
      }
    }
  }

  walk(dataRoot);

  const chipIds = [...new Set([...gpioFilesByChip.keys(), ...pinoutFilesByChip.keys()])].sort();

  return chipIds
    .map((id): ScannedChip | undefined => {
      const gpioAfPath = gpioFilesByChip.get(id);
      const chipPinouts = pinoutFilesByChip.get(id) ?? [];
      const sourceFile = gpioAfPath ?? chipPinouts[0];
      if (!sourceFile) {
        return undefined;
      }

      const sourcePath = toManifestPath(dataRoot, sourceFile);
      const chipPathParts = readChipPathParts(sourcePath);
      if (!chipPathParts) {
        return undefined;
      }

      const gpioAfCsv = gpioAfPath ? toManifestPath(dataRoot, gpioAfPath) : undefined;
      if (gpioAfPath) {
        const pathParts = gpioAfCsv.split("/");
        const fileName = pathParts[pathParts.length - 1] ?? "";
        const match = GPIO_AF_FILE.exec(fileName);
        if (!match) {
          return undefined;
        }
      }

      const packages = chipPinouts
        .map((pinoutPath) => {
          const pinoutFileName = pinoutPath.split(/[\\/]/).pop() ?? "";
          const pinoutMatch = PACKAGE_PINOUT_FILE.exec(pinoutFileName);
          if (!pinoutMatch) {
            return undefined;
          }

          return {
            name: `${pinoutMatch[2]}${pinoutMatch[3]}`,
            pinoutCsv: toManifestPath(dataRoot, pinoutPath)
          };
        })
        .filter((entry): entry is { name: string; pinoutCsv: string } => entry !== undefined)
        .sort((left, right) => {
          const typeCompare = left.name.replace(/\d+$/, "").localeCompare(right.name.replace(/\d+$/, ""));
          return typeCompare === 0
            ? Number(left.name.replace(/^\D+/, "")) - Number(right.name.replace(/^\D+/, ""))
            : typeCompare;
        });

      return {
        id,
        vendorSlug: chipPathParts.vendorSlug,
        familySlug: chipPathParts.familySlug,
        chipSlug: chipPathParts.chipSlug,
        functionSource: gpioAfCsv ? "gpio-af-csv" : "pinout-csv",
        gpioAfCsv,
        sourcePath,
        packages
      };
    })
    .filter((chip): chip is ScannedChip => chip !== undefined)
    .sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
}

function mergeChip(scanned: ScannedChip, existing?: ChipManifestEntry): ChipManifestEntry {
  return {
    id: existing?.id ?? scanned.id,
    vendor: existing?.vendor ?? toDisplayName(scanned.vendorSlug),
    family: existing?.family ?? scanned.familySlug.toUpperCase(),
    displayName: existing?.displayName ?? scanned.id,
    functionSource: scanned.functionSource,
    gpioAfCsv: scanned.gpioAfCsv,
    packages: scanned.packages,
    source: existing?.source ?? `${scanned.id} ${scanned.functionSource} CSV scanned from ${scanned.sourcePath}`,
    status: existing?.status ?? "draft"
  };
}

export function syncChipManifest(root: string, options: SyncChipManifestOptions = {}): ChipManifest {
  const dataRoot = options.dataRoot ?? join(root, "data/chips");
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
