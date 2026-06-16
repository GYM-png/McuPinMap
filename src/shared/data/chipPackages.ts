import type { Chip, PackageLayout } from "../types";

export function dedupePackageNames(packageNames: readonly string[]): string[] {
  const seen = new Set<string>();
  const uniquePackageNames: string[] = [];

  for (const packageName of packageNames) {
    const key = packageName.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniquePackageNames.push(packageName);
  }

  return uniquePackageNames;
}

export function dedupePackageLayouts(packages: readonly PackageLayout[]): PackageLayout[] {
  const seen = new Set<string>();
  const uniquePackages: PackageLayout[] = [];

  for (const packageLayout of packages) {
    const key = packageLayout.packageName.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniquePackages.push(packageLayout);
  }

  return uniquePackages;
}

export function normalizeChipPackages(chip: Chip): Chip {
  const packages = dedupePackageLayouts(chip.packages);
  return packages.length === chip.packages.length ? chip : { ...chip, packages };
}
