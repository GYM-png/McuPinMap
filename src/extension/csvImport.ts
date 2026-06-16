import * as path from "node:path";
import type * as vscodeTypes from "vscode";
import { parseBgaPinoutCsvText } from "../shared/csv/parseBgaPinoutCsv";
import { parseGpioAfCsvText } from "../shared/csv/parseGpioAfCsv";
import { parseLqfpPinoutCsvText } from "../shared/csv/parseLqfpPinoutCsv";
import { parsePinoutFunctionCsvText } from "../shared/csv/pinoutFunctionCsv";
import { parseBgaPackageName } from "../shared/csv/bgaPinout";
import { validateBgaPinoutCsvText } from "../shared/csv/validateBgaPinoutCsv";
import { validateGpioAfCsvText } from "../shared/csv/validateGpioAfCsv";
import { validateLqfpPinoutCsvText } from "../shared/csv/validateLqfpPinoutCsv";
import { normalizeChip } from "../shared/data/normalizeChip";
import type { Chip, ChipManifestEntry, FunctionSource, PackageLayout } from "../shared/types";

export type CsvImportMetadata = {
  id: string;
  displayName: string;
  vendor: string;
  family: string;
};

export type CsvImportPackageInput = {
  packageName: string;
  csvText: string;
};

export type CsvImportInput = CsvImportMetadata & {
  functionSource?: FunctionSource;
  gpioAfCsvText?: string;
  packages?: CsvImportPackageInput[];
};

export type CsvImportFile = {
  filename: string;
  csvText: string;
};

type VscodeApi = typeof vscodeTypes;

export function buildImportedChip(input: CsvImportInput): Chip {
  const functionSource = input.functionSource ?? (input.gpioAfCsvText ? "gpio-af-csv" : "pinout-csv");
  if (functionSource === "gpio-af-csv") {
    if (!input.gpioAfCsvText) {
      throw new Error("GPIO AF CSV text is required for gpio-af-csv imports.");
    }

    const gpioAfValidation = validateGpioAfCsvText(input.gpioAfCsvText);
    if (gpioAfValidation.errors.length > 0) {
      throw new Error(`Invalid GPIO AF CSV:\n${gpioAfValidation.errors.join("\n")}`);
    }
  }

  if (functionSource === "pinout-csv") {
    if (input.gpioAfCsvText) {
      throw new Error("GPIO AF CSV cannot be used with pinout-csv imports.");
    }

    if ((input.packages ?? []).length === 0) {
      throw new Error("At least one package pinout CSV is required for pinout-csv imports.");
    }
  }

  ensureUniquePackageNames(input.packages ?? []);

  const packages = input.packages?.map(buildPackageLayout) ?? [];
  const pins =
    functionSource === "pinout-csv"
      ? mergePins((input.packages ?? []).flatMap((packageInput) => parsePinoutFunctionCsvText(packageInput.csvText)))
      : parseGpioAfCsvText(input.gpioAfCsvText ?? "");
  const manifestEntry: ChipManifestEntry = {
    id: input.id,
    displayName: input.displayName,
    vendor: input.vendor,
    family: input.family,
    functionSource,
    ...(functionSource === "gpio-af-csv" ? { gpioAfCsv: "local import" } : {}),
    packages: packages.map((packageLayout) => ({
      name: packageLayout.packageName,
      pinoutCsv: "local import"
    })),
    source: "local import",
    status: "draft"
  };

  return normalizeChip(manifestEntry, pins, packages);
}

export async function importLocalCsvWithDialog(): Promise<Chip | undefined> {
  const vscode = await import("vscode");
  const selectedFiles = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: true,
    filters: {
      "CSV files": ["csv"]
    },
    title: "Import McuPinFunc CSV files"
  });

  if (!selectedFiles || selectedFiles.length === 0) {
    return undefined;
  }

  return importLocalCsvFromUris(vscode, selectedFiles);
}

export async function importLocalCsvFromUris(
  vscode: VscodeApi,
  uris: readonly vscodeTypes.Uri[]
): Promise<Chip | undefined> {
  const files = await Promise.all(
    uris.map(async (uri) => ({
      filename: path.basename(uri.fsPath),
      csvText: Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8")
    }))
  );

  const gpioAfFile = findSingleGpioAfCsvFile(files);
  const unsupportedFiles = files.filter((file) => file !== gpioAfFile && !isPackagePinoutCsvFile(file));
  if (unsupportedFiles.length > 0) {
    throwUnsupportedCsvSelection(unsupportedFiles[0]!.filename);
  }

  const packageFiles = files.filter(isPackagePinoutCsvFile);
  if (!gpioAfFile && packageFiles.length === 0) {
    const selectedNames = files.map((file) => file.filename).join(", ");
    throw new Error(`Select at least one package pinout CSV ending _PINOUT.csv. Found: ${selectedNames}`);
  }

  const defaults = inferCsvImportMetadataDefaults((gpioAfFile ?? packageFiles[0]!).filename);
  const metadata = await promptForImportMetadata(vscode, defaults);

  if (!metadata) {
    return undefined;
  }

  const packages: CsvImportPackageInput[] = [];
  for (const file of packageFiles) {
    const packageName = await vscode.window.showInputBox({
      title: "Package name",
      prompt: `Package name for ${file.filename}`,
      value: inferPackageNameFromCsvFilename(file.filename) ?? "",
      validateInput: (nextValue) => (nextValue.trim() ? undefined : "Package name is required.")
    });

    if (packageName === undefined) {
      return undefined;
    }

    packages.push({
      packageName: packageName.trim().toUpperCase(),
      csvText: file.csvText
    });
  }

  return buildImportedChip({
    ...metadata,
    functionSource: gpioAfFile ? "gpio-af-csv" : "pinout-csv",
    gpioAfCsvText: gpioAfFile?.csvText,
    packages
  });
}

