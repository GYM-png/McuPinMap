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

export type RemoteChipSummary = {
  id: string;
  displayName: string;
  vendor: string;
  family: string;
  packages: string[];
  status: "draft" | "stable";
  chipUrl: string;
  sourceFiles: RemoteChipSourceFile[];
};

export type RemoteChipIndex = {
  schemaVersion: 1;
  dataVersion: string;
  chips: RemoteChipSummary[];
};

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertNonEmptyString(value: unknown, path: string): asserts value is string {
  if (!nonEmptyString(value)) {
    throw new Error(`${path} must be a non-empty string`);
  }
}

function isAllowedRemoteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") {
      return true;
    }

    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "::1" ||
        url.hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

function assertRemoteUrl(value: unknown, path: string): asserts value is string {
  if (!nonEmptyString(value) || !isAllowedRemoteUrl(value)) {
    throw new Error(`${path} must be a valid URL`);
  }
}

function validateSourceFile(value: unknown, path: string): RemoteChipSourceFile {
  if (!value || typeof value !== "object") {
    throw new Error(`${path} must be an object`);
  }

  const candidate = value as Record<string, unknown>;
  assertRemoteUrl(candidate.url, `${path}.url`);

  if (candidate.type === "gpio-af") {
    return {
      type: "gpio-af",
      url: candidate.url
    };
  }

  if (candidate.type === "pinout") {
    assertNonEmptyString(candidate.package, `${path}.package`);
    return {
      type: "pinout",
      package: candidate.package,
      url: candidate.url
    };
  }

  throw new Error(`${path}.type must be "gpio-af" or "pinout"`);
}

function validateChipSummary(value: unknown, path: string): RemoteChipSummary {
  if (!value || typeof value !== "object") {
    throw new Error(`${path} must be an object`);
  }

  const candidate = value as Record<string, unknown>;
  assertNonEmptyString(candidate.id, `${path}.id`);
  assertNonEmptyString(candidate.displayName, `${path}.displayName`);
  assertNonEmptyString(candidate.vendor, `${path}.vendor`);
  assertNonEmptyString(candidate.family, `${path}.family`);
  assertRemoteUrl(candidate.chipUrl, `${path}.chipUrl`);

  if (!Array.isArray(candidate.packages)) {
    throw new Error(`${path}.packages must be an array`);
  }

  if (!candidate.packages.every(nonEmptyString)) {
    throw new Error(`${path}.packages must contain only non-empty strings`);
  }

  if (candidate.status !== "draft" && candidate.status !== "stable") {
    throw new Error(`${path}.status must be "draft" or "stable"`);
  }

  if (!Array.isArray(candidate.sourceFiles)) {
    throw new Error(`${path}.sourceFiles must be an array`);
  }

  return {
    id: candidate.id,
    displayName: candidate.displayName,
    vendor: candidate.vendor,
    family: candidate.family,
    packages: [...candidate.packages],
    status: candidate.status,
    chipUrl: candidate.chipUrl,
    sourceFiles: candidate.sourceFiles.map((sourceFile, index) =>
      validateSourceFile(sourceFile, `${path}.sourceFiles[${index}]`)
    )
  };
}

export function validateRemoteChipIndex(value: unknown): RemoteChipIndex {
  if (!value || typeof value !== "object") {
    throw new Error("remote chip index must be an object");
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== 1) {
    throw new Error("schemaVersion must be 1");
  }

  assertNonEmptyString(candidate.dataVersion, "dataVersion");

  if (!Array.isArray(candidate.chips)) {
    throw new Error("chips must be an array");
  }

  return {
    schemaVersion: 1,
    dataVersion: candidate.dataVersion,
    chips: candidate.chips.map((chip, index) => validateChipSummary(chip, `chips[${index}]`))
  };
}

export function searchRemoteChipIndex(
  index: RemoteChipIndex,
  query: string
): RemoteChipSummary[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return index.chips;
  }

  return index.chips.filter((chip) => {
    const fields = [
      chip.id,
      chip.displayName,
      chip.vendor,
      chip.family,
      ...chip.packages
    ].map((field) => field.toLowerCase());

    return fields.some(
      (field) => field.startsWith(normalizedQuery) || field.includes(normalizedQuery)
    );
  });
}
