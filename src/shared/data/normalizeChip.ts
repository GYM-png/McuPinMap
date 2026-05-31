import type { Chip, ChipManifestEntry, PackageLayout, Pin } from "../types";

export function normalizeChip(entry: ChipManifestEntry, pins: Pin[], packages: PackageLayout[] = []): Chip {
  return {
    id: entry.id,
    displayName: entry.displayName,
    vendor: entry.vendor,
    family: entry.family,
    pins: pins.slice().sort(comparePins),
    packages
  };
}

function comparePins(left: Pin, right: Pin): number {
  if (left.port !== right.port) {
    return left.port.localeCompare(right.port);
  }
  return left.number - right.number;
}