export function findSingleGpioAfCsvFile(files: readonly CsvImportFile[]): CsvImportFile | undefined {
  const gpioAfFiles = files.filter((file) => /_GPIO_AF\.csv$/i.test(file.filename));

  if (gpioAfFiles.length > 1) {
    const selectedNames = files.map((file) => file.filename).join(", ");
    throw new Error(
      `Select at most one GPIO AF CSV ending _GPIO_AF.csv. Found ${gpioAfFiles.length} in: ${selectedNames}`
    );
  }

  return gpioAfFiles[0];
}

export function inferCsvImportMetadataDefaults(filename: string): CsvImportMetadata {
  const chipStem = path
    .basename(filename)
    .replace(/_GPIO_AF\.csv$/i, "")
    .replace(/_(LQFP\d+|BGA\d+)_PINOUT\.csv$/i, "");

  return {
    id: chipStem,
    displayName: chipStem,
    vendor: "local",
    family: "local"
  };
}

export function inferPackageNameFromCsvFilename(filename: string): string | undefined {
  const match = /_(LQFP\d+|BGA\d+)_PINOUT\.csv$/i.exec(path.basename(filename));
  return match?.[1]?.toUpperCase();
}

function isPackagePinoutCsvFile(file: CsvImportFile): boolean {
  return /_(LQFP\d+|BGA\d+)_PINOUT\.csv$/i.test(file.filename);
}

function throwUnsupportedCsvSelection(filename: string): never {
  throw new Error(
    `Unsupported CSV selection ${filename}. Select _GPIO_AF.csv and optional _PINOUT.csv files.`
  );
}

function buildPackageLayout(input: CsvImportPackageInput): PackageLayout {
  const lqfpMatch = /^LQFP(\d+)$/.exec(input.packageName);
  if (lqfpMatch) {
    const totalPads = Number(lqfpMatch[1]);
    const validation = validateLqfpPinoutCsvText(input.csvText, totalPads);
    throwIfPackageInvalid(input.packageName, validation.errors);
    return parseLqfpPinoutCsvText(input.csvText, input.packageName);
  }

  const bgaMatch = /^BGA(\d+)$/.exec(input.packageName);
  if (bgaMatch) {
    const totalPads = parseBgaPackageName(input.packageName);
    const validation = validateBgaPinoutCsvText(input.csvText, totalPads);
    throwIfPackageInvalid(input.packageName, validation.errors);
    return parseBgaPinoutCsvText(input.csvText, input.packageName);
  }

  throw new Error(`Unsupported package ${input.packageName}. Expected LQFP<number> or BGA<number>.`);
}

async function promptForImportMetadata(
  vscode: VscodeApi,
  defaults: CsvImportMetadata
): Promise<CsvImportMetadata | undefined> {
  const id = await promptForRequiredText(vscode, "Chip ID", defaults.id);
  if (id === undefined) {
    return undefined;
  }

  const displayName = await promptForRequiredText(vscode, "Display name", defaults.displayName);
  if (displayName === undefined) {
    return undefined;
  }

  const vendor = await promptForRequiredText(vscode, "Vendor", defaults.vendor);
  if (vendor === undefined) {
    return undefined;
  }

  const family = await promptForRequiredText(vscode, "Family", defaults.family);
  if (family === undefined) {
    return undefined;
  }

  return { id, displayName, vendor, family };
}

async function promptForRequiredText(
  vscode: VscodeApi,
  title: string,
  value: string
): Promise<string | undefined> {
  const input = await vscode.window.showInputBox({
    title,
    value,
    validateInput: (nextValue) => (nextValue.trim() ? undefined : `${title} is required.`)
  });

  return input?.trim();
}

function throwIfPackageInvalid(packageName: string, errors: string[]): void {
  if (errors.length > 0) {
    throw new Error(`Invalid package CSV for ${packageName}:\n${errors.join("\n")}`);
  }
}

function ensureUniquePackageNames(packages: readonly CsvImportPackageInput[]): void {
  const seenPackageNames = new Set<string>();
  for (const packageInput of packages) {
    const normalizedPackageName = packageInput.packageName.trim().toUpperCase();
    if (seenPackageNames.has(normalizedPackageName)) {
      throw new Error(`Duplicate package ${normalizedPackageName} in selected CSV files.`);
    }

    seenPackageNames.add(normalizedPackageName);
  }
}

function mergePins(pins: Chip["pins"]): Chip["pins"] {
  const byName = new Map<string, Chip["pins"][number]>();
  for (const pin of pins) {
    const existing = byName.get(pin.name);
    if (!existing) {
      byName.set(pin.name, { ...pin, functions: [...pin.functions] });
      continue;
    }

    for (const fn of pin.functions) {
      if (!existing.functions.some((existingFn) => existingFn.af === fn.af && existingFn.raw === fn.raw)) {
        existing.functions.push(fn);
      }
    }
  }

  return [...byName.values()];
}
